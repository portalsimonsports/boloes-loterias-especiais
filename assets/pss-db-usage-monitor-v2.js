/* Portal SimonSports - Monitor de uso do banco Supabase V2
 * Seguro: roda somente depois que a CONFIG termina de renderizar.
 * Sem MutationObserver, sem setInterval e sem consulta nas outras telas.
 */
(function(){
  'use strict';
  if(window.PSS_DB_USAGE_MONITOR && window.PSS_DB_USAGE_MONITOR.versao==='V2') return;

  var ultimo=null;

  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function pct(n){var x=Number(n||0);return isFinite(x)?Math.max(0,Math.min(100,x)):0;}

  async function config(){
    var c=window.PSS_SUPABASE_PUBLIC||null;
    if(c&&(c.url||c.supabaseUrl)&&(c.publishableKey||c.key||c.anonKey)){
      return {url:String(c.url||c.supabaseUrl).replace(/\/$/,''),key:String(c.publishableKey||c.key||c.anonKey)};
    }
    var r=await fetch('./api/supabase-public.json',{cache:'force-cache'});
    if(!r.ok)throw new Error('Config Supabase HTTP '+r.status);
    c=await r.json();
    return {url:String(c.url||c.supabaseUrl||'').replace(/\/$/,''),key:String(c.publishableKey||c.key||c.anonKey||'')};
  }

  async function consultar(){
    var c=await config();
    if(!c.url||!c.key)throw new Error('Supabase não configurado');
    var ctrl=new AbortController();
    var to=setTimeout(function(){ctrl.abort();},3500);
    try{
      var r=await fetch(c.url+'/rest/v1/rpc/pss_database_usage',{
        method:'POST',
        headers:{apikey:c.key,'Content-Type':'application/json'},
        body:'{}',signal:ctrl.signal,cache:'no-store'
      });
      if(!r.ok)throw new Error('Monitor Supabase HTTP '+r.status);
      var j=await r.json();
      var d=Array.isArray(j)?j[0]:j;
      if(!d)throw new Error('Monitor sem resposta');
      ultimo=d;
      return d;
    }finally{clearTimeout(to);}
  }

  function corNivel(level){
    level=Number(level||0);
    if(level>=4)return '#991b1b';
    if(level>=3)return '#dc2626';
    if(level>=2)return '#d97706';
    if(level>=1)return '#ca8a04';
    return '#15803d';
  }

  function acharPainel(){
    var hs=document.querySelectorAll('h2');
    for(var i=0;i<hs.length;i++){
      if((hs[i].textContent||'').indexOf('Configurações das loterias/bolões criados')>=0){
        return hs[i].closest('.panel')||hs[i].parentElement;
      }
    }
    return null;
  }

  function html(d){
    var p=pct(d.used_percent),cor=corNivel(d.level);
    return '<div id="pssDbUsageCardV2" style="margin:16px 0 18px;padding:15px;border:1px solid #d9e2dc;border-left:6px solid '+cor+';border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.05)">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">'+
        '<div><div style="font-size:18px;font-weight:900;color:#123b20">🗄️ Uso do banco Supabase</div><div style="margin-top:3px;font-weight:900;color:'+cor+'">Status: '+esc(d.status||'')+'</div></div>'+
        '<button type="button" onclick="PSS_DB_USAGE_MONITOR.atualizar()" style="border:1px solid #c8d7cd;background:#f8fbf9;border-radius:9px;padding:8px 12px;font-weight:900;color:#14532d">ATUALIZAR</button>'+
      '</div>'+
      '<div style="margin-top:12px;font-size:25px;font-weight:900;color:#123b20">'+esc(d.used_mb)+' MB <span style="font-size:15px;color:#66736a">/ '+esc(d.limit_mb)+' MB</span></div>'+
      '<div style="margin-top:3px;font-size:14px;color:#506058">'+esc(d.used_percent)+'% utilizado • '+esc(d.free_mb)+' MB livres</div>'+
      '<div style="height:13px;background:#e8eeea;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:'+p+'%;background:'+cor+'"></div></div>'+
      '<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:#6b756f"><span>0%</span><span>50%</span><span>70%</span><span>80%</span><span>100%</span></div>'+
      '<div style="margin-top:10px;padding:9px 11px;background:#f5f8f6;border-radius:9px;font-size:13px;line-height:1.4;color:#34453a">'+esc(d.message||'')+'</div>'+
      '<div style="margin-top:8px;font-size:11px;color:#758078">Alertas: 50% observar • 70% atenção • 80% alto • 90% crítico.</div>'+
    '</div>';
  }

  function render(d){
    var painel=acharPainel();
    if(!painel)return false;
    var antigo=document.getElementById('pssDbUsageCardV2');
    if(antigo){antigo.outerHTML=html(d);return true;}
    var origem=painel.querySelector('.v233-config-source');
    if(origem){
      var bloco=origem.closest('.v233-config-top')||origem.parentElement;
      bloco.insertAdjacentHTML('afterend',html(d));
      return true;
    }
    var h=painel.querySelector('h2');
    if(h){h.insertAdjacentHTML('afterend',html(d));return true;}
    return false;
  }

  function renderErro(msg){
    var painel=acharPainel();
    if(!painel)return;
    var antigo=document.getElementById('pssDbUsageCardV2');
    var h='<div id="pssDbUsageCardV2" style="margin:16px 0;padding:12px;border-left:5px solid #b45309;background:#fff7ed;border-radius:10px"><b>🗄️ Uso do banco Supabase:</b> '+esc(msg)+' <button type="button" onclick="PSS_DB_USAGE_MONITOR.atualizar()" style="margin-left:8px">Tentar novamente</button></div>';
    if(antigo)antigo.outerHTML=h;
    else{
      var origem=painel.querySelector('.v233-config-source');
      var bloco=origem&&(origem.closest('.v233-config-top')||origem.parentElement);
      if(bloco)bloco.insertAdjacentHTML('afterend',h);
    }
  }

  async function atualizar(){
    if(!acharPainel())return null;
    try{
      var d=await consultar();
      render(d);
      return d;
    }catch(e){
      renderErro('não foi possível consultar agora.');
      return null;
    }
  }

  function instalar(){
    var original=window.renderConfigBoloesAdmin;
    if(typeof original!=='function'||original.__PSS_DB_MONITOR_V2__)return false;
    var nova=async function(){
      var r=await original.apply(this,arguments);
      setTimeout(function(){atualizar();},0);
      return r;
    };
    nova.__PSS_DB_MONITOR_V2__=true;
    nova.__PSS_ORIGINAL__=original;
    window.renderConfigBoloesAdmin=nova;
    try{renderConfigBoloesAdmin=nova;}catch(e){}
    return true;
  }

  window.PSS_DB_USAGE_MONITOR={
    versao:'V2',
    consultar:consultar,
    atualizar:atualizar,
    ultimo:function(){return ultimo;},
    instalar:instalar
  };

  instalar();
  [50,250,750,1500].forEach(function(ms){setTimeout(instalar,ms);});
  setTimeout(function(){if(acharPainel())atualizar();},100);
})();
