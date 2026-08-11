/* Portal SimonSports — Data Fast Supabase V1
 * Somente camada de dados. NÃO altera HTML, CSS, menus, botões ou renderizadores.
 * Leituras usam Supabase; gravações continuam no fluxo existente até validação específica.
 */
(function(){
'use strict';
if(window.PSS_DATA_FAST_SUPABASE_V1)return;
window.PSS_DATA_FAST_SUPABASE_V1=true;

var CFG=null,BOOT=null,BOOT_PROMISE=null,TOKEN_CACHE={token:'',exp:0};
var BOOT_TTL=5*60*1000;
function norm(v){return String(v==null?'':v).trim().toUpperCase();}
function camel(v){return String(v||'').toLowerCase().replace(/_([a-z])/g,function(_,c){return c.toUpperCase();});}
function decodeJwt(t){try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch(e){return {};}}
async function cfg(){
 if(CFG)return CFG;
 var r=await fetch('./api/supabase-public.json?v=DATA_FAST_V1',{cache:'force-cache'});
 if(!r.ok)throw new Error('SUPABASE_CONFIG_'+r.status);
 var j=await r.json();
 CFG={url:String(j.url||j.supabaseUrl||'').replace(/\/$/,''),key:String(j.publishableKey||j.key||j.anonKey||'')};
 if(!CFG.url||!CFG.key)throw new Error('SUPABASE_CONFIG_INVALIDA');
 return CFG;
}
function firebaseUser(){
 try{if(window.FIREBASE_AUTH&&FIREBASE_AUTH.currentUser)return FIREBASE_AUTH.currentUser;}catch(e){}
 try{if(window.firebase&&firebase.auth&&firebase.auth().currentUser)return firebase.auth().currentUser;}catch(e){}
 return null;
}
async function token(){
 if(TOKEN_CACHE.token&&Date.now()<TOKEN_CACHE.exp-60000)return TOKEN_CACHE.token;
 var u=firebaseUser();
 if(!u||typeof u.getIdToken!=='function')throw new Error('FIREBASE_SEM_USUARIO');
 var t=await u.getIdToken(false),cl=decodeJwt(t);
 if(cl.role!=='authenticated')t=await u.getIdToken(true);
 cl=decodeJwt(t);TOKEN_CACHE={token:t,exp:Number(cl.exp||0)*1000};
 return t;
}
async function rpc(fn,body,auth){
 var c=await cfg(),headers={apikey:c.key,'Content-Type':'application/json'};
 if(auth!==false)headers.Authorization='Bearer '+await token();
 var ctrl=new AbortController(),tm=setTimeout(function(){ctrl.abort();},4500),ini=performance.now();
 try{
   var r=await fetch(c.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:headers,body:JSON.stringify(body||{}),signal:ctrl.signal,cache:'no-store'});
   if(!r.ok)throw new Error('SUPABASE_'+fn+'_'+r.status+'_'+(await r.text()).slice(0,120));
   var j=await r.json();
   window.PSS_DATA_FAST_LAST={fn:fn,ms:Math.round(performance.now()-ini),ts:Date.now()};
   return j;
 }finally{clearTimeout(tm);}
}
function cacheKey(){var u=firebaseUser();return 'PSS_SB_BOOT_V1_'+String((u&&u.uid)||'').slice(0,24);}
function cacheRead(){try{var x=JSON.parse(sessionStorage.getItem(cacheKey())||'null');if(x&&Date.now()-x.ts<BOOT_TTL&&x.data&&x.data.ok)return x.data;}catch(e){}return null;}
function cacheWrite(x){try{sessionStorage.setItem(cacheKey(),JSON.stringify({ts:Date.now(),data:x}));}catch(e){}}
async function bootstrap(force){
 if(!force&&BOOT)return BOOT;
 if(!force){var c=cacheRead();if(c){BOOT=c;refreshSoon();return c;}}
 if(BOOT_PROMISE&&!force)return BOOT_PROMISE;
 BOOT_PROMISE=rpc('pss_frontend_bootstrap_fast',{},true).then(function(x){BOOT=x;cacheWrite(x);return x;}).finally(function(){BOOT_PROMISE=null;});
 return BOOT_PROMISE;
}
function refreshSoon(){setTimeout(function(){bootstrap(true).catch(function(){});},80);}
function invalidate(){BOOT=null;try{sessionStorage.removeItem(cacheKey());}catch(e){}setTimeout(function(){bootstrap(true).catch(function(){});},250);}

function table(headers,rows){return {headers:headers,rows:rows};}
function val(o,k){return o&&o[k]!==undefined&&o[k]!==null?o[k]:'';}
function tabUsuarios(a){var h=['ID','NOME','EMAIL','TELEFONE','STATUS','PERFIL','APROVADO','FIREBASE_UID','CRIADO_EM','ATUALIZADO_EM'];return table(h,(a||[]).map(function(x){return [val(x,'id'),val(x,'nome'),val(x,'email'),val(x,'telefone'),val(x,'status'),val(x,'perfil'),val(x,'aprovado'),val(x,'firebase_uid'),val(x,'created_at'),val(x,'updated_at')];}));}
function tabParticipantes(a){var h=['ID','BOLAO_ID','BOLAO','USUARIO_ID','NOME','EMAIL','STATUS','INSCRITO','COTAS_CONFIRMADAS','COTAS_PENDENTES','COTAS_RESERVADAS','CRIADO_EM','ATUALIZADO_EM'];return table(h,(a||[]).map(function(x){return [val(x,'id'),val(x,'bolao_id'),val(x,'bolao_nome'),val(x,'usuario_id'),val(x,'usuario_nome'),val(x,'usuario_email'),val(x,'status'),val(x,'inscrito'),val(x,'cotas_confirmadas'),val(x,'cotas_pendentes'),val(x,'cotas_reservadas'),val(x,'created_at'),val(x,'updated_at')];}));}
function tabPagamentos(a){var h=['DATA','EMAIL','LOTERIA','URL_COMPROVANTE','STATUS','PAGADOR','VALOR','ID_TRANSACAO','AUTENTICACAO','ARQUIVO_URL','RECEBEDOR','PIX_DESTINO','VALIDACAO','MES_REFERENCIA','TIPO_COTA','IDENTIFICADOR','PARTES_COTA','PARTICIPANTES_COTA'];return table(h,(a||[]).map(function(x){return [x.data_pagamento||x.created_at||'',x.usuario_email||'',x.bolao_nome||x.bolao_id||'','',x.status||'',x.pagador||'',x.valor||x.valor_transferido||0,x.id_transacao||x.legacy_id||'',x.autenticacao||'',x.arquivo_url||'',x.recebedor||'',x.pix_destino||'',x.validacao||x.observacao||'',x.mes_referencia||'',x.tipo_cota||'',x.id||'',x.fracao_cota||'',x.qtd_cotas||''];}));}
function tabSolicitacoes(a){var h=['ID','DATA_SOLICITACAO','NOME','NOME_PUBLICO','EMAIL','TELEGRAM','CELULAR','STATUS','COTAS','TIPO','COMPROVANTE','BOLAO','ACEITE_REGULAMENTO','DATA_ACEITE_REGULAMENTO','VERSAO_REGULAMENTO','CPF','RECEBER_AVISO_NOVO_BOLAO','ORIGEM','OBS_ADMIN','LEGACY_ROW'];return table(h,(a||[]).map(function(x){return h.map(function(k){return val(x,k.toLowerCase());});}));}
function tabBase(a){var h=['NOME','QTD_MIN','QTD_MAX','RANGE','QTD_PALPITE','IMAGEM_ID','QTD_SORTEADA','FAIXAS_PREMIACAO','EXIBIR_PROBABILIDADE'];return table(h,(a||[]).map(function(x){return [x.nome,x.qtd_min,x.qtd_max,x.faixa_numeros,x.qtd_palpite,x.imagem_id,x.qtd_sorteada,x.faixas_premiacao,x.exibir_probabilidade];}));}
function genericTable(a){a=a||[];if(!a.length)return table([],[]);var keys=Object.keys(a[0]);return table(keys.map(function(k){return k.toUpperCase();}),a.map(function(x){return keys.map(function(k){return val(x,k);});}));}
function recebimentoCamel(a){return (a||[]).map(function(x){return {id:x.id||'',linha:x.legacy_row||'',loteria:x.loteria||'',tipoRecebimento:x.tipo_recebimento||'PIX',nomeCompleto:x.nome_completo||'',tipoPix:x.tipo_pix||'',chavePix:x.chave_pix||'',banco:x.banco||'',agencia:x.agencia||'',conta:x.conta||'',operacao:x.operacao||'',obs:x.obs||'',ativo:x.ativo===false?'NÃO':'SIM'};});}

async function leitura(action,dados,args){
 var a=String(action||''),n=norm(a),b;
 if(n==='GETREGULAMENTO'||n==='OBTERREGULAMENTO'||n==='GETREGULAMENTORAPIDOV222')return rpc('pss_regulamento_atual',{},false);
 if(n==='GETRESULTADOSLOTERIASPUBLICOS'||n==='ULTIMOSRESULTADOSPUBLICOS')return rpc('pss_resultados_publicos',{},false);
 if(n==='GETCONFIGPUBLICA'||n==='GETTELEGRAMCANALLINK'){
   try{b=await bootstrap(false);return n==='GETTELEGRAMCANALLINK'?(b.configPublica.telegramCanalLink||b.configPublica.TELEGRAM_CANAL_LINK||''):b.configPublica;}catch(e){return rpc('pss_configuracoes_publicas',{},false);}
 }
 b=await bootstrap(false);
 if(n==='GETLOTERIASPAGAMENTOATIVAS'||n==='LISTARBOLOES'||n==='GETCONFIGBOLOESRAPIDOV233'||n==='LISTARCONFIGBOLOESRAPIDOV233'||n==='GETBOLOESATIVOS')return b.boloes||[];
 if(n==='GETESTATISTICASATIVAUSUARIO'||n==='GETESTATISTICASATIVA'||n==='DASHBOARD')return b.dashboard||{};
 if(n==='GETRESUMOINSCRITOSBOLOES'||n==='RESUMOINSCRITOSBOLOES')return b.resumoInscritos||{};
 if(n==='GETDADOSRECEBIMENTO'||n==='LISTARDADOSRECEBIMENTO'){
   var lot=(dados&&dados.loteria)||(args&&args.length?args[args.length-1]:'');
   if(!lot)return b.dadosRecebimento||[];
   return (b.dadosRecebimento||[]).filter(function(x){return norm(x.loteria)===norm(lot)||norm(lot).indexOf(norm(x.loteria))>=0||norm(x.loteria).indexOf(norm(lot))>=0;});
 }
 if(n==='GETHISTORICOCOMPROVANTES'||n==='HISTORICOCOMPROVANTES')return b.historicoComprovantes||[];
 if(n==='OBTERDADOSPALPITE'||n==='GETDADOSPALPITE')return rpc('pss_palpite_info',{p_bolao:(dados&&dados.loteria)||(args&&args[0])||''},true);
 if(n==='CHECARSTATUSPALPITE'||n==='GETSTATUSPALPITE')return rpc('pss_palpite_status',{p_bolao:(dados&&dados.loteria)||(args&&args[1])||(args&&args[0])||''},true);
 if(n==='GETJOGOSREALIZADOSBOLAO'||n==='LISTARJOGOSREALIZADOSBOLAO'||n==='GETJOGOSBOLAO')return rpc('pss_jogos_realizados',{p_loteria:(dados&&dados.loteria)||(args&&args[1])||(args&&args[0])||''},true);
 if(n==='GETDADOSRECEBIMENTOADMIN')return {dados:recebimentoCamel((b.admin&&b.admin.dadosRecebimento)||[])};
 if(n==='GETBASELOTERIASTEMPLATES'||n==='LISTARBASELOTERIASTEMPLATES')return (b.admin&&b.admin.baseLoterias)||[];
 if(n==='GETDADOSADMIN'){
   var aba=norm((dados&&dados.nomeAba)||(args&&args[0])||'');var ad=b.admin||{};
   if(aba==='USUARIOS')return tabUsuarios(ad.usuarios);
   if(aba==='PAGAMENTOS')return tabPagamentos(ad.pagamentos);
   if(aba==='PARTICIPANTES_BOLAO'||aba==='PARTICIPANTES')return tabParticipantes(ad.participantes);
   if(aba==='SOLICITACOES_CADASTRO')return tabSolicitacoes(ad.solicitacoes);
   if(aba==='BASE_LOTERIAS')return tabBase(ad.baseLoterias);
   if(aba==='DADOS_RECEBIMENTO')return genericTable(ad.dadosRecebimento);
   if(aba==='CONFIG')return genericTable(ad.configuracoes);
 }
 return undefined;
}
var READ_NAMES={};[
'getRegulamento','obterRegulamento','getRegulamentoRapidoV222','getResultadosLoteriasPublicos','ultimosResultadosPublicos','getConfigPublica','getTelegramCanalLink','getLoteriasPagamentoAtivas','listarBoloes','getConfigBoloesRapidoV233','listarConfigBoloesRapidoV233','getBoloesAtivos','getEstatisticasAtivaUsuario','getEstatisticasAtiva','dashboard','getResumoInscritosBoloes','resumoInscritosBoloes','getDadosRecebimento','listarDadosRecebimento','getHistoricoComprovantes','historicoComprovantes','obterDadosPalpite','getDadosPalpite','checarStatusPalpite','getStatusPalpite','getJogosRealizadosBolao','listarJogosRealizadosBolao','getJogosBolao','getDadosRecebimentoAdmin','getBaseLoteriasTemplates','listarBaseLoteriasTemplates','getDadosAdmin'
].forEach(function(x){READ_NAMES[norm(x)]=1;});
function isRead(a){return !!READ_NAMES[norm(a)];}
function instalar(){
 var baseApi=window.api,baseMulti=window.apiMulti;
 if(typeof baseApi==='function'&&!baseApi.__PSS_DATA_FAST_V1__){
   var na=async function(action,dados,args){
     if(isRead(action)){try{var x=await leitura(action,dados,args);if(x!==undefined)return x;}catch(e){window.PSS_DATA_FAST_ERROR=String((e&&e.message)||e);}}
     var r=await baseApi.apply(this,arguments);if(!isRead(action))invalidate();return r;
   };na.__PSS_DATA_FAST_V1__=true;na.__base=baseApi;window.api=na;try{api=na;}catch(e){}
 }
 if(typeof baseMulti==='function'&&!baseMulti.__PSS_DATA_FAST_V1__){
   var nm=async function(tentativas){
     if(Array.isArray(tentativas)){
       for(var i=0;i<tentativas.length;i++){var t=tentativas[i]||{};if(isRead(t.action)){try{var x=await leitura(t.action,t.dados,t.args);if(x!==undefined)return x;}catch(e){window.PSS_DATA_FAST_ERROR=String((e&&e.message)||e);break;}}}
     }
     var r=await baseMulti.apply(this,arguments);
     if(Array.isArray(tentativas)&&tentativas.some(function(t){return t&&!isRead(t.action);})){invalidate();}
     return r;
   };nm.__PSS_DATA_FAST_V1__=true;nm.__base=baseMulti;window.apiMulti=nm;try{apiMulti=nm;}catch(e){}
 }
}
function prefetch(){var tries=0,tm=setInterval(function(){tries++;instalar();if(firebaseUser()){clearInterval(tm);bootstrap(false).catch(function(){});}else if(tries>80)clearInterval(tm);},125);}
window.PSS_DATA_FAST={version:'V1',bootstrap:function(force){return bootstrap(!!force);},invalidate:invalidate,status:function(){return {boot:!!BOOT,pending:!!BOOT_PROMISE,last:window.PSS_DATA_FAST_LAST||null,error:window.PSS_DATA_FAST_ERROR||''};}};
instalar();prefetch();[500,1500,3500].forEach(function(ms){setTimeout(instalar,ms);});
})();
