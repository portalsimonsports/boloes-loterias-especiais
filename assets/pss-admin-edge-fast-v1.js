/* Portal SimonSports — Admin Edge Fast V1
 * Leitura administrativa direta: Firebase -> Supabase Edge -> PostgreSQL.
 * Não altera layout, renderizadores ou escritas.
 */
(function(){
'use strict';
if(window.PSS_ADMIN_EDGE_FAST_V1)return;
window.PSS_ADMIN_EDGE_FAST_V1=true;

var CFG=null,CACHE={},TTL=20000;
function norm(v){return String(v==null?'':v).trim().toUpperCase();}
function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
async function cfg(){
  if(CFG)return CFG;
  var r=await fetch('./api/supabase-public.json?v=EDGE_FAST_V12',{cache:'force-cache'});
  if(!r.ok)throw new Error('Config Supabase HTTP '+r.status);
  var j=await r.json();
  CFG={url:String(j.url||'').replace(/\/$/,''),key:String(j.publishableKey||j.key||j.anonKey||'')};
  if(!CFG.url||!CFG.key)throw new Error('Supabase não configurado');
  return CFG;
}
async function token(){
  var u=null;
  try{u=window.FIREBASE_AUTH&&FIREBASE_AUTH.currentUser;}catch(e){}
  if(!u)try{u=window.firebase&&firebase.auth&&firebase.auth().currentUser;}catch(e){}
  if(!u||typeof u.getIdToken!=='function')throw new Error('Firebase sem usuário autenticado');
  return u.getIdToken(false);
}
async function call(screen,force){
  var k=String(screen||'').toLowerCase(),now=Date.now();
  if(!force&&CACHE[k]&&now-CACHE[k].ts<TTL)return CACHE[k].data;
  var c=await cfg(),t=await token(),ini=performance.now();
  var ctrl=new AbortController(),tm=setTimeout(function(){ctrl.abort();},5000);
  try{
    var r=await fetch(c.url+'/functions/v1/pss-firebase-gateway',{
      method:'POST',signal:ctrl.signal,cache:'no-store',
      headers:{apikey:c.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},
      body:JSON.stringify({screen:k})
    });
    var txt=await r.text(),j={};
    try{j=JSON.parse(txt||'{}');}catch(e){}
    if(!r.ok||!j.ok)throw new Error((j&&j.erro)||('Gateway HTTP '+r.status));
    var out=Object.prototype.hasOwnProperty.call(j,'data')?j.data:(j.rows||[]);CACHE[k]={ts:now,data:out};
    window.PSS_LAST_DATA_SOURCE={origem:'SUPABASE EDGE',ms:Math.round(performance.now()-ini),aba:k,ts:Date.now()};
    return CACHE[k].data;
  }finally{clearTimeout(tm);}
}

function usuarios(lista){
  return {headers:['ID','NOME','NOME_PUBLICO','EMAIL','TELEFONE','STATUS','PERFIL','APROVADO','FIREBASE_UID','CRIADO_EM','ATUALIZADO_EM'],rows:(lista||[]).map(function(x){return [x.id,x.nome,x.nome_publico,x.email,x.telefone,x.status,x.perfil,x.aprovado,x.firebase_uid,x.created_at,x.updated_at];})};
}
function participantes(lista){
  return {headers:['ID','BOLAO_ID','BOLAO','USUARIO_ID','NOME','EMAIL','STATUS','INSCRITO','COTAS_CONFIRMADAS','COTAS_PENDENTES','COTAS_RESERVADAS','CRIADO_EM','ATUALIZADO_EM'],rows:(lista||[]).map(function(x){var u=x.usuarios||{},b=x.boloes||{};return [x.id,x.bolao_id,b.nome||'',x.usuario_id,u.nome||'',u.email||'',x.status,x.inscrito,x.cotas_confirmadas,x.cotas_pendentes,x.cotas_reservadas,x.created_at,x.updated_at];})};
}
function pagamentos(lista){
  return {headers:['DATA','EMAIL','LOTERIA','URL_COMPROVANTE','STATUS','PAGADOR','VALOR','ID_TRANSACAO','AUTENTICACAO','ARQUIVO_URL','RECEBEDOR','PIX_DESTINO','VALIDACAO','MES_REFERENCIA','TIPO_COTA','IDENTIFICADOR','PARTES_COTA','PARTICIPANTES_COTA'],rows:(lista||[]).map(function(x){return [x.data_pagamento||x.data_comprovante||x.created_at,x.usuario_email||'',x.bolao_nome||x.bolao_id||'',x.arquivo_url||'',x.status||'',x.pagador||'',x.valor_transferido||x.valor||0,x.id_transacao||x.legacy_id||'',x.autenticacao||'',x.arquivo_url||'',x.recebedor||'',x.pix_destino||'',x.validacao||'',x.mes_referencia||'',x.tipo_cota||'',x.identificador||'',x.partes_cota||'',x.participantes_cota||''];})};
}
function recebimentos(lista){
  return (lista||[]).map(function(x){return {
    id:x.id||'',loteria:x.loteria||'',tipoRecebimento:x.tipo_recebimento||'',nomeCompleto:x.nome_completo||'',tipoPix:x.tipo_pix||'',chavePix:x.chave_pix||'',banco:x.banco||'',agencia:x.agencia||'',conta:x.conta||'',operacao:x.operacao||'',obs:x.obs||'',ativo:x.ativo!==false
  };});
}
function tabela(aba,lista){
  var a=norm(aba);
  if(a==='USUARIOS')return usuarios(lista);
  if(a==='PAGAMENTOS')return pagamentos(lista);
  if(a==='PARTICIPANTES_BOLAO'||a==='PARTICIPANTES')return participantes(lista);
  return null;
}
function screenAba(aba){var a=norm(aba);if(a==='USUARIOS')return'usuarios';if(a==='PAGAMENTOS')return'pagamentos';if(a==='PARTICIPANTES_BOLAO'||a==='PARTICIPANTES')return'participantes';return'';}
async function dadosAdmin(aba){var s=screenAba(aba);if(!s)return null;return tabela(aba,await call(s,false));}

function instalarApiMulti(){
  var base=window.apiMulti;
  if(typeof base!=='function'||base.__PSS_ADMIN_EDGE_FAST_V1__)return false;
  var nova=async function(tentativas){
    if(Array.isArray(tentativas)){
      for(var i=0;i<tentativas.length;i++){
        var t=tentativas[i]||{};
        if(String(t.action||'')==='getDadosAdmin'){
          var aba=(t.dados&&t.dados.nomeAba)||(t.args&&t.args[0])||'';
          var s=screenAba(aba);
          if(s){return dadosAdmin(aba);}
        }
        if(String(t.action||'')==='getDadosRecebimentoAdmin'){
          return {dados:recebimentos(await call('dados_recebimento',false))};
        }
      }
    }
    return base.apply(this,arguments);
  };
  nova.__PSS_ADMIN_EDGE_FAST_V1__=true;nova.__base=base;
  window.apiMulti=nova;try{apiMulti=nova;}catch(e){}
  return true;
}
function instalarApi(){
  var base=window.api;
  if(typeof base!=='function'||base.__PSS_ADMIN_EDGE_FAST_V1__)return false;
  var nova=async function(action,dados,args){
    if(String(action||'')==='getDadosAdmin'){
      var aba=(dados&&dados.nomeAba)||(args&&args[0])||'';
      var s=screenAba(aba);if(s)return dadosAdmin(aba);
    }
    if(String(action||'')==='getDadosRecebimentoAdmin')return {dados:recebimentos(await call('dados_recebimento',false))};
    return base.apply(this,arguments);
  };
  nova.__PSS_ADMIN_EDGE_FAST_V1__=true;nova.__base=base;
  window.api=nova;try{api=nova;}catch(e){}
  return true;
}

function instalarPagamentosDireto(){
  var fn=async function(){
    var p=pagamentos(await call('pagamentos',false));
    var r=recebimentos(await call('dados_recebimento',false));
    window.ESTADO=window.ESTADO||{};
    ESTADO.dadosRecebimentoAdmin=r;
    ESTADO.pagamentosAdminCache={headers:p.headers||[],rows:p.rows||[]};
    return {pag:p,rec:{dados:r}};
  };
  fn.__PSS_ADMIN_EDGE_PAGAMENTOS__=true;
  window.carregarDadosPagamentosAdmin_=fn;
  try{carregarDadosPagamentosAdmin_=fn;}catch(e){}
  return true;
}

function instalarParticipantesDireto(){
  var atual=window.renderParticipantesBolaoAdmin;
  if(atual&&atual.__PSS_ADMIN_EDGE_PARTICIPANTES__)return true;
  var fn=async function(){
    try{
      if(typeof window.PSS_isAdminMestreV308==='function'&&!window.PSS_isAdminMestreV308()){
        if(typeof window.setView==='function')window.setView('<div class="panel"><div class="notice error">Acesso restrito ao administrador mestre.</div></div>');
        return;
      }
      var r=participantes(await call('participantes',false));
      var headers=r.headers||[],rows=r.rows||[];
      var fmt=typeof window.formatarCelula==='function'?window.formatarCelula:function(v){return esc(v);};
      var html='<div class="panel"><h2>Participantes Bolão</h2><p>Participantes vinculados aos bolões cadastrados.</p><div class="actions"><button class="btn" onclick="sincronizarAbasParticipantesAdmin()">Sincronizar abas individuais</button><button class="btn btn-light" onclick="renderParticipantesBolaoAdmin()">Atualizar lista</button></div><div id="syncAbasParticipantesResultado"></div>';
      if(headers.length){
        html+='<div class="table-wrap"><table><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(c){return '<td>'+fmt(c)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
      }else html+='<div class="notice warn">Nenhum dado localizado em Participantes.</div>';
      html+='</div>';
      if(typeof window.setView==='function')window.setView(html);
    }catch(err){
      if(typeof window.setView==='function')window.setView('<div class="panel"><div class="notice error">'+esc((err&&err.message)||err)+'</div></div>');
    }
  };
  fn.__PSS_ADMIN_EDGE_PARTICIPANTES__=true;
  window.renderParticipantesBolaoAdmin=fn;
  try{renderParticipantesBolaoAdmin=fn;}catch(e){}
  return true;
}

function instalarResultadosPublicosJson(){
  var atual=window.carregarLetreiroResultadosPublicosV213;
  if(typeof atual!=='function')return false;
  if(atual.__PSS_RESULTADOS_JSON_V13)return true;
  var base=atual;
  var fn=async function(forcar){
    try{
      var url='./dados-publicos.json?v='+(forcar?Date.now():'RESULTADOS_JSON_V13_20260814_2000');
      var r=await fetch(url,{cache:forcar?'no-store':'no-cache'});
      if(!r.ok)throw new Error('dados-publicos HTTP '+r.status);
      var j=await r.json();
      var d=j&&j.resultadosPublicos;
      var valido=!!(d&&((Array.isArray(d.resultados)&&d.resultados.length)||d.letreiroTexto));
      if(!valido)throw new Error('resultadosPublicos ausente');
      try{localStorage.setItem('PSS_RESULTADOS_PUBLICOS_V213',JSON.stringify({ts:Date.now(),dados:d}));}catch(e){}
      if(typeof window.renderLetreiroResultadosPublicosV213==='function'){
        window.renderLetreiroResultadosPublicosV213(d);
        return d;
      }
      return base.apply(this,arguments);
    }catch(err){
      return base.apply(this,arguments);
    }
  };
  fn.__PSS_RESULTADOS_JSON_V13=true;
  fn.__base=base;
  window.carregarLetreiroResultadosPublicosV213=fn;
  try{carregarLetreiroResultadosPublicosV213=fn;}catch(e){}
  return true;
}

function iniciarResultadosPublicosJson(){
  if(!instalarResultadosPublicosJson())return;
  var box=document.getElementById('resultadosPublicosTickerV213');
  if(box&&typeof window.carregarLetreiroResultadosPublicosV213==='function'){
    window.carregarLetreiroResultadosPublicosV213(false).catch(function(){});
  }
}
function totalAprovadosSupabase(lista){
  lista=Array.isArray(lista)?lista:[];
  return lista.filter(function(u){
    var ap=u&&u.aprovado;
    var ok=(ap===true||ap===1||String(ap||'').toUpperCase()==='TRUE'||String(ap||'').toUpperCase()==='SIM');
    var st=String((u&&u.status)||'').trim().toUpperCase();
    return ok && st!=='RECUSADO' && st!=='INATIVO' && st!=='CANCELADO';
  }).length;
}
function aplicarContadorInscritosSupabase(total){
  total=Number(total)||0;
  if(total<=0)return false;
  var card=document.getElementById('sistemaAtivoCardV275')||document.querySelector('[id^="sistemaAtivoCard"]');
  if(!card)return false;
  var alterou=false;
  [].slice.call(card.querySelectorAll('button')).forEach(function(b){
    if(/inscritos\s*:/i.test(String(b.textContent||''))){
      b.textContent='👥 Inscritos: '+total;
      alterou=true;
    }
  });
  try{
    window.PSS_RESUMO_INSCRITOS_TOPO=Object.assign({},window.PSS_RESUMO_INSCRITOS_TOPO||{},{totalAprovadosSite:total,totalInscritosSite:total,totalInscritos:total,total:total,origem:'SUPABASE_USUARIOS'});
  }catch(e){}
  return alterou;
}
async function atualizarContadorInscritosSupabase(forcar){
  try{
    var lista=await call('usuarios',!!forcar);
    var total=totalAprovadosSupabase(lista);
    if(total>0)aplicarContadorInscritosSupabase(total);
    return total;
  }catch(e){return 0;}
}
function instalarContadorInscritosSupabase(){
  if(window.PSS_CONTADOR_INSCRITOS_SUPABASE_V14)return true;
  window.PSS_CONTADOR_INSCRITOS_SUPABASE_V14=true;
  var baseInicio=window.renderInicio;
  if(typeof baseInicio==='function'&&!baseInicio.__PSS_INSCRITOS_SUPABASE_V14){
    var novo=async function(){
      var r=await baseInicio.apply(this,arguments);
      [80,250,700,1500].forEach(function(ms){setTimeout(function(){atualizarContadorInscritosSupabase(false);},ms);});
      return r;
    };
    novo.__PSS_INSCRITOS_SUPABASE_V14=true;
    novo.__base=baseInicio;
    window.renderInicio=novo;
    try{renderInicio=novo;}catch(e){}
  }
  [0,150,500,1200,2500].forEach(function(ms){setTimeout(function(){atualizarContadorInscritosSupabase(false);},ms);});
  return true;
}

function instalar(){instalarApiMulti();instalarApi();instalarPagamentosDireto();instalarParticipantesDireto();instalarResultadosPublicosJson();instalarContadorInscritosSupabase();}
instalar();[50,150,400,1000,2500,5000].forEach(function(ms){setTimeout(instalar,ms);});[0,100,300,800,1600,3000].forEach(function(ms){setTimeout(iniciarResultadosPublicosJson,ms);});
window.PSS_ADMIN_EDGE_FAST={version:'V1.4_INSCRITOS_SUPABASE',call:call,clear:function(){CACHE={};},status:function(){return {cache:Object.keys(CACHE),source:window.PSS_LAST_DATA_SOURCE||null,pagamentosDireto:!!(window.carregarDadosPagamentosAdmin_&&window.carregarDadosPagamentosAdmin_.__PSS_ADMIN_EDGE_PAGAMENTOS__),participantesDireto:!!(window.renderParticipantesBolaoAdmin&&window.renderParticipantesBolaoAdmin.__PSS_ADMIN_EDGE_PARTICIPANTES__)};}};
})();
