/* Portal SimonSports — Last Click Wins V2
 * Navegação imediata. Não espera Edge antes de chamar o renderizador.
 * A camada Edge/cache continua responsável pelos dados.
 */
(function(){
'use strict';
if(window.PSS_LAST_CLICK_WINS_V2)return;
window.PSS_LAST_CLICK_WINS_V2=true;
var seq=0,currentView='',baseNavigate=null;
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
  currentView=v;seq++;
  try{window.ESTADO=window.ESTADO||{};window.ESTADO.view=v;window.PSS_NAV_SEQ=seq;window.PSS_NAV_VIEW=v;}catch(e){}
  try{document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});}catch(e){}
  return seq;
}
function go(v){
  v=String(v||'inicio');
  mark(v);
  var fn=renderMap[v];
  if(typeof fn==='function')return fn();
  if(typeof baseNavigate==='function')return baseNavigate(v);
}
function install(){
  if(typeof window.navegar==='function'&&!window.navegar.__PSS_LCW_V2){
    baseNavigate=window.navegar;
    var n=function(v){return go(v);};
    n.__PSS_LCW_V2=true;n.__base=baseNavigate;
    window.navegar=n;try{navegar=n;}catch(e){}
  }
}
install();[50,150,400,1000,2500,5000].forEach(function(ms){setTimeout(install,ms);});
window.PSS_LAST_CLICK_WINS={version:'V2',get:function(){return {seq:seq,view:currentView};},go:go};
})();
