import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5'

const FIREBASE_PROJECT = 'boloes-loterias-especiais'
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT}`
const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const PROFILE_CACHE = new Map<string,{ts:number,data:any}>()

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } }) }
function field(v: any): any {
  if (!v || typeof v !== 'object') return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return !!v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue || 0)
  if ('doubleValue' in v) return Number(v.doubleValue || 0)
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if (v.mapValue?.fields) return decodeFields(v.mapValue.fields)
  if (Array.isArray(v.arrayValue?.values)) return v.arrayValue.values.map(field)
  return null
}
function decodeFields(fields: Record<string, any> = {}) { const out: Record<string, any> = {}; for (const [k,v] of Object.entries(fields)) out[k]=field(v); return out }
function n(v:any){ return String(v??'').trim().toUpperCase() }
function same(a:any,b:any){ return n(a)===n(b) }
function usuarioValido(u:any){ const st=n(u?.status); const ativo=u?.ativo===true || ['TRUE','SIM','ATIVO','APROVADO'].includes(n(u?.ativo)); return ativo && (st==='APROVADO'||st==='ATIVO') }
function adminValido(u:any){ const pf=n(u?.perfil||u?.role); return usuarioValido(u) && (pf.includes('ADMIN')||pf.includes('MESTRE')) }

async function verifyFirebase(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('FIREBASE_TOKEN_AUSENTE')
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, { issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, algorithms: ['RS256'] })
  const email=String(payload.email||'').trim().toLowerCase(), sub=String(payload.sub||'').trim()
  if(!email||!sub) throw new Error('FIREBASE_TOKEN_SEM_IDENTIDADE')
  return {email,sub,token}
}
async function firebasePerfil(email:string,token:string){
  const c=PROFILE_CACHE.get(email); if(c&&Date.now()-c.ts<30000)return c.data
  const url=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/usuarios/${encodeURIComponent(email)}`
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),3000)
  try{ const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:ctrl.signal}); if(!r.ok)return null; const j=await r.json(); const d=decodeFields(j?.fields||{}); PROFILE_CACHE.set(email,{ts:Date.now(),data:d}); return d } finally { clearTimeout(timer) }
}
function adminScreen(s:string){return ['usuarios','solicitacoes','base_loterias','participantes','pagamentos','dados_recebimento','consulta'].includes(s)}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({ok:false,erro:'METODO_INVALIDO'},405)
  try{
    const ident=await verifyFirebase(req)
    const fb=await firebasePerfil(ident.email,ident.token)
    if(!fb||!usuarioValido(fb))return json({ok:false,erro:'USUARIO_NAO_AUTORIZADO'},403)
    const body=await req.json().catch(()=>({}))
    const screen=String(body?.screen||'').trim().toLowerCase()
    if(adminScreen(screen)&&!adminValido(fb))return json({ok:false,erro:'ADMIN_NAO_AUTORIZADO'},403)

    const url=Deno.env.get('SUPABASE_URL')!
    const secretMap=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
    const secret=secretMap.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!secret)throw new Error('SUPABASE_SECRET_INDISPONIVEL')
    const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})

    let {data:me}=await sb.from('usuarios').select('id,email,firebase_uid').eq('email',ident.email).maybeSingle()
    if(!me?.id){
      const ins=await sb.from('usuarios').upsert({email:ident.email,nome:String(fb.nome||ident.email),perfil:String(fb.perfil||'PARTICIPANTE').toUpperCase(),status:'APROVADO',aprovado:true,firebase_uid:ident.sub},{onConflict:'email'}).select('id,email,firebase_uid').maybeSingle()
      me=ins.data||null
    }else if(!me.firebase_uid){ await sb.from('usuarios').update({firebase_uid:ident.sub}).eq('id',me.id) }

    if(screen==='usuarios'){
      const q=await sb.from('usuarios').select('id,nome,nome_publico,email,telefone,status,perfil,aprovado,firebase_uid,created_at,updated_at').order('nome',{ascending:true}); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='solicitacoes'){
      const q=await sb.from('solicitacoes_cadastro').select('*').order('data_solicitacao',{ascending:false}).limit(500); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='base_loterias'){
      const q=await sb.from('base_loterias').select('*').order('nome',{ascending:true}); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='participantes'){
      const q=await sb.from('participacoes').select('id,bolao_id,usuario_id,status,inscrito,cotas_confirmadas,cotas_pendentes,cotas_reservadas,created_at,updated_at,usuarios(nome,email),boloes(nome,loteria)').order('updated_at',{ascending:false}).limit(1000); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='pagamentos'){
      const q=await sb.from('pagamentos').select('*').order('created_at',{ascending:false}).limit(1000); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='dados_recebimento'){
      const q=await sb.from('dados_recebimento').select('*').order('loteria',{ascending:true}); if(q.error)throw q.error; return json({ok:true,screen,rows:q.data||[]})
    }
    if(screen==='boloes'){
      const [qb,qp]=await Promise.all([
        sb.from('boloes').select('*').order('data_sorteio',{ascending:true}),
        me?.id?sb.from('participacoes').select('*').eq('usuario_id',me.id):Promise.resolve({data:[],error:null} as any)
      ])
      if(qb.error)throw qb.error; if(qp.error)throw qp.error
      const pm=new Map((qp.data||[]).map((p:any)=>[String(p.bolao_id),p]))
      const rows=(qb.data||[]).map((b:any)=>{const p:any=pm.get(String(b.id))||{};return {...b,
        loteria:b.loteria||b.nome,nome:b.nome||b.loteria,dataSorteio:b.data_sorteio,inicioPagamento:b.inicio_pagamento,fimPagamento:b.fim_pagamento,inicioPalpite:b.inicio_palpite,fimPalpite:b.fim_palpite,
        valorCota:b.valor_cota,totalCotas:b.total_cotas,cotasAdquiridas:b.cotas_adquiridas,cotasDisponiveis:b.cotas_disponiveis,qtdParcelas:b.qtd_parcelas,premiacao:b.premiacao,premioPorCota:b.premio_por_cota,
        range:b.faixa_numeros,qtdMin:b.qtd_min,qtdMax:b.qtd_max,qtdPalpite:b.qtd_palpite,historico:b.historico,
        inscrito:p.inscrito===true,cotasConfirmadasUsuario:Number(p.cotas_confirmadas||0),minhasCotasConfirmadas:Number(p.cotas_confirmadas||0),cotasUsuario:Number(p.cotas_confirmadas||0),cotasPendentesUsuario:Number(p.cotas_pendentes||0),cotasReservadasUsuario:Number(p.cotas_reservadas||0)
      }})
      return json({ok:true,screen,rows})
    }
    if(screen==='comprovantes'){
      if(!me?.id)return json({ok:true,screen,rows:[]})
      const [qc,qp,qb]=await Promise.all([
        sb.from('comprovantes').select('id,pagamento_id,nome_arquivo,status,legacy_drive_url,storage_path,created_at').eq('usuario_id',me.id).order('created_at',{ascending:false}).limit(100),
        sb.from('pagamentos').select('id,bolao_id,status,data_pagamento,arquivo_url').eq('usuario_id',me.id).order('created_at',{ascending:false}).limit(200),
        sb.from('boloes').select('id,nome,loteria')
      ])
      if(qc.error)throw qc.error; if(qp.error)throw qp.error; if(qb.error)throw qb.error
      const pay=new Map((qp.data||[]).map((x:any)=>[String(x.id),x])), bm=new Map((qb.data||[]).map((x:any)=>[String(x.id),x]))
      const rows=(qc.data||[]).map((c:any)=>{const p:any=pay.get(String(c.pagamento_id))||{},b:any=bm.get(String(p.bolao_id))||{};return {data:c.created_at,status:c.status||p.status||'PENDENTE',url:c.legacy_drive_url||p.arquivo_url||'',arquivo:c.nome_arquivo||'',loteria:b.loteria||b.nome||p.bolao_id||''}})
      return json({ok:true,screen,rows})
    }
    if(screen==='palpite_info'||screen==='palpite_status'){
      const nome=String(body?.loteria||body?.nome||'').trim()
      const qb=await sb.from('boloes').select('*'); if(qb.error)throw qb.error
      const b=(qb.data||[]).find((x:any)=>same(x.id,nome)||same(x.nome,nome)||same(x.loteria,nome))
      if(!b)return json({ok:false,erro:'BOLAO_NAO_LOCALIZADO'},404)
      if(screen==='palpite_info'){
        const ql=await sb.from('base_loterias').select('*'); if(ql.error)throw ql.error
        const base=(ql.data||[]).find((x:any)=>same(x.nome,b.loteria)||same(x.nome,b.nome))||{}
        const range=Number(b.faixa_numeros||base.faixa_numeros||60), qtd=Number(b.qtd_palpite||base.qtd_palpite||6)
        return json({ok:true,screen,data:{loteria:b.loteria||b.nome,nome:b.nome,range,nMax:range,qtdEscolha:qtd,qtdPalpite:qtd,numerosDisponiveis:Array.from({length:range},(_,i)=>i+1)}})
      }
      const [qpart,quser,qall]=await Promise.all([
        me?.id?sb.from('participacoes').select('*').eq('usuario_id',me.id).eq('bolao_id',b.id).maybeSingle():Promise.resolve({data:null,error:null} as any),
        me?.id?sb.from('palpites').select('*').eq('usuario_id',me.id).eq('bolao_id',b.id).order('jogo',{ascending:true}):Promise.resolve({data:[],error:null} as any),
        sb.from('palpites').select('numeros').eq('bolao_id',b.id)
      ])
      if(qpart.error)throw qpart.error;if(quser.error)throw quser.error;if(qall.error)throw qall.error
      const p:any=qpart.data||{},palpites=(quser.data||[]).map((x:any,i:number)=>({id:x.id,jogo:x.jogo||i+1,data:x.enviado_em||x.created_at,numeros:x.numeros,numerosTexto:Array.isArray(x.numeros)?x.numeros.join(' '):(x.texto_original||''),status:x.status}))
      const cont:Record<string,number>={}; for(const r of qall.data||[]){for(const z of Array.isArray((r as any).numeros)?(r as any).numeros:[]){const k=String(z);cont[k]=(cont[k]||0)+1}}
      const todos=Object.entries(cont).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0])).map(([numero,qtd])=>({numero:Number(numero),qtd}))
      const cotas=Number(p.cotas_confirmadas||0), maxJogos=Math.max(0,Math.floor(cotas))
      return json({ok:true,screen,data:{cotas,maxJogos,podeEditar:p.inscrito===true&&cotas>0,palpites,top10:todos.slice(0,10),todosNumeros:todos,cotasConfirmadas:cotas,cotasReservadas:Number(p.cotas_reservadas||0),cotasPendentes:Number(p.cotas_pendentes||0)}})
    }
    if(screen==='consulta'){
      const target=String(body?.participanteEmail||body?.email||'').trim().toLowerCase()
      if(!target){ const q=await sb.from('usuarios').select('nome,nome_publico,email,status,perfil').order('nome',{ascending:true}); if(q.error)throw q.error; return json({ok:true,screen,data:{participantes:(q.data||[]).filter((u:any)=>u.email).map((u:any)=>({nome:u.nome,nomePublico:u.nome_publico,email:u.email,status:u.status,perfil:u.perfil}))}}) }
      const qu=await sb.from('usuarios').select('*').eq('email',target).maybeSingle(); if(qu.error)throw qu.error; const u:any=qu.data; if(!u)return json({ok:false,erro:'PARTICIPANTE_NAO_LOCALIZADO'},404)
      const [qpa,qpay,qpal,qsol,qaq,qj]=await Promise.all([
        sb.from('participacoes').select('*,boloes(nome,loteria)').eq('usuario_id',u.id),
        sb.from('pagamentos').select('*').eq('usuario_id',u.id).order('created_at',{ascending:false}),
        sb.from('palpites').select('*,boloes(nome,loteria)').eq('usuario_id',u.id).order('created_at',{ascending:false}),
        sb.from('solicitacoes_cadastro').select('*').eq('email',target).order('created_at',{ascending:false}),
        sb.from('aquisicoes_cotas').select('*,boloes(nome,loteria)').eq('usuario_id',u.id).order('created_at',{ascending:false}),
        sb.from('jogos_realizados').select('*').order('created_at',{ascending:false}).limit(200)
      ])
      for(const q of [qpa,qpay,qpal,qsol,qaq,qj])if((q as any).error)throw (q as any).error
      const parts:any[]=qpa.data||[],pays:any[]=qpay.data||[]
      const resumo={cotasConfirmadas:parts.reduce((s,x)=>s+Number(x.cotas_confirmadas||0),0),cotasReservadas:parts.reduce((s,x)=>s+Number(x.cotas_reservadas||0),0),totalPago:pays.filter(x=>['PAGO','CONFIRMADO','APROVADO'].includes(n(x.status))).reduce((s,x)=>s+Number(x.valor_transferido||x.valor||0),0),totalAnalise:pays.filter(x=>['PENDENTE','EM ANALISE','EM_ANÁLISE','ANALISE'].includes(n(x.status))).reduce((s,x)=>s+Number(x.valor_transferido||x.valor||0),0)}
      return json({ok:true,screen,data:{usuario:{nome:u.nome,email:u.email,status:u.status,perfil:u.perfil},resumo,
        boloes:parts.map(x=>({loteria:x.boloes?.loteria||x.boloes?.nome||x.bolao_id,cotas:x.cotas_confirmadas,status:x.status,origem:'Supabase',data:x.created_at})),
        aquisicoes:(qaq.data||[]).map((x:any)=>({data:x.created_at,loteria:x.boloes?.loteria||x.boloes?.nome||x.bolao_id,cotas:x.qtd_cotas,valorTotal:x.valor_total,valorAgora:x.valor_pagamento_agora,parcelado:x.parcelado,status:x.status,validadeReserva:x.validade_reserva})),
        pagamentos:pays.map(x=>({data:x.data_pagamento||x.created_at,loteria:x.bolao_id,valor:x.valor_transferido||x.valor,status:x.status,pagador:x.pagador,recebedor:x.recebedor,idTransacao:x.id_transacao||x.legacy_id,mesReferencia:x.mes_referencia,urlComprovante:x.arquivo_url||''})),
        palpites:(qpal.data||[]).map((x:any)=>({data:x.enviado_em||x.created_at,loteria:x.boloes?.loteria||x.boloes?.nome||x.bolao_id,jogo:x.jogo,numeros:Array.isArray(x.numeros)?x.numeros.join(' '):x.texto_original,status:x.status})),
        solicitacoes:(qsol.data||[]).map((x:any)=>({data:x.data_solicitacao||x.created_at,loteria:x.bolao,cotas:x.cotas,status:x.status,tipo:x.tipo,aceiteRegulamento:x.aceite_regulamento})),
        jogos:(qj.data||[]).filter((x:any)=>parts.some(p=>String(p.bolao_id)===String(x.bolao_id))).map((x:any)=>({data:x.data_jogo||x.created_at,loteria:x.loteria,concurso:x.concurso,arquivo:x.nome_arquivo,url:x.legacy_drive_url||x.image_url||''}))
      }})
    }
    return json({ok:false,erro:'TELA_NAO_SUPORTADA'},400)
  }catch(e){ return json({ok:false,erro:String((e as Error)?.message||e)},401) }
})
