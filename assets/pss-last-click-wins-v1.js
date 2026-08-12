/* Portal SimonSports — Navegação rápida V4
 * Mantém os menus já rápidos e aplica o mesmo caminho direto aos lentos.
 * Sem criar nova camada: usa Supabase Edge e caches já existentes.
 */
(function(){
'use strict';
if(window.PSS_LAST_CLICK_WINS_V4)return;
window.PSS_LAST_CLICK_WINS_V4=true;

var seq=0,currentView='',baseNavigate=null;
var CFG=null,CACHE={},INFLIGHT={},TTL=30000;
function norm(v){return String(v==null?'':v).trim().toUpperCase();}
function edgeFast(){return window.PSS_ADMIN_EDGE_FAST;}
async function cfg(){
  if(CFG)return CFG;
  var r=await fetch('./api/supabase-public.json?v=NAV_FAST_V4',{cache:'force-cache'});
  if(!r.ok)throw new Error('Config Supabase HTTP '+r.status);
  var j=await r.json();
  CFG={url:String(j.url||'').replace(/\/$/,''),key:String(j.publishableKey||j.key||j.anonKey||'')};
  if(!CFG.url||!CFG.key)throw new Error('Supabase nao configurado');
  return CFG;
}
async function token(){
  var u=null;
  try{u=window.FIREBASE_AUTH&&FIREBASE_AUTH.currentUser;}catch(e){}
  if(!u)try{u=window.firebase&&firebase.auth&&firebase.auth().currentUser;}catch(e){}
  if(!u||typeof u.getIdToken!=='function')throw new Error('Firebase sem usuario autenticado');
  return u.getIdToken(false);
}
function keyOf(screen,payload){try{return screen+'|'+JSON.stringify(payload||{});}catch(e){return screen;}}
async function edge(screen,payload,force){
  screen=String(screen||'').toLowerCase();payload=payload||{};
  var f=edgeFast();
  if(!Object.keys(payload).length&&f&&typeof f.call==='function')return f.call(screen,!!force);
  var k=keyOf(screen,payload),now=Date.now();
  if(!force&&CACHE[k]&&now-CACHE[k].ts<TTL)return CACHE[k].data;
  if(!force&&INFLIGHT[k])return INFLIGHT[k];
  var p=(async function(){
    var c=await cfg(),t=await token();
    var ctrl=new AbortController(),tm=setTimeout(function(){ctrl.abort();},5000);
    try{
      var body=Object.assign({screen:screen},payload);
      var r=await fetch(c.url+'/functions/v1/pss-firebase-gateway',{method:'POST',signal:ctrl.signal,cache:'no-store',headers:{apikey:c.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(body)});
      var txt=await r.text(),j={};try{j=JSON.parse(txt||'{}');}catch(e){}
      if(!r.ok||!j.ok)throw new Error((j&&j.erro)||('Gateway HTTP '+r.status));
      var data=Object.prototype.hasOwnProperty.call(j,'data')?j.data:(j.rows||[]);
      CACHE[k]={ts:Date.now(),data:data};return data;
    }finally{clearTimeout(tm);delete INFLIGHT[k];}
  })();
  INFLIGHT[k]=p;return p;
}

function solicitacoesTabela(lista){
  var h=['ID','DATA_SOLICITACAO','NOME','NOME_PUBLICO','EMAIL','TELEGRAM','CELULAR','STATUS','COTAS','TIPO','COMPROVANTE','BOLAO','ACEITE_REGULAMENTO','DATA_ACEITE_REGULAMENTO','VERSAO_REGULAMENTO','CPF','RECEBER_AVISO_NOVO_BOLAO','ORIGEM','OBS_ADMIN','PROCESSADO_USUARIOS','ID_USUARIO_GERADO','DATA_PROCESSAMENTO','ERRO_APROVACAO','DATA_ERRO_APROVACAO','ABA_ID','EMAIL_ACESSO_ENVIADO_EM','ERRO_ENVIO_EMAIL','CRIADO_EM','ATUALIZADO_EM'];
  var keys=h.map(function(x){return x.toLowerCase();});
  return {headers:h,rows:(lista||[]).map(function(x){return keys.map(function(k){return x[k];});})};
}
function baseLoteriasTabela(lista){
  var h=['NOME','QTD_MIN','QTD_MAX','RANGE','QTD_PALPITE','IMAGEM_ID','QTD_SORTEADA','FAIXAS_PREMIACAO','EXIBIR_PROBABILIDADE'];
  return {headers:h,rows:(lista||[]).map(function(x){return [x.nome,x.qtd_min,x.qtd_max,x.faixa_numeros,x.qtd_palpite,x.imagem_id,x.qtd_sorteada,x.faixas_premiacao,x.exibir_probabilidade];})};
}
function pagamentosTabela(lista){
  return {headers:['DATA','EMAIL','LOTERIA','URL_COMPROVANTE','STATUS','PAGADOR','VALOR','ID_TRANSACAO','AUTENTICACAO','ARQUIVO_URL','RECEBEDOR','PIX_DESTINO','VALIDACAO','MES_REFERENCIA','TIPO_COTA','IDENTIFICADOR','PARTES_COTA','PARTICIPANTES_COTA'],rows:(lista||[]).map(function(x){return [x.data_pagamento||x.data_comprovante||x.created_at,x.usuario_email||'',x.bolao_nome||x.bolao_id||'',x.arquivo_url||'',x.status||'',x.pagador||'',x.valor_transferido||x.valor||0,x.id_transacao||x.legacy_id||'',x.autenticacao||'',x.arquivo_url||'',x.recebedor||'',x.pix_destino||'',x.validacao||'',x.mes_referencia||'',x.tipo_cota||'',x.identificador||'',x.partes_cota||'',x.participantes_cota||''];})};
}
function recebimentos(lista){return (lista||[]).map(function(x){return {id:x.id||'',loteria:x.loteria||'',tipoRecebimento:x.tipo_recebimento||'',nomeCompleto:x.nome_completo||'',tipoPix:x.tipo_pix||'',chavePix:x.chave_pix||'',banco:x.banco||'',agencia:x.agencia||'',conta:x.conta||'',operacao:x.operacao||'',obs:x.obs||'',ativo:x.ativo!==false};});}
async function adminRapido(aba){
  var a=norm(aba);
  if(a==='SOLICITACOES_CADASTRO')return solicitacoesTabela(await edge('solicitacoes'));
  if(a==='BASE_LOTERIAS')return baseLoteriasTabela(await edge('base_loterias'));
  if(a==='PAGAMENTOS')return pagamentosTabela(await edge('pagamentos'));
  return null;
}
async function boloesRapido(){
  var lista=await edge('boloes');lista=Array.isArray(lista)?lista:[];
  window.ESTADO=window.ESTADO||{};ESTADO.boloes=lista;
  try{ESTADO.boloesCompletoV267=lista;ESTADO.boloesCompletoV268=lista;ESTADO.boloesCompletoV277=lista;}catch(e){}
  return lista;
}
function configCache(){
  var ks=['PSS_PUBLIC_BOOTSTRAP_V4','PSS_SUPABASE_PUBLIC_SNAPSHOT_V1'];
  for(var i=0;i<ks.length;i++)try{var raw=localStorage.getItem(ks[i]);if(!raw)continue;var o=JSON.parse(raw),d=o&&o.data?o.data:o;if(d&&Array.isArray(d.boloes)&&d.boloes.length)return d;}catch(e){}
  try{var d2=window.PSS_SUPABASE_PUBLIC_DATA;if(d2&&Array.isArray(d2.boloes)&&d2.boloes.length)return d2;}catch(e){}
  return null;
}
function salvarConfigCache(lista){
  if(!Array.isArray(lista)||!lista.length)return;
  var d={boloes:lista,resultadosPublicos:[],configPublica:[]};
  try{localStorage.setItem('PSS_PUBLIC_BOOTSTRAP_V4',JSON.stringify({ts:Date.now(),data:d}));}catch(e){}
  try{window.PSS_SUPABASE_PUBLIC_DATA=d;}catch(e){}
}
function fastAction(action,dados,args){
  var a=String(action||'');
  if(['listarBoloes','getLoteriasPagamentoAtivas','getBoloesAtivos','PSS_getEstruturaSubmenusBoloes'].indexOf(a)>=0)return boloesRapido();
  if(['getHistoricoComprovantes','historicoComprovantes'].indexOf(a)>=0)return edge('comprovantes');
  if(a==='getDadosRecebimentoAdmin')return edge('dados_recebimento').then(function(x){return {dados:recebimentos(x)};});
  if(['obterDadosPalpite','getDadosPalpite'].indexOf(a)>=0){var n=(dados&&dados.loteria)||(args&&args[0])||'';return edge('palpite_info',{loteria:n});}
  if(['checarStatusPalpite','getStatusPalpite'].indexOf(a)>=0){var n2=(dados&&dados.loteria)||(args&&args[1])||(args&&args[0])||'';return edge('palpite_status',{loteria:n2});}
  if(['consultaParticipanteAdmin','getConsultaParticipanteAdmin','consultarParticipanteAdmin'].indexOf(a)>=0){var em=(dados&&dados.participanteEmail)||(dados&&dados.email)||((args&&args[0]&&args[0].participanteEmail)||'');return edge('consulta',{participanteEmail:String(em||'').trim().toLowerCase()});}
  if(['buscarParticipantesComprovanteTerceiroV225','buscarParticipantesComprovanteTerceiro'].indexOf(a)>=0){var q=norm((dados&&dados.query)||(args&&args[0])||'');return edge('consulta',{}).then(function(d){var l=(d&&d.participantes)||[];return l.filter(function(p){return norm((p.nome||'')+' '+(p.nomePublico||'')+' '+(p.email||'')).indexOf(q)>=0;});});}
  return null;
}
function instalarLoaders(){
  var fn=async function(){return boloesRapido();};fn.__PSS_NAV_FAST_V4=true;
  ['carregarBoloes','PSS_carregarBoloesCompletoV267_','PSS_carregarBoloesRapidoV268_','PSS_carregarBoloesV277_'].forEach(function(n){try{window[n]=fn;}catch(e){}try{eval(n+'=fn');}catch(e){}});
}
function instalarConfigRapido(){
  var base=window.PSS_CONFIG_FAST_LOADER;
  if(typeof base==='function'&&!base.__PSS_NAV_FAST_V4){
    var fn=async function(){
      var d=configCache();
      if(d){setTimeout(function(){edge('boloes',{},true).then(salvarConfigCache).catch(function(){});},0);return {origem:'Supabase (cache rapido)',lista:d.boloes,acao:'PSS_NAV_FAST_V4',supabase:true};}
      try{var l=await edge('boloes');salvarConfigCache(l);return {origem:'Supabase Edge',lista:l,acao:'PSS_NAV_FAST_V4',supabase:true};}catch(e){return base.apply(this,arguments);}
    };
    fn.__PSS_NAV_FAST_V4=true;fn.__base=base;window.PSS_CONFIG_FAST_LOADER=fn;
  }
}
function instalarPagamentosRapido(){
  var fn=async function(){
    var r=await Promise.all([edge('pagamentos'),edge('dados_recebimento')]);
    var p=pagamentosTabela(r[0]),rec=recebimentos(r[1]);
    window.ESTADO=window.ESTADO||{};ESTADO.dadosRecebimentoAdmin=rec;ESTADO.pagamentosAdminCache={headers:p.headers||[],rows:p.rows||[]};
    return {pag:p,rec:{dados:rec}};
  };
  fn.__PSS_NAV_FAST_V4=true;window.carregarDadosPagamentosAdmin_=fn;try{carregarDadosPagamentosAdmin_=fn;}catch(e){}
}
function instalarAdminDados(){
  var base=window.adminDados;if(typeof base!=='function'||base.__PSS_NAV_FAST_V4)return;
  var fn=async function(aba){var r=await adminRapido(aba);if(r)return r;return base.apply(this,arguments);};
  fn.__PSS_NAV_FAST_V4=true;fn.__base=base;window.adminDados=fn;try{adminDados=fn;}catch(e){}
}
function instalarApi(){
  var base=window.api;
  if(typeof base==='function'&&!base.__PSS_NAV_FAST_V4){var fn=async function(action,dados,args){if(String(action||'')==='getDadosAdmin'){var aba=(dados&&dados.nomeAba)||(args&&args[0])||'';var ar=await adminRapido(aba);if(ar)return ar;}var r=fastAction(action,dados,args);if(r)return await r;return base.apply(this,arguments);};fn.__PSS_NAV_FAST_V4=true;fn.__base=base;window.api=fn;try{api=fn;}catch(e){}}
  var bm=window.apiMulti;
  if(typeof bm==='function'&&!bm.__PSS_NAV_FAST_V4){var fm=async function(tentativas){if(Array.isArray(tentativas))for(var i=0;i<tentativas.length;i++){var t=tentativas[i]||{};if(String(t.action||'')==='getDadosAdmin'){var aba=(t.dados&&t.dados.nomeAba)||(t.args&&t.args[0])||'';var ar=await adminRapido(aba);if(ar)return ar;}var r=fastAction(t.action,t.dados,t.args);if(r)return await r;}return bm.apply(this,arguments);};fm.__PSS_NAV_FAST_V4=true;fm.__base=bm;window.apiMulti=fm;try{apiMulti=fm;}catch(e){}}
}

var renderMap={
  inicio:function(){return window.renderInicio&&window.renderInicio();},
  boloes:function(){return window.renderBoloes&&window.renderBoloes('ativos');},
  palpite:function(){return window.renderPalpiteLista&&window.renderPalpiteLista('ativos');},
  comprovante:function(){return window.renderComprovante&&window.renderComprovante();},
  jogos:function(){return window.renderJogosRealizados&&window.renderJogosRealizados();},
  especiais:function(){return window.renderEspeciais&&window.renderEspeciais();},
  regulamento:function(){return window.renderRegulamento&&window.renderRegulamento();},
  config:function(){return window.renderConfigBoloesAdmin&&window.renderConfigBoloesAdmin();},
  pagamentos:function(){return window.renderPagamentosAdmin&&window.renderPagamentosAdmin();},
  usuarios:function(){return window.renderUsuariosAdmin&&window.renderUsuariosAdmin();},
  solicitacoes:function(){return window.renderSolicitacoesAdmin&&window.renderSolicitacoesAdmin();},
  baseLoterias:function(){return window.renderBaseLoteriasAdmin&&window.renderBaseLoteriasAdmin();},
  consulta:function(){return window.renderConsultaParticipanteAdmin&&window.renderConsultaParticipanteAdmin();},
  participantes:function(){return window.renderParticipantesBolaoAdmin&&window.renderParticipantesBolaoAdmin();}
};
function mark(v){currentView=v;seq++;try{window.ESTADO=window.ESTADO||{};window.ESTADO.view=v;window.PSS_NAV_SEQ=seq;window.PSS_NAV_VIEW=v;}catch(e){}try{document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});}catch(e){}return seq;}
function go(v){v=String(v||'inicio');mark(v);var fn=renderMap[v];if(typeof fn==='function')return fn();if(typeof baseNavigate==='function')return baseNavigate(v);}
function instalarNavegacao(){if(typeof window.navegar==='function'&&!window.navegar.__PSS_NAV_FAST_V4){baseNavigate=window.navegar;var n=function(v){return go(v);};n.__PSS_NAV_FAST_V4=true;n.__base=baseNavigate;window.navegar=n;try{navegar=n;}catch(e){}}}
function install(){instalarLoaders();instalarConfigRapido();instalarPagamentosRapido();instalarAdminDados();instalarApi();instalarNavegacao();}
install();[50,150,400,1000,2500,5000].forEach(function(ms){setTimeout(install,ms);});
window.PSS_LAST_CLICK_WINS={version:'V4',get:function(){return {seq:seq,view:currentView};},go:go};
})();
