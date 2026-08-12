/* Portal SimonSports — Last Click Wins V1
 * Bloqueia renderização atrasada e evita iniciar renderizadores legados
 * até a leitura Edge necessária estar pronta. Não altera layout.
 */
(function(){
'use strict';
if(window.PSS_LAST_CLICK_WINS_V1)return;
window.PSS_LAST_CLICK_WINS_V1=true;

var seq=0,currentView='';
var originals={};
var fast=()=>window.PSS_ADMIN_EDGE_FAST;
var slowViews={
  boloes:['boloes'],
  palpite:['boloes'],
  comprovante:['boloes','comprovantes'],
  config:['boloes'],
  pagamentos:['pagamentos','dados_recebimento'],
  usuarios:['usuarios'],
  solicitacoes:['solicitacoes'],
  baseLoterias:['base_loterias'],
  consulta:['consulta'],
  participantes:['participantes']
};
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
function mark(v){
  currentView=v; seq++;
  try{window.ESTADO=window.ESTADO||{};window.ESTADO.view=v;}catch(e){}
  try{document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});}catch(e){}
  return seq;
}
function still(id,v){return id===seq&&v===currentView;}
function loadingFor(v){
  var nomes={boloes:'bolões',palpite:'palpites',comprovante:'comprovante',config:'configurações',pagamentos:'pagamentos',usuarios:'usuários',solicitacoes:'solicitações',baseLoterias:'Base Loterias',consulta:'consulta',participantes:'participantes'};
  try{if(typeof window.loading==='function')window.loading('Carregando '+(nomes[v]||'dados'));}catch(e){}
}
async function warm(v,id){
  var f=fast();
  var jobs=slowViews[v]||[];
  if(!jobs.length||!f||typeof f.call!=='function')return true;
  loadingFor(v);
  for(var i=0;i<jobs.length;i++){
    try{
      if(jobs[i]==='consulta') await f.call('consulta',false,{});
      else await f.call(jobs[i],false);
    }catch(e){
      if(still(id,v)) throw e;
      return false;
    }
    if(!still(id,v))return false;
  }
  return true;
}
async function go(v){
  v=String(v||'inicio');
  var id=mark(v);
  var needs=Object.prototype.hasOwnProperty.call(slowViews,v);
  if(needs){
    try{var ok=await warm(v,id);if(!ok||!still(id,v))return;}catch(e){if(!still(id,v))return;try{window.setView('<div class="panel"><div class="notice error">'+String((e&&e.message)||e).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];})+'</div></div>');}catch(_e){}return;}
  }
  if(!still(id,v))return;
  var fn=renderMap[v];
  if(typeof fn==='function')return fn();
  if(typeof originals.navegar==='function')return originals.navegar(v);
}
function install(){
  if(typeof window.navegar==='function'&&!window.navegar.__PSS_LCW_V1){
    originals.navegar=window.navegar;
    var n=function(v){return go(v);};
    n.__PSS_LCW_V1=true;n.__base=originals.navegar;
    window.navegar=n;try{navegar=n;}catch(e){}
  }
}
install();[50,150,400,1000,2500,5000].forEach(function(ms){setTimeout(install,ms);});
window.PSS_LAST_CLICK_WINS={version:'V1',get:function(){return {seq:seq,view:currentView};},go:go};
})();
