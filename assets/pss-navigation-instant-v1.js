/* Portal SimonSports - Navegação Instantânea V1
 * Garante pintura imediata da tela antes de iniciar renderizadores pesados.
 * Não altera leitura/gravação de dados.
 */
(function(){
  'use strict';
  if(window.PSS_NAV_INSTANT_V1) return;
  window.PSS_NAV_INSTANT_V1=true;

  var TITULOS={
    boloes:'🎟️ Bolões',
    comprovante:'📎 Comprovante',
    pagamentos:'💰 Pagamentos',
    usuarios:'👥 Usuários',
    solicitacoes:'📝 Solicitações de cadastro',
    baseLoterias:'🎲 Base Loterias',
    consulta:'🔎 Consulta de participantes',
    participantes:'👥 Participantes do bolão'
  };
  var ALVOS=Object.keys(TITULOS);

  function setAtivo(v){
    try{
      if(window.ESTADO)ESTADO.view=v;
      document.querySelectorAll('#navMenu button[data-view]').forEach(function(b){
        b.classList.toggle('active',b.dataset.view===v);
      });
    }catch(e){}
  }

  function pintar(v){
    try{
      var el=document.getElementById('view');
      if(!el)return;
      el.innerHTML='<div class="panel"><h2>'+TITULOS[v]+'</h2><div class="notice info">Carregando dados...</div></div>';
    }catch(e){}
  }

  function instalar(){
    var base=window.navegar;
    if(typeof base!=='function'||base.__PSS_NAV_INSTANT_V1__)return false;

    var nova=function(v){
      v=String(v||'inicio');
      if(ALVOS.indexOf(v)<0)return base.apply(this,arguments);

      var args=arguments,ctx=this;
      setAtivo(v);
      pintar(v);

      /* Dois frames: primeiro pinta a nova tela; depois inicia o código pesado. */
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          try{base.apply(ctx,args);}catch(err){
            try{
              var el=document.getElementById('view');
              if(el)el.innerHTML='<div class="panel"><div class="notice error">'+String((err&&err.message)||err||'Erro ao abrir tela.')+'</div></div>';
            }catch(e){}
          }
        });
      });
      return undefined;
    };
    nova.__PSS_NAV_INSTANT_V1__=true;
    nova.__PSS_NAV_BASE__=base;
    window.navegar=nova;
    try{navegar=nova;}catch(e){}
    return true;
  }

  instalar();
  [50,250,750,1500,3000].forEach(function(ms){setTimeout(instalar,ms);});
})();
