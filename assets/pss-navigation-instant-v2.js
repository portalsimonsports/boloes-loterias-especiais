/* Portal SimonSports - Navegação Instantânea V2.1
 * Clique imediato: pinta cache/shell e inicia a carga real no mesmo tick.
 * Sem double requestAnimationFrame e sem atrasar navegação.
 */
(function(){
  'use strict';
  if(window.PSS_NAV_INSTANT_V21) return;
  window.PSS_NAV_INSTANT_V21=true;

  var ALVOS=['boloes','comprovante','pagamentos','usuarios','solicitacoes','baseLoterias','consulta','participantes'];
  var TITULOS={boloes:'🎟️ Bolões',comprovante:'📎 Comprovante',pagamentos:'💰 Pagamentos',usuarios:'👥 Usuários',solicitacoes:'📝 Solicitações de cadastro',baseLoterias:'🎲 Base Loterias',consulta:'🔎 Consulta de participantes',participantes:'👥 Participantes do bolão'};
  var PREFIX='PSS_VIEW_FAST_V2_';
  var viewAtual='',cacheMostrado=false;

  function key(v){return PREFIX+v;}
  function ler(v){try{var raw=sessionStorage.getItem(key(v))||localStorage.getItem(key(v));if(!raw)return null;var o=JSON.parse(raw);return o&&o.html?o:null;}catch(e){return null;}}
  function salvar(v,html){try{html=String(html||'');if(!v||html.length<120)return;if(/Carregando dados|Aguarde\.\.\.|loading-fast/i.test(html)&&html.length<700)return;var raw=JSON.stringify({ts:Date.now(),html:html});sessionStorage.setItem(key(v),raw);localStorage.setItem(key(v),raw);}catch(e){}}
  function setAtivo(v){try{if(window.ESTADO)ESTADO.view=v;window.PSS_MENU_ATUAL_V268=v;window.PSS_MENU_ATUAL_V267=v;document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});}catch(e){}}
  function shell(v){return '<div class="panel"><h2>'+TITULOS[v]+'</h2><div class="fast-skeleton"><div class="fast-skeleton-line w40"></div><div class="fast-skeleton-line w90"></div><div class="fast-skeleton-line w60"></div><div class="fast-skeleton-line w90"></div></div><div class="cache-hint warn">Atualizando dados...</div></div>';}
  function pintar(html){var el=document.getElementById('view');if(el)el.innerHTML=html;}

  function instalarSetView(){var base=window.setView;if(typeof base!=='function'||base.__PSS_NAV_V21__)return false;var n=function(html){var s=String(html||'');if(cacheMostrado&&viewAtual&&/Carregando|Aguarde\.\.\./i.test(s)&&s.length<800)return;var r=base.apply(this,arguments);if(viewAtual&&ALVOS.indexOf(viewAtual)>=0)salvar(viewAtual,s);cacheMostrado=false;return r;};n.__PSS_NAV_V21__=true;n.__PSS_BASE__=base;window.setView=n;try{setView=n;}catch(e){}return true;}

  function instalarNav(){var base=window.navegar;if(typeof base!=='function'||base.__PSS_NAV_V21__)return false;var n=function(v){v=String(v||'inicio');if(v==='base')v='baseLoterias';if(ALVOS.indexOf(v)<0){viewAtual=v;cacheMostrado=false;return base.apply(this,arguments);}viewAtual=v;setAtivo(v);var c=ler(v);cacheMostrado=!!c;pintar(c?c.html:shell(v));var ctx=this,args=arguments;try{var ret=base.apply(ctx,args);if(ret&&typeof ret.catch==='function')ret.catch(function(err){console.warn('PSS NAV V2.1',err);});}catch(err){console.warn('PSS NAV V2.1',err);}return ret;};n.__PSS_NAV_V21__=true;n.__PSS_BASE__=base;window.navegar=n;try{navegar=n;}catch(e){}return true;}

  function instalar(){instalarSetView();instalarNav();}
  instalar();[25,100,300,800,1800].forEach(function(ms){setTimeout(instalar,ms);});
})();
