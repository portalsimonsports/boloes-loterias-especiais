/* Portal SimonSports - CONFIG Fast Loader V5
 * Leitura: cache local -> bootstrap GitHub -> Supabase bridge.
 * Apps Script fica fora do caminho normal de abertura da CONFIG.
 */
(function(){
  'use strict';
  var CACHE_KEYS=['PSS_PUBLIC_BOOTSTRAP_V4','PSS_SUPABASE_PUBLIC_SNAPSHOT_V1'];

  function dadosCache(){
    for(var i=0;i<CACHE_KEYS.length;i++){
      try{
        var raw=localStorage.getItem(CACHE_KEYS[i]);
        if(!raw)continue;
        var o=JSON.parse(raw),d=o&&o.data?o.data:o;
        if(d&&Array.isArray(d.boloes)&&d.boloes.length)return d;
      }catch(e){}
    }
    try{
      var d2=window.PSS_SUPABASE_PUBLIC_DATA;
      if(d2&&Array.isArray(d2.boloes)&&d2.boloes.length)return d2;
    }catch(e){}
    return null;
  }

  function salvar(d){
    if(!d||!Array.isArray(d.boloes)||!d.boloes.length)return;
    try{localStorage.setItem('PSS_PUBLIC_BOOTSTRAP_V4',JSON.stringify({ts:Date.now(),data:d}));}catch(e){}
    try{window.PSS_SUPABASE_PUBLIC_DATA=d;}catch(e){}
  }

  async function bootstrap(){
    var r=await fetch('./api/bootstrap.json?v=V5_20260810_0852',{cache:'force-cache'});
    if(!r.ok)throw new Error('bootstrap HTTP '+r.status);
    var j=await r.json();
    if(!j||!Array.isArray(j.boloes)||!j.boloes.length)throw new Error('bootstrap sem bolões');
    var d={boloes:j.boloes,resultadosPublicos:j.resultadosPublicos||[],configPublica:j.configPublica||[]};
    salvar(d);
    return d;
  }

  function atualizarFundo(){
    try{
      if(window.PSS_SUPABASE_BRIDGE&&typeof window.PSS_SUPABASE_BRIDGE.carregarPublico==='function'){
        setTimeout(function(){
          window.PSS_SUPABASE_BRIDGE.carregarPublico({forcar:true}).then(function(r){
            if(r&&r.dados)salvar(r.dados);
          }).catch(function(){});
        },0);
      }
    }catch(e){}
  }

  window.PSS_CONFIG_FAST_LOADER=async function(){
    var d=dadosCache();
    if(d){
      atualizarFundo();
      return {origem:'Supabase (cache rápido)',lista:d.boloes,acao:'PSS_CONFIG_FAST_V5',supabase:true};
    }
    try{
      d=await bootstrap();
      atualizarFundo();
      return {origem:'Supabase / bootstrap',lista:d.boloes,acao:'PSS_CONFIG_FAST_V5',supabase:true};
    }catch(e){}
    try{
      if(window.PSS_SUPABASE_BRIDGE&&typeof window.PSS_SUPABASE_BRIDGE.carregarPublico==='function'){
        var r=await window.PSS_SUPABASE_BRIDGE.carregarPublico({forcar:false});
        if(r&&r.dados&&Array.isArray(r.dados.boloes)&&r.dados.boloes.length){
          salvar(r.dados);
          return {origem:'Supabase PostgreSQL',lista:r.dados.boloes,acao:'PSS_CONFIG_FAST_V5',supabase:true};
        }
      }
    }catch(e2){}
    return null;
  };

  /* Pré-carrega o bootstrap sem bloquear a página. */
  var c=dadosCache();
  if(!c)setTimeout(function(){bootstrap().then(atualizarFundo).catch(function(){});},0);
  else atualizarFundo();
})();
