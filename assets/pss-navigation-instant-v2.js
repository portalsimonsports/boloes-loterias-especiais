/* Portal SimonSports - Navegação Instantânea V2
 * Restaura cache visual imediato dos menus após overrides V267/V268.
 * A tela anterior de cada menu abre instantaneamente e os dados atualizam ao fundo.
 * Sem alterar rotinas de gravação.
 */
(function(){
  'use strict';
  if(window.PSS_NAV_INSTANT_V2) return;
  window.PSS_NAV_INSTANT_V2=true;

  var ALVOS=['boloes','comprovante','pagamentos','usuarios','solicitacoes','baseLoterias','consulta','participantes'];
  var TITULOS={
    boloes:'🎟️ Bolões', comprovante:'📎 Comprovante', pagamentos:'💰 Pagamentos',
    usuarios:'👥 Usuários', solicitacoes:'📝 Solicitações de cadastro',
    baseLoterias:'🎲 Base Loterias', consulta:'🔎 Consulta de participantes',
    participantes:'👥 Participantes do bolão'
  };
  var PREFIX='PSS_VIEW_FAST_V2_';
  var viewAtual='';
  var cacheMostrado=false;

  function key(v){return PREFIX+v;}
  function ler(v){
    try{
      var raw=sessionStorage.getItem(key(v))||localStorage.getItem(key(v));
      if(!raw)return null;
      var o=JSON.parse(raw);
      if(!o||!o.html)return null;
      return o;
    }catch(e){return null;}
  }
  function salvar(v,html){
    try{
      html=String(html||'');
      if(!v||html.length<120)return;
      if(/Carregando dados|Aguarde\.\.\.|loading-fast/i.test(html) && html.length<700)return;
      var raw=JSON.stringify({ts:Date.now(),html:html});
      sessionStorage.setItem(key(v),raw);
      /* telas administrativas também persistem para abrir rápido após F5 */
      localStorage.setItem(key(v),raw);
    }catch(e){}
  }
  function setAtivo(v){
    try{
      if(window.ESTADO)ESTADO.view=v;
      window.PSS_MENU_ATUAL_V268=v;
      window.PSS_MENU_ATUAL_V267=v;
      document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});
    }catch(e){}
  }
  function shell(v){
    return '<div class="panel"><h2>'+TITULOS[v]+'</h2><div class="fast-skeleton">'+
      '<div class="fast-skeleton-line w40"></div><div class="fast-skeleton-line w90"></div>'+ 
      '<div class="fast-skeleton-line w60"></div><div class="fast-skeleton-line w90"></div></div>'+ 
      '<div class="cache-hint warn">Atualizando dados em segundo plano...</div></div>';
  }
  function pintarDireto(html){
    var el=document.getElementById('view');
    if(el)el.innerHTML=html;
  }

  /* Captura o setView FINAL, depois dos patches antigos. */
  function instalarSetView(){
    var base=window.setView;
    if(typeof base!=='function'||base.__PSS_NAV_V2__)return false;
    var nova=function(html){
      var s=String(html||'');
      /* Se já mostramos cache real, não deixe o renderizador substituí-lo por uma tela genérica de loading. */
      if(cacheMostrado && viewAtual && /Carregando|Aguarde\.\.\./i.test(s) && s.length<800){
        return;
      }
      var r=base.apply(this,arguments);
      if(viewAtual && ALVOS.indexOf(viewAtual)>=0)salvar(viewAtual,s);
      return r;
    };
    nova.__PSS_NAV_V2__=true;
    nova.__PSS_BASE__=base;
    window.setView=nova;
    try{setView=nova;}catch(e){}
    return true;
  }

  function instalarNav(){
    var base=window.navegar;
    if(typeof base!=='function'||base.__PSS_NAV_V2__)return false;
    var nova=function(v){
      v=String(v||'inicio');
      if(v==='base')v='baseLoterias';
      if(ALVOS.indexOf(v)<0){viewAtual=v;cacheMostrado=false;return base.apply(this,arguments);}

      viewAtual=v;
      setAtivo(v);
      var c=ler(v);
      cacheMostrado=!!c;
      pintarDireto(c?c.html:shell(v));

      var ctx=this,args=arguments;
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          try{
            var ret=base.apply(ctx,args);
            if(ret&&typeof ret.catch==='function')ret.catch(function(err){console.warn('PSS NAV V2',err);});
          }catch(err){console.warn('PSS NAV V2',err);}
          /* depois que a carga começou, resultados reais podem substituir o cache */
          setTimeout(function(){cacheMostrado=false;},120);
        });
      });
      return;
    };
    nova.__PSS_NAV_V2__=true;
    nova.__PSS_BASE__=base;
    window.navegar=nova;
    try{navegar=nova;}catch(e){}
    return true;
  }

  function instalar(){instalarSetView();instalarNav();}
  instalar();
  [20,80,200,500,1000,2000,4000].forEach(function(ms){setTimeout(instalar,ms);});
})();
