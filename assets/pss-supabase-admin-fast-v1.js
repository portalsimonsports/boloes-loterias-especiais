/* Portal SimonSports - Admin Supabase Fast V1
 * Intercepta leituras administrativas já migradas.
 * Firebase ID token -> Supabase Data API.
 * Apps Script fica apenas como fallback se a integração Firebase/Supabase não estiver ativa.
 */
(function(){
  'use strict';
  if(window.PSS_SUPABASE_ADMIN_FAST_V1)return;
  window.PSS_SUPABASE_ADMIN_FAST_V1=true;

  var cfgCache=null;
  var fonte={origem:'',ms:0,aba:'',erro:''};

  function normal(v){return String(v==null?'':v).trim().toUpperCase();}
  async function cfg(){
    if(cfgCache)return cfgCache;
    var r=await fetch('./api/supabase-public.json?v=ADMIN_FAST_V1',{cache:'force-cache'});
    if(!r.ok)throw new Error('Config Supabase HTTP '+r.status);
    var j=await r.json();
    cfgCache={url:String(j.url||j.supabaseUrl||'').replace(/\/$/,''),key:String(j.publishableKey||j.key||j.anonKey||'')};
    if(!cfgCache.url||!cfgCache.key)throw new Error('Supabase não configurado');
    return cfgCache;
  }
  async function token(){
    var u=null;
    try{u=window.FIREBASE_AUTH&&FIREBASE_AUTH.currentUser;}catch(e){}
    if(!u)try{u=window.firebase&&firebase.auth&&firebase.auth().currentUser;}catch(e){}
    if(!u||typeof u.getIdToken!=='function')throw new Error('Firebase sem usuário autenticado');
    return await u.getIdToken(false);
  }
  async function rpc(fn){
    var c=await cfg(),t=await token(),ini=performance.now();
    var ctrl=new AbortController(),to=setTimeout(function(){ctrl.abort();},5000);
    try{
      var r=await fetch(c.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}',signal:ctrl.signal,cache:'no-store'});
      if(!r.ok)throw new Error('Supabase '+r.status+' '+(await r.text()).slice(0,180));
      var j=await r.json();
      fonte.ms=Math.round(performance.now()-ini);fonte.origem='SUPABASE DIRETO';fonte.erro='';
      return Array.isArray(j)?j:(j?[j]:[]);
    }finally{clearTimeout(to);}
  }

  function tabelaUsuarios(lista){
    var headers=['ID','NOME','EMAIL','TELEFONE','STATUS','PERFIL','APROVADO','FIREBASE_UID','CRIADO_EM','ATUALIZADO_EM'];
    var rows=lista.map(function(x){return [x.id,x.nome,x.email,x.telefone,x.status,x.perfil,x.aprovado,x.firebase_uid,x.created_at,x.updated_at];});
    return {headers:headers,rows:rows};
  }
  function tabelaParticipantes(lista){
    var headers=['ID','BOLAO_ID','BOLAO','USUARIO_ID','NOME','EMAIL','STATUS','INSCRITO','COTAS_CONFIRMADAS','COTAS_PENDENTES','COTAS_RESERVADAS','CRIADO_EM','ATUALIZADO_EM'];
    var rows=lista.map(function(x){return [x.id,x.bolao_id,x.bolao_nome,x.usuario_id,x.usuario_nome,x.usuario_email,x.status,x.inscrito,x.cotas_confirmadas,x.cotas_pendentes,x.cotas_reservadas,x.created_at,x.updated_at];});
    return {headers:headers,rows:rows};
  }
  function tabelaPagamentos(lista){
    var headers=['DATA','EMAIL','LOTERIA','URL_COMPROVANTE','STATUS','PAGADOR','VALOR','ID_TRANSACAO','AUTENTICACAO','ARQUIVO_URL','RECEBEDOR','PIX_DESTINO','VALIDACAO','MES_REFERENCIA','TIPO_COTA','IDENTIFICADOR','PARTES_COTA','PARTICIPANTES_COTA'];
    var rows=lista.map(function(x){return [x.data_pagamento||x.created_at,x.usuario_email||'',x.bolao_nome||x.bolao_id||'','',x.status||'',x.pagador||'',x.valor||0,x.legacy_id||'','','',x.recebedor||'','',x.observacao||'','','','','',''];});
    return {headers:headers,rows:rows};
  }

  async function dadosAdminSupabase(nomeAba){
    var a=normal(nomeAba),lista;
    fonte.aba=a;
    if(a==='USUARIOS'){lista=await rpc('pss_admin_usuarios_fast');return tabelaUsuarios(lista);}
    if(a==='PAGAMENTOS'){lista=await rpc('pss_admin_pagamentos_fast');return tabelaPagamentos(lista);}
    if(a==='PARTICIPANTES_BOLAO'||a==='PARTICIPANTES'){lista=await rpc('pss_admin_participantes_fast');return tabelaParticipantes(lista);}
    return null;
  }

  function instalarApiMulti(){
    var base=window.apiMulti;
    if(typeof base!=='function'||base.__PSS_SUPABASE_ADMIN_FAST_V1__)return false;
    var nova=async function(tentativas){
      try{
        if(Array.isArray(tentativas)&&tentativas.length===1){
          var t=tentativas[0]||{};
          if(t.action==='getDadosAdmin'){
            var aba=(t.dados&&t.dados.nomeAba)||(t.args&&t.args[0])||'';
            var r=await dadosAdminSupabase(aba);
            if(r){window.PSS_LAST_DATA_SOURCE={origem:fonte.origem,ms:fonte.ms,aba:aba,ts:Date.now()};return r;}
          }
        }
      }catch(e){fonte.erro=String((e&&e.message)||e);}
      return base.apply(this,arguments);
    };
    nova.__PSS_SUPABASE_ADMIN_FAST_V1__=true;nova.__base=base;
    window.apiMulti=nova;try{apiMulti=nova;}catch(e){}
    return true;
  }

  function badge(){
    var d=window.PSS_LAST_DATA_SOURCE;
    if(!d||Date.now()-d.ts>5000)return;
    var panel=document.querySelector('#view .panel');
    if(!panel||panel.querySelector('.pss-source-proof'))return;
    var el=document.createElement('div');
    el.className='pss-source-proof';
    el.style.cssText='margin:0 0 10px;padding:7px 10px;border-radius:9px;background:#e8f8ec;color:#064f1e;font-size:12px;font-weight:900';
    el.textContent='Fonte: '+d.origem+' • '+d.ms+' ms';
    panel.insertBefore(el,panel.firstChild);
  }
  var baseSet=null;
  function instalarSetView(){
    var s=window.setView;
    if(typeof s!=='function'||s.__PSS_SOURCE_PROOF__)return false;
    baseSet=s;
    var n=function(){var r=baseSet.apply(this,arguments);setTimeout(badge,0);return r;};
    n.__PSS_SOURCE_PROOF__=true;n.__base=baseSet;window.setView=n;try{setView=n;}catch(e){}
    return true;
  }

  window.PSS_SUPABASE_ADMIN_FAST={
    versao:'V1',
    status:function(){return {fonte:fonte,ultimo:window.PSS_LAST_DATA_SOURCE||null,apiMultiInterceptado:!!(window.apiMulti&&window.apiMulti.__PSS_SUPABASE_ADMIN_FAST_V1__)};},
    teste:async function(){var ini=performance.now();var l=await rpc('pss_admin_usuarios_fast');return {ok:true,registros:l.length,ms:Math.round(performance.now()-ini)};}
  };

  instalarApiMulti();instalarSetView();
  [100,400,1000,2500].forEach(function(ms){setTimeout(function(){instalarApiMulti();instalarSetView();},ms);});
})();
