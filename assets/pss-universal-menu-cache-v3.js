/* Portal SimonSports - Universal Menu Cache V3
 * Objetivo: TODOS os menus abrem instantaneamente com o ultimo HTML valido.
 * O conteudo real atualiza em segundo plano sem substituir a tela por skeleton/loading.
 */
(function(){
  'use strict';
  if(window.PSS_UNIVERSAL_MENU_CACHE_V3)return;
  window.PSS_UNIVERSAL_MENU_CACHE_V3=true;

  var VIEWS=['inicio','boloes','palpite','comprovante','jogos','especiais','regulamento','config','pagamentos','usuarios','solicitacoes','baseLoterias','consulta','participantes'];
  var PREFIX='PSS_VIEW_UNIVERSAL_V3_';
  var atual='';
  var exibindoCache=false;
  var ultimoClique=0;

  function norm(v){v=String(v||'inicio');return v==='base'?'baseLoterias':v;}
  function key(v){return PREFIX+norm(v);}
  function loadingHtml(s){s=String(s||'');return /Carregando|Aguarde\.\.\.|Atualizando dados|fast-skeleton|loading-fast/i.test(s);}
  function erroHtml(s){s=String(s||'');return /notice error|Erro retornado pela API|Cannot read properties/i.test(s);}
  function valido(s){s=String(s||'');return s.length>=120&&!loadingHtml(s)&&!erroHtml(s);}

  function salvar(v,html){
    try{
      v=norm(v);html=String(html||'');
      if(VIEWS.indexOf(v)<0||!valido(html))return;
      if(html.length>450000)return;
      var raw=JSON.stringify({ts:Date.now(),html:html});
      sessionStorage.setItem(key(v),raw);
      localStorage.setItem(key(v),raw);
    }catch(e){}
  }

  function ler(v){
    v=norm(v);
    var fontes=[key(v),'PSS_VIEW_FAST_V2_'+v,'PSS_VIEW_CACHE_V179_'+v,'PSSV179_VIEW_'+v];
    for(var i=0;i<fontes.length;i++){
      try{
        var raw=sessionStorage.getItem(fontes[i])||localStorage.getItem(fontes[i]);
        if(!raw)continue;
        var o=JSON.parse(raw);
        if(o&&valido(o.html)){
          if(fontes[i]!==key(v))salvar(v,o.html);
          return o;
        }
      }catch(e){}
    }
    return null;
  }

  function pintar(html){var el=document.getElementById('view');if(el)el.innerHTML=html;}
  function marcar(v){
    try{
      if(window.ESTADO)ESTADO.view=v;
      window.PSS_MENU_ATUAL_V268=v;window.PSS_MENU_ATUAL_V267=v;window.PSS_MENU_ATUAL_V238=v;
      document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){b.classList.toggle('active',norm(b.dataset.view)===v);});
    }catch(e){}
  }

  function instalarSetView(){
    var base=window.setView;
    if(typeof base!=='function'||base.__PSS_UNIVERSAL_V3__)return false;
    var nova=function(html){
      var s=String(html||'');
      if(exibindoCache&&loadingHtml(s))return;
      var r=base.apply(this,arguments);
      if(atual&&valido(s)){
        salvar(atual,s);
        exibindoCache=false;
      }
      return r;
    };
    nova.__PSS_UNIVERSAL_V3__=true;nova.__base=base;
    window.setView=nova;try{setView=nova;}catch(e){}
    return true;
  }

  function instalarNav(){
    var base=window.navegar;
    if(typeof base!=='function'||base.__PSS_UNIVERSAL_V3__)return false;
    var nova=function(v){
      v=norm(v);atual=v;ultimoClique=Date.now();marcar(v);
      var c=ler(v);
      if(c){exibindoCache=true;pintar(c.html);}else{exibindoCache=false;}
      var ctx=this,args=arguments;
      try{
        var r=base.apply(ctx,args);
        if(r&&typeof r.catch==='function')r.catch(function(e){console.warn('PSS Universal V3',e);});
        return r;
      }catch(e){console.warn('PSS Universal V3',e);}
    };
    nova.__PSS_UNIVERSAL_V3__=true;nova.__base=base;
    window.navegar=nova;try{navegar=nova;}catch(e){}
    return true;
  }

  function capturarAtual(){
    try{
      var v=norm((window.ESTADO&&ESTADO.view)||atual||'');
      var el=document.getElementById('view');
      if(v&&el)salvar(v,el.innerHTML);
    }catch(e){}
  }

  function migrarCaches(){VIEWS.forEach(function(v){ler(v);});}
  function instalar(){instalarSetView();instalarNav();}

  migrarCaches();instalar();
  [0,20,80,200,500,1000,2000,4000].forEach(function(ms){setTimeout(instalar,ms);});
  setInterval(capturarAtual,1500);
  window.addEventListener('beforeunload',capturarAtual);

  window.PSS_UNIVERSAL_CACHE={
    versao:'V3',
    limpar:function(v){try{if(v){localStorage.removeItem(key(v));sessionStorage.removeItem(key(v));}else VIEWS.forEach(function(x){localStorage.removeItem(key(x));sessionStorage.removeItem(key(x));});}catch(e){}},
    status:function(){var o={};VIEWS.forEach(function(v){o[v]=!!ler(v);});return {versao:'V3',view:atual,cache:o,ultimoClique:ultimoClique};}
  };
})();
