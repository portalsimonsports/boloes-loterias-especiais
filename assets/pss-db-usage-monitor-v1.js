/* Portal SimonSports - Monitor de uso do banco Supabase V1 */
(function(){
  'use strict';
  if(window.PSS_DB_USAGE_MONITOR && window.PSS_DB_USAGE_MONITOR.versao==='V1') return;

  var INTERVALO_MS = 5 * 60 * 1000;
  var ultimo = null;
  var timer = null;

  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function pct(n){var x=Number(n||0);return isFinite(x)?Math.max(0,Math.min(100,x)):0;}

  async function config(){
    var c=window.PSS_SUPABASE_PUBLIC||null;
    if(c && (c.url||c.supabaseUrl) && (c.publishableKey||c.key||c.anonKey)) return {url:(c.url||c.supabaseUrl).replace(/\/$/,''),key:c.publishableKey||c.key||c.anonKey};
    var r=await fetch('./api/supabase-public.json',{cache:'force-cache'});
    if(!r.ok) throw new Error('Config Supabase HTTP '+r.status);
    c=await r.json();
    return {url:String(c.url||c.supabaseUrl||'').replace(/\/$/,''),key:String(c.publishableKey||c.key||c.anonKey||'')};
  }

  async function consultar(){
    var c=await config();
    if(!c.url||!c.key) throw new Error('Supabase não configurado');
    var ctrl=new AbortController();
    var to=setTimeout(function(){ctrl.abort();},4000);
    try{
      var r=await fetch(c.url+'/rest/v1/rpc/pss_database_usage',{
        method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:'{}',signal:ctrl.signal,cache:'no-store'
      });
      if(!r.ok) throw new Error('Monitor Supabase HTTP '+r.status);
      var j=await r.json();
      var d=Array.isArray(j)?j[0]:j;
      if(!d) throw new Error('Monitor sem resposta');
      ultimo=d;
      return d;
    }finally{clearTimeout(to);}
  }

  function corNivel(level){
    level=Number(level||0);
    if(level>=4)return '#b91c1c';
    if(level>=3)return '#dc2626';
    if(level>=2)return '#d97706';
    if(level>=1)return '#ca8a04';
    return '#15803d';
  }

  function html(d){
    var p=pct(d.used_percent), cor=corNivel(d.level);
    return '<div id="pssDbUsageCard" style="margin:0 0 18px;padding:16px;border:1px solid #d9e2dc;border-left:6px solid '+cor+';border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.06)">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
        '<div><div style="font-size:18px;font-weight:900;color:#123b20">🗄️ Uso do banco Supabase</div><div style="margin-top:4px;font-weight:800;color:'+cor+'">Status: '+esc(d.status||'')+'</div></div>'+
        '<button type="button" onclick="PSS_DB_USAGE_MONITOR.atualizar(true)" style="border:1px solid #ccd8d0;background:#f8fbf9;border-radius:9px;padding:8px 12px;font-weight:800;cursor:pointer">Atualizar</button>'+
      '</div>'+
      '<div style="margin-top:14px;font-size:24px;font-weight:900;color:#123b20">'+esc(d.used_mb)+' MB <span style="font-size:15px;font-weight:700;color:#5f6e65">/ '+esc(d.limit_mb)+' MB</span></div>'+
      '<div style="margin-top:4px;font-size:14px;color:#506058">'+esc(d.used_percent)+'% utilizado • '+esc(d.free_mb)+' MB livres</div>'+
      '<div style="height:14px;background:#e8eeea;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:'+p+'%;background:'+cor+';transition:width .25s ease"></div></div>'+
      '<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:#6b756f"><span>0%</span><span>50%</span><span>70%</span><span>80%</span><span>100%</span></div>'+
      '<div style="margin-top:12px;padding:10px 12px;background:#f5f8f6;border-radius:9px;font-size:13px;line-height:1.4;color:#34453a">'+esc(d.message||'')+'</div>'+
      '<div style="margin-top:9px;font-size:11px;color:#758078">Alertas: 50% observar • 70% atenção • 80% alto • 90% crítico. Atualização automática a cada 5 minutos enquanto o site estiver aberto.</div>'+
    '</div>';
  }

  function acharPainelConfig(){
    var hs=document.querySelectorAll('h2');
    for(var i=0;i<hs.length;i++){
      if((hs[i].textContent||'').indexOf('Configurações das loterias/bolões criados')>=0) return hs[i].closest('.panel')||hs[i].parentElement;
    }
    return null;
  }

  function render(d){
    var painel=acharPainelConfig();
    if(!painel) return false;
    var atual=document.getElementById('pssDbUsageCard');
    if(atual) atual.outerHTML=html(d);
    else{
      var h=painel.querySelector('h2');
      if(h) h.insertAdjacentHTML('afterend',html(d));
      else painel.insertAdjacentHTML('afterbegin',html(d));
    }
    return true;
  }

  async function atualizar(forcar){
    try{
      var d=forcar||!ultimo?await consultar():ultimo;
      render(d);
      return d;
    }catch(e){
      var painel=acharPainelConfig();
      if(painel && !document.getElementById('pssDbUsageCard')){
        var h=painel.querySelector('h2');
        var msg='<div id="pssDbUsageCard" style="margin:0 0 16px;padding:12px;border-left:5px solid #b45309;background:#fff7ed;border-radius:10px"><b>Monitor do banco:</b> aguardando disponibilização da função no Supabase.</div>';
        if(h)h.insertAdjacentHTML('afterend',msg);else painel.insertAdjacentHTML('afterbegin',msg);
      }
      return null;
    }
  }

  var obs=new MutationObserver(function(){ if(acharPainelConfig()) atualizar(false); });
  function iniciar(){
    try{obs.observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
    atualizar(true);
    timer=setInterval(function(){atualizar(true);},INTERVALO_MS);
  }

  window.PSS_DB_USAGE_MONITOR={versao:'V1',consultar:consultar,atualizar:atualizar,ultimo:function(){return ultimo;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();
