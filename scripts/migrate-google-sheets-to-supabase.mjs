import { google } from 'googleapis';

const SHEET_ID=process.env.LEGACY_SHEET_ID||'1SZ5Kv2toGL340kzZX_c_mM8_eK-L352nQmYDbUZdo2M';
const SUPABASE_URL=process.env.SUPABASE_URL||'https://nsaoekahczonljpozyvy.supabase.co';
const ADMIN_KEY=process.env.SUPABASE_ADMIN_KEY||'';
const GOOGLE_RAW=process.env.GOOGLE_SERVICE_JSON||'';
if(!ADMIN_KEY)throw new Error('SUPABASE_ADMIN_KEY ausente.');
if(!GOOGLE_RAW)throw new Error('GOOGLE_SERVICE_JSON ausente.');
const credentials=JSON.parse(GOOGLE_RAW);
const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
const sheetsApi=google.sheets({version:'v4',auth});
const norm=v=>String(v??'').trim();
const normKey=v=>norm(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const normText=v=>norm(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const yes=v=>['sim','s','true','1','yes','ativo','aprovado'].includes(norm(v).toLowerCase());
function num(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;let s=norm(v).replace(/^R\$\s*/i,'').replace(/\s/g,'');if(!s)return null;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null}
const int=v=>{const n=num(v);return n===null?null:Math.trunc(n)};
function dateIso(v,withTime=false){const s=norm(v);if(!s)return null;let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(m){const b=`${m[3]}-${m[2]}-${m[1]}`;if(withTime&&m[4])return `${b}T${String(m[4]).padStart(2,'0')}:${m[5]}:${m[6]||'00'}-03:00`;return withTime?`${b}T12:00:00-03:00`:b}m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return withTime?`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`:`${m[1]}-${m[2]}-${m[3]}`;return null}
function uniqueHeaders(row){const seen=new Map();return row.map((h,i)=>{let k=normKey(h)||`COL_${i+1}`;const n=(seen.get(k)||0)+1;seen.set(k,n);return n===1?k:`${k}_${n}`})}
function rowsToObjects(values){if(!values?.length)return[];const headers=uniqueHeaders(values[0]);return values.slice(1).map((row,idx)=>{const o={__row:idx+2};headers.forEach((h,i)=>o[h]=row[i]??null);return o}).filter(o=>Object.entries(o).some(([k,v])=>k!=='__row'&&norm(v)!==''))}
async function sheetValues(name){const r=await sheetsApi.spreadsheets.values.get({spreadsheetId:SHEET_ID,range:`'${String(name).replace(/'/g,"''")}'`,valueRenderOption:'FORMATTED_VALUE',dateTimeRenderOption:'FORMATTED_STRING'});return r.data.values||[]}
async function sb(path,{method='GET',body,prefer}={}){const headers={apikey:ADMIN_KEY,Authorization:`Bearer ${ADMIN_KEY}`};if(body!==undefined)headers['Content-Type']='application/json';if(prefer)headers.Prefer=prefer;const res=await fetch(`${SUPABASE_URL}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();if(!res.ok)throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0,1200)}`);if(!text)return null;try{return JSON.parse(text)}catch{return text}}
async function insertMany(table,rows,onConflict=null,chunk=200){if(!rows.length)return;for(let i=0;i<rows.length;i+=chunk){const part=rows.slice(i,i+chunk),q=onConflict?`?on_conflict=${encodeURIComponent(onConflict)}`:'';await sb(`/rest/v1/${table}${q}`,{method:'POST',body:part,prefer:onConflict?'resolution=merge-duplicates,return=minimal':'return=minimal'})}}
const patchWhere=(table,query,data)=>sb(`/rest/v1/${table}?${query}`,{method:'PATCH',body:data,prefer:'return=representation'});
const getWhere=(table,query='',select='*')=>sb(`/rest/v1/${table}?${query}${query?'&':''}select=${encodeURIComponent(select)}`);
async function upsertByEmail(table,email,data){const q=`email=eq.${encodeURIComponent(email)}`,found=await getWhere(table,q,'id');if(found?.length)return patchWhere(table,q,data);return sb(`/rest/v1/${table}`,{method:'POST',body:{...data,email},prefer:'return=representation'})}

const meta=await sheetsApi.spreadsheets.get({spreadsheetId:SHEET_ID,fields:'sheets.properties.title'});
const sheetNames=(meta.data.sheets||[]).map(s=>s.properties.title),cache=new Map();
async function get(name){if(!cache.has(name))cache.set(name,await sheetValues(name));return cache.get(name)}
console.log(`Fonte localizada: ${sheetNames.length} abas.`);

// Configurações: credenciais são excluídas.
{
 const rows=rowsToObjects(await get('Config')),publicKeys=new Set(['LOTERIA_ATIVA','APP_NAME','TZ','TELEGRAM_CANAL_LINK','QTD_NUMEROS_PALPITADOS','LOTERIAS_ATIVAS']),out=[];
 for(const r of rows){const chave=norm(r.CHAVE);if(!chave||['SENHA_ADMIN','TELEGRAM_BOT_TOKEN'].includes(normKey(chave)))continue;out.push({chave,valor:r.VALOR??null,publico:publicKeys.has(normKey(chave)),descricao:'Migrado da base Google sem credenciais'})}
 await insertMany('configuracoes',out,'chave');console.log(`Configurações: ${out.length}`);
}
// Base loterias.
{
 const rows=rowsToObjects(await get('BASE_LOTERIAS')).map(r=>({nome:norm(r.NOME),qtd_min:int(r.QTD_MIN)||0,qtd_max:int(r.QTD_MAX)||0,faixa_numeros:int(r.RANGE)||0,qtd_palpite:int(r.QTD_PALPITE)||10,imagem_id:norm(r.IMAGEM_ID)||null,qtd_sorteada:int(r.QTD_SORTEADA)||0,faixas_premiacao:norm(r.FAIXAS_PREMIACAO)||null,exibir_probabilidade:yes(r.EXIBIR_PROBABILIDADE)})).filter(r=>r.nome);
 await insertMany('base_loterias',rows,'nome');console.log(`Base loterias: ${rows.length}`);
}
// Dados de recebimento.
{
 const rows=rowsToObjects(await get('DADOS_RECEBIMENTO')),existing=await getWhere('dados_recebimento','','id,loteria,tipo_recebimento'),map=new Map((existing||[]).map(x=>[`${normText(x.loteria)}|${normText(x.tipo_recebimento)}`,x.id]));
 for(const r of rows){const data={loteria:norm(r.LOTERIA),tipo_recebimento:norm(r.TIPO_RECEBIMENTO)||'PIX',nome_completo:norm(r.NOME_COMPLETO),tipo_pix:norm(r.TIPO_PIX)||null,chave_pix:norm(r.CHAVE_PIX)||null,banco:norm(r.BANCO)||null,agencia:norm(r.AGENCIA)||null,conta:norm(r.CONTA)||null,operacao:norm(r.OPERACAO)||null,obs:norm(r.OBS)||null,ativo:yes(r.ATIVO)};if(!data.loteria||!data.nome_completo)continue;const id=map.get(`${normText(data.loteria)}|${normText(data.tipo_recebimento)}`);if(id)await patchWhere('dados_recebimento',`id=eq.${id}`,data);else await sb('/rest/v1/dados_recebimento',{method:'POST',body:data,prefer:'return=minimal'})}
 console.log(`Dados recebimento: ${rows.length}`);
}
// Regulamento integral.
{
 const vals=await get('REGULAMENTO'),texto=vals.map(r=>norm(r[0])).join('\n').trim(),configRows=rowsToObjects(await get('Config')),versao=norm(configRows.find(r=>normKey(r.CHAVE)==='VERSAO_REGULAMENTO')?.VALOR)||'2026.2';
 await sb('/rest/v1/regulamentos?ativo=eq.true',{method:'PATCH',body:{ativo:false},prefer:'return=minimal'});await insertMany('regulamentos',[{versao,titulo:'REGULAMENTO DO BOLÃO — LOTERIAS ESPECIAIS',texto,ativo:true}],'versao');console.log(`Regulamento: ${texto.length} caracteres`);
}
if(sheetNames.includes('Config_Paginas')){const rows=rowsToObjects(await get('Config_Paginas')).map(r=>({pagina:norm(r.PAGINA),admin:yes(r.ADMIN),usuario:yes(r.USUARIO),privado:yes(r.PRIVADO)})).filter(r=>r.pagina);await insertMany('permissoes_paginas',rows,'pagina');console.log(`Permissões: ${rows.length}`)}
// Perfis existentes, sem senha.
{
 const rows=rowsToObjects(await get('Usuarios'));
 for(const r of rows){const email=norm(r.EMAIL).toLowerCase();if(!email)continue;const current=await getWhere('usuarios',`email=eq.${encodeURIComponent(email)}`,'id');if(!current?.length)continue;await patchWhere('usuarios',`id=eq.${current[0].id}`,{nome:norm(r.NOME)||null,nome_publico:norm(r.NOME_PUBLICO)||null,telefone:norm(r.CELULAR||r.TELEGRAM)||null,status:norm(r.STATUS)||'ATIVO',perfil:norm(r.PERFIL)||'PARTICIPANTE',aprovado:['ativo','aprovado'].includes(norm(r.STATUS).toLowerCase()),receber_aviso_novo_bolao:yes(r.RECEBER_AVISO_NOVO_BOLAO),legacy_id:norm(r.ID)||null})}
 console.log(`Perfis conferidos: ${rows.length}`);
}
// Solicitações, sem senha.
{
 const rows=rowsToObjects(await get('SOLICITACOES_CADASTRO'));
 for(const r of rows){const email=norm(r.EMAIL).toLowerCase();if(!email)continue;await upsertByEmail('solicitacoes_cadastro',email,{data_solicitacao:dateIso(r.DATA,true)||new Date().toISOString(),nome:norm(r.NOME),nome_publico:norm(r.NOME_PUBLICO)||null,telegram:norm(r.TELEGRAM)||null,celular:norm(r.CELULAR)||null,status:norm(r.STATUS)||'PENDENTE',cotas:norm(r.COTAS)||null,tipo:norm(r.TIPO)||null,comprovante:norm(r.COMPROVANTE)||null,bolao:norm(r.BOLAO)||null,aceite_regulamento:yes(r.ACEITE_REGULAMENTO),data_aceite_regulamento:dateIso(r.DATA_ACEITE_REGULAMENTO,true),versao_regulamento:norm(r.VERSAO_REGULAMENTO)||null,cpf:norm(r.CPF)||null,receber_aviso_novo_bolao:yes(r.RECEBER_AVISO_NOVO_BOLAO),origem:norm(r.ORIGEM)||null,obs_admin:norm(r.OBS_ADMIN)||null,processado_usuarios:yes(r.PROCESSADO_USUARIOS),id_usuario_gerado:norm(r.ID_USUARIO_GERADO)||null,data_processamento:dateIso(r.DATA_PROCESSAMENTO,true),erro_aprovacao:norm(r.ERRO_APROVACAO)||null,data_erro_aprovacao:dateIso(r.DATA_ERRO_APROVACAO,true),aba_id:norm(r.ABA_ID)||null,email_acesso_enviado_em:dateIso(r.EMAIL_ACESSO_ENVIADO_EM,true),erro_envio_email:norm(r.ERRO_ENVIO_EMAIL)||null,legacy_row:r.__row})}
 console.log(`Solicitações: ${rows.length}`);
}
// Eventos especiais.
if(sheetNames.includes('EVENTOS_ESPECIAIS')){const rows=rowsToObjects(await get('EVENTOS_ESPECIAIS')).map(r=>({id:norm(r.ID),nome:norm(r.NOME),loteria:norm(r.NOME),status:norm(r.STATUS)||'INATIVO',status_original:norm(r.STATUS)||null,status_real:norm(r.STATUS_OPERACIONAL)||null,data_sorteio:dateIso(r.DATA_SORTEIO),inicio_pagamento:dateIso(r.INI_BOL),fim_pagamento:dateIso(r.FIM_BOL),inicio_palpite:dateIso(r.INI_PAL),fim_palpite:dateIso(r.FIM_PAL),valor_cota:num(r.VALOR_COTA),total_cotas:num(r.TOTAL_COTAS),cotas_adquiridas:num(r.COTAS_TOTAIS_ADQUIRIDAS)||0,cotas_disponiveis:num(r.TOTAL_COTAS)!==null?Math.max((num(r.TOTAL_COTAS)||0)-(num(r.COTAS_TOTAIS_ADQUIRIDAS)||0),0):null,qtd_parcelas:int(r.QTD_PARCELAS)||1,premiacao:num(r.PREMIACAO)||0,premio_por_cota:num(r.PREMIO_POR_COTA)||0,faixa_numeros:int(r.RANGE),qtd_min:int(r.QTD_MIN),qtd_max:int(r.QTD_MAX),qtd_palpite:int(r.QTD_PALPITE),historico:norm(r.STATUS).toUpperCase().includes('HIST'),numeros_sorteados:norm(r.NUMEROS_SORTEADOS)||null})).filter(r=>r.id&&r.nome);await insertMany('boloes',rows,'id');console.log(`Eventos: ${rows.length}`)}
// Jogos realizados.
if(sheetNames.includes('JOGOS_REALIZADOS')){const rows=rowsToObjects(await get('JOGOS_REALIZADOS')),exist=await getWhere('jogos_realizados','legacy_id=not.is.null','legacy_id'),have=new Set((exist||[]).map(x=>x.legacy_id));for(const r of rows){const legacy=`JOGOS_REALIZADOS:${r.__row}`;if(have.has(legacy))continue;const data={loteria:norm(r.LOTERIA),concurso:norm(r.CONCURSO)||null,data_jogo:dateIso(r.DATA_JOGO),mes_referencia:norm(r.MES_REFERENCIA)||null,obs:norm(r.OBS)||null,nome_arquivo:norm(r.NOME_ARQUIVO)||null,mime_type:norm(r.MIME_TYPE)||null,legacy_drive_url:norm(r.URL)||null,image_url:norm(r.IMAGE_URL)||null,status:norm(r.STATUS)||'ATIVO',legacy_id:legacy};if(data.loteria)await sb('/rest/v1/jogos_realizados',{method:'POST',body:data,prefer:'return=minimal'})}console.log(`Jogos: ${rows.length}`)}
// Enriquecer os 46 pagamentos normalizados sem copiar OCR bruto.
if(sheetNames.includes('PAGAMENTOS')){const src=rowsToObjects(await get('PAGAMENTOS')),users=await getWhere('usuarios','','id,email'),bols=await getWhere('boloes','','id,nome,loteria'),pays=await getWhere('pagamentos','','id,legacy_id,usuario_id,bolao_id,valor,created_at'),uEmail=new Map((users||[]).map(x=>[x.id,norm(x.email).toLowerCase()])),bName=new Map((bols||[]).map(x=>[x.id,[normText(x.nome),normText(x.loteria)]])),used=new Set();for(const r of src){const email=norm(r.EMAIL).toLowerCase(),lot=normText(r.LOTERIA),value=num(r.VALOR);let cand=(pays||[]).filter(p=>!used.has(p.id)&&uEmail.get(p.usuario_id)===email&&(bName.get(p.bolao_id)||[]).some(n=>n&&(n===lot||n.includes(lot)||lot.includes(n)))&&(value===null||Math.abs(Number(p.valor||0)-value)<.011));if(!cand.length)cand=(pays||[]).filter(p=>!used.has(p.id)&&uEmail.get(p.usuario_id)===email&&(value===null||Math.abs(Number(p.valor||0)-value)<.011));if(!cand.length)continue;const p=cand[0];used.add(p.id);await patchWhere('pagamentos',`id=eq.${p.id}`,{id_transacao:norm(r.ID_TRANSACAO)||null,autenticacao:norm(r.AUTENTICACAO)||null,validacao:norm(r.VALIDACAO)||null,mes_referencia:norm(r.MES_REFERENCIA)||null,tipo_cota:norm(r.TIPO_COTA)||null,fracao_cota:num(r.FRACAO_COTA),qtd_cotas:num(r.QTD_COTAS_COMPROVANTE??r.QTD_COTAS),cotas_equivalentes:num(r.COTAS_EQUIVALENTES),valor_esperado:num(r.VALOR_ESPERADO),valor_transferido:num(r.VALOR_TRANSFERIDO??r.VALOR),nome_arquivo:norm(r.NOME_ARQUIVO)||null,mime_type:norm(r.MIME_TYPE)||null,arquivo_url:norm(r.ARQUIVO_URL??r.URL_COMPROVANTE)||null,processamento_status:norm(r.PROCESSAMENTO_STATUS)||null,data_transferencia:dateIso(r.DATA_TRANSFERENCIA,true),data_comprovante:dateIso(r.DATA_COMPROVANTE,true),tipo_comprovante:norm(r.TIPO_COMPROVANTE)||null,forma_pagamento:norm(r.FORMA_PAGAMENTO)||null,banco_destino:norm(r.BANCO_DESTINO)||null,agencia_destino:norm(r.AGENCIA_DESTINO)||null,operacao_destino:norm(r.OPERACAO_DESTINO)||null,conta_destino:norm(r.CONTA_DESTINO)||null})}console.log(`Pagamentos enriquecidos: ${used.size}/${src.length}`)}
// Logs.
for(const [sheet,canal] of [['LOG_TELEGRAM_BOLOES','TELEGRAM'],['LOG_EMAIL_BOLOES','EMAIL']]){if(!sheetNames.includes(sheet))continue;const rows=rowsToObjects(await get(sheet)),existing=await getWhere('notificacoes_log',`canal=eq.${canal}&legacy_row=not.is.null`,'legacy_row'),have=new Set((existing||[]).map(x=>Number(x.legacy_row))),out=[];for(const r of rows){if(have.has(r.__row))continue;out.push({canal,bolao_id:norm(r.ID_BOLAO)||null,loteria:norm(r.LOTERIA)||null,destinatario:canal==='EMAIL'?norm(r.EMAIL)||null:null,tipo:norm(r.TIPO_AVISO??r.TIPO)||null,status:norm(r.STATUS)||null,mensagem:norm(r.MENSAGEM??r.ASSUNTO)||null,retorno:norm(r.RETORNO_TELEGRAM??r.RETORNO??r.OBS)||null,message_id:norm(r.MESSAGE_ID)||null,versao:norm(r.VERSAO)||null,ocorrido_em:dateIso(r.DATA_HORA,true),legacy_row:r.__row})}await insertMany('notificacoes_log',out,null,200);console.log(`${sheet}: ${out.length} novos`)}
// Snapshot privado sanitizado: preserva todas as abas, exceto dados transitórios. Senha/token/OCR bruto nunca entram.
{
 const skip=new Set(['UPLOAD_CHUNKS_V243','UPLOADS_PENDENTES_V241']),forbidden=/SENHA|PASSWORD|TOKEN|PRIVATE_KEY|OCR_TEXTO_BRUTO/i;let total=0;
 for(const name of sheetNames){if(skip.has(name))continue;const vals=await get(name);if(!vals?.length)continue;const headers=uniqueHeaders(vals[0]),keep=headers.map((h,i)=>({h,i})).filter(x=>!forbidden.test(x.h)),batch=[];for(let ri=1;ri<vals.length;ri++){const row=vals[ri]||[];if(!row.some(v=>norm(v)!==''))continue;const data={};for(const{h,i}of keep)if(row[i]!==undefined&&row[i]!==null&&norm(row[i])!=='')data[h]=row[i];if(Object.keys(data).length)batch.push({origem:name,legacy_row:ri+1,dados:data})}await insertMany('legacy_migracao_snapshot',batch,'origem,legacy_row',150);total+=batch.length}
 console.log(`Snapshot privado: ${total} registros`);
}
console.log('MIGRACAO_DADOS_OK');
