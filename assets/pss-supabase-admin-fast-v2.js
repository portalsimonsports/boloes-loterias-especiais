/* Portal SimonSports - Admin Supabase Fast V2
 * Supabase direto com cache stale-while-revalidate e token Firebase reutilizado.
 * Objetivo: navegação imediata entre telas administrativas já migradas.
 */
(function(){
  'use strict';
  if(window.PSS_SUPABASE_ADMIN_FAST_V2)return;
  window.PSS_SUPABASE_ADMIN_FAST_V2=true;

  var CFG=null;
  var TOKEN={value:'',ts:0};
  var CACHE=new Map();
  var PENDING=new Map();
  var TTL=30000;
  var fonte={origem:'',ms:0,aba:'',erro:''};

  function normal(v){return String(v==null?'':v).trim().toUpperCase();}
  function cacheKey(fn){return 'PSS_SB_ADMIN_V2_'+fn;}
  function lerSession(fn){
    try{var x=JSON.parse(sessionStorage.getItem(cacheKey(fn))||'null');return x&&Array.isArray(x.data)?x:null;}catch(e){return null;}
  }
  function salvarSession(fn,data){try{sessionStorage.setItem(cacheKey(fn),JSON.stringify({ts:Date.now(),data:data}));}catch(e){}}

  async function cfg(){
    if(CFG)return CFG;
    var r=await fetch('./api/supabase-public.json?v=ADMIN_FAST_V2',{cache:'force-cache'});
    if(!r.ok)throw new Error('Config Supabase HTTP '+r.status);
    var j=await r.json();
    CFG={url:String(j.url||j.supabaseUrl||'').replace(/\/$/,''),key:String(j.publishableKey||j.key||j.anonKey||'')};
    if(!CFG.url||!CFG.key)throw new Error('Supabase não configurado');
    return CFG;
  }
  async function token(){
    if(TOKEN.value && Date.now()-TOKEN.ts<2400000)return TOKEN.value;
    var u=null;
    try{u=window.FIREBASE_AUTH&&FIREBASE_AUTH.currentUser;}catch(e){}
    if(!u)try{u=window.firebase&&firebase.auth&&firebase.auth().currentUser;}catch(e){}
    if(!u||typeof u.getIdToken!=='function')throw new Error('Firebase sem usuário autenticado');
    TOKEN.value=await u.getIdToken(false);TOKEN.ts=Date.now();return TOKEN.value;
  }
  async function rpcReal(fn){
    if(PENDING.has(fn))return PENDING.get(fn);
    var p=(async function(){
      var c=await cfg(),t=await token(),ini=performance.now();
      var ctrl=new AbortController(),to=setTimeout(function(){ctrl.abort();},3500);
      try{
        var r=await fetch(c.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}',signal:ctrl.signal,cache:'no-store'});
        if(!r.ok)throw new Error('Supabase '+r.status+' '+(await r.text()).slice(0,160));
        var j=await r.json(),data=Array.isArray(j)?j:(j?[j]:[]);
        CACHE.set(fn,{ts:Date.now(),data:data});salvarSession(fn,data);
        fonte.ms=Math.round(performance.now()-ini);fonte.origem='SUPABASE DIRETO';fonte.erro='';
        return data;
      }finally{clearTimeout(to);PENDING.delete(fn);}
    })();
    PENDING.set(fn,p);return p;
  }
  async function rpcFast(fn){
    var c=CACHE.get(fn)||lerSession(fn);
    if(c&&Array.isArray(c.data)){
      CACHE.set(fn,c);fonte.origem='SUPABASE CACHE';fonte.ms=0;
      if(Date.now()-c.ts>TTL)rpcReal(fn).catch(function(e){fonte.erro=String(e&&e.message||e);});
      return c.data;
    }
    return rpcReal(fn);
  }

  function tabelaUsuarios(lista){var h=['ID','NOME','EMAIL','TELEFONE','STATUS','PERFIL','APROVADO','FIREBASE_UID','CRIADO_EM','ATUALIZADO_EM'];return {headers:h,rows:lista.map(function(x){return [x.id,x.nome,x.email,x.telefone,x.status,x.perfil,x.aprovado,x.firebase_uid,x.created_at,x.updated_at];})};}
  function tabelaParticipantes(lista){var h=['ID','BOLAO_ID','BOLAO','USUARIO_ID','NOME','EMAIL','STATUS','INSCRITO','COTAS_CONFIRMADAS','COTAS_PENDENTES','COTAS_RESERVADAS','CRIADO_EM','ATUALIZADO_EM'];return {headers:h,rows:lista.map(function(x){return [x.id,x.bolao_id,x.bolao_nome,x.usuario_id,x.usuario_nome,x.usuario_email,x.status,x.inscrito,x.cotas_confirmadas,x.cotas_pendentes,x.cotas_reservadas,x.created_at,x.updated_at];})};}
  function tabelaPagamentos(lista){var h=['DATA','EMAIL','LOTERIA','URL_COMPROVANTE','STATUS','PAGADOR','VALOR','ID_TRANSACAO','AUTENTICACAO','ARQUIVO_URL','RECEBEDOR','PIX_DESTINO','VALIDACAO','MES_REFERENCIA','TIPO_COTA','IDENTIFICADOR','PARTES_COTA','PARTICIPANTES_COTA'];return {headers:h,rows:lista.map(function(x){return [x.data_pagamento||x.created_at,x.usuario_email||'',x.bolao_nome||x.bolao_id||'','',x.status||'',x.pagador||'',x.valor||0,x.legacy_id||'','','',x.recebedor||'','',x.observacao||'','','','','',''];})};}

  async function dadosAdmin(nomeAba){
    var a=normal(nomeAba),fn='',conv=null;fonte.aba=a;
    if(a==='USUARIOS'){fn='pss_admin_usuarios_fast';conv=tabelaUsuarios;}
    else if(a==='PAGAMENTOS'){fn='pss_admin_pagamentos_fast';conv=tabelaPagamentos;}
    else if(a==='PARTICIPANTES_BOLAO'||a==='PARTICIPANTES'){fn='pss_admin_participantes_fast';conv=tabelaParticipantes;}
    else return null;
    return conv(await rpcFast(fn));
  }

  function instalarApiMulti(){
    var base=window.apiMulti;if(typeof base!=='function'||base.__PSS_SUPABASE_ADMIN_FAST_V2__)return false;
    var n=async function(tentativas){
      try{if(Array.isArray(tentativas)&&tentativas.length===1){var t=tentativas[0]||{};if(t.action==='getDadosAdmin'){var aba=(t.dados&&t.dados.nomeAba)||(t.args&&t.args[0])||'';var r=await dadosAdmin(aba);if(r){window.PSS_LAST_DATA_SOURCE={origem:fonte.origem,ms:fonte.ms,aba:aba,ts:Date.now()};return r;}}}}catch(e){fonte.erro=String(e&&e.message||e);}
      return base.apply(this,arguments);
    };
    n.__PSS_SUPABASE_ADMIN_FAST_V2__=true;n.__base=base;window.apiMulti=n;try{apiMulti=n;}catch(e){}return true;
  }

  function prefetch(){
    ['pss_admin_usuarios_fast','pss_admin_pagamentos_fast','pss_admin_participantes_fast'].forEach(function(fn){setTimeout(function(){rpcFast(fn).catch(function(){});},0);});
  }

  window.PSS_SUPABASE_ADMIN_FAST={versao:'V2',status:function(){return {fonte:fonte,cache:Array.from(CACHE.keys())};},limparCache:function(){CACHE.clear();},prefetch:prefetch};
  instalarApiMulti();[50,200,600,1500].forEach(function(ms){setTimeout(instalarApiMulti,ms);});
  setTimeout(prefetch,800);
})();
