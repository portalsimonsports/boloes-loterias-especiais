/* Portal SimonSports — Login Fast V2
 * Acelera autenticação/aprovação sem alterar layout ou regra de aprovação.
 * Após Firebase Auth válido, reutiliza aprovação previamente validada neste aparelho
 * e revalida em segundo plano. Primeiro acesso continua validando no Firebase.
 */
(function(){
'use strict';
if(window.PSS_LOGIN_FAST_V2)return;
window.PSS_LOGIN_FAST_V2=true;
var PROJECT='boloes-loterias-especiais';
var CACHE_PREFIX='PSS_LOGIN_APROVADO_V2_';
var CACHE_TTL=24*60*60*1000;
function el(id){return document.getElementById(id);}
function txt(v){return String(v==null?'':v).trim();}
function esc(s){return txt(s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
function errMsg(e){return String((e&&e.message)||e||'Falha no login.');}
function key(email){return CACHE_PREFIX+String(email||'').trim().toLowerCase();}
function lerCache(email){
 try{
   var c=JSON.parse(localStorage.getItem(key(email))||'null');
   if(!c||!c.usuario||!c.ts)return null;
   if(Date.now()-Number(c.ts)>CACHE_TTL){localStorage.removeItem(key(email));return null;}
   if(String(c.usuario.status||'').toUpperCase()!=='APROVADO'||c.usuario.ativo!==true)return null;
   return c.usuario;
 }catch(e){return null;}
}
function salvarCache(email,u){try{localStorage.setItem(key(email),JSON.stringify({ts:Date.now(),usuario:u}));}catch(e){}}
function limparCache(email){try{localStorage.removeItem(key(email));}catch(e){}}
function field(v){
 if(!v||typeof v!=='object')return null;
 if('stringValue' in v)return v.stringValue;
 if('booleanValue' in v)return !!v.booleanValue;
 if('integerValue' in v)return Number(v.integerValue||0);
 if('doubleValue' in v)return Number(v.doubleValue||0);
 if('timestampValue' in v)return v.timestampValue;
 if('nullValue' in v)return null;
 if(v.mapValue&&v.mapValue.fields)return decode(v.mapValue.fields);
 if(v.arrayValue&&Array.isArray(v.arrayValue.values))return v.arrayValue.values.map(field);
 return null;
}
function decode(fs){var o={};Object.keys(fs||{}).forEach(function(k){o[k]=field(fs[k]);});return o;}
async function aprovadoDireto(email,user){
 var token=await user.getIdToken(false);
 var url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(PROJECT)+'/databases/(default)/documents/usuarios/'+encodeURIComponent(email.toLowerCase());
 var ctrl=new AbortController(),tm=setTimeout(function(){ctrl.abort();},3000);
 try{
   var r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'});
   if(r.status===404)throw new Error('Cadastro não localizado no Firebase. Aguarde aprovação da administração.');
   if(!r.ok)throw new Error('Falha ao verificar aprovação ('+r.status+').');
   var j=await r.json(),d=decode(j.fields||{});
   var st=txt(d.status).toUpperCase(),perfil=txt(d.perfil||'USUARIO').toUpperCase();
   var ativo=d.ativo===true||txt(d.ativo).toUpperCase()==='TRUE'||txt(d.ativo).toUpperCase()==='SIM';
   if(!ativo)throw new Error('Cadastro inativo ou bloqueado.');
   if(st!=='APROVADO')throw new Error('Cadastro ainda não aprovado pela administração.');
   return {nome:txt(d.nome||d.name||email)||email,email:txt(d.email||email).toLowerCase(),perfil:perfil,role:perfil.indexOf('ADMIN')>=0||perfil.indexOf('MESTRE')>=0?'admin':'usuario',status:st,ativo:true};
 }finally{clearTimeout(tm);}
}
function finalizar(u,email){
 try{if(typeof window.normalizarUsuarioSessao_==='function')u=window.normalizarUsuarioSessao_(u);}catch(e){}
 window.ESTADO=window.ESTADO||{};
 ESTADO.usuario=u;ESTADO.email=u.email||email;ESTADO.role=u.role||u.perfil||'usuario';
 try{if(el('lembrarEmail')&&el('lembrarEmail').checked)localStorage.setItem('PSS_BOLAO_EMAIL',ESTADO.email);else localStorage.removeItem('PSS_BOLAO_EMAIL');}catch(e){}
 try{if(typeof window.salvarSessao==='function')window.salvarSessao(u);else localStorage.setItem('PSS_BOLAO_SESSAO',JSON.stringify(Object.assign({},u,{_auth:'firebase',_ts:Date.now()})));}catch(e){}
 if(typeof window.aplicarLayoutLogado==='function')window.aplicarLayoutLogado();
 if(typeof window.navegar==='function')window.navegar('inicio');
}
async function revalidarFundo(email,user){
 try{
   var novo=await aprovadoDireto(email,user);
   salvarCache(email,novo);
 }catch(e){
   var m=errMsg(e);
   if(/inativo|bloqueado|não aprovado|nao aprovado|não localizado|nao localizado/i.test(m)){
     limparCache(email);
     try{var a=window.FIREBASE_AUTH||(window.firebase&&firebase.auth&&firebase.auth());if(a)await a.signOut();}catch(_e){}
     try{localStorage.removeItem('PSS_BOLAO_SESSAO');}catch(_e2){}
     try{if(typeof window.renderLogin==='function')window.renderLogin();}catch(_e3){}
   }
 }
}
window.fazerLogin=async function(ev){
 if(ev&&ev.preventDefault)ev.preventDefault();
 var email=txt(el('loginEmail')&&el('loginEmail').value).toLowerCase();
 var senha=txt(el('loginSenha')&&el('loginSenha').value);
 var btn=el('btnLogin'),msg=el('loginMsg');
 if(msg)msg.innerHTML='<div class="notice info">Autenticando...</div>';
 if(btn){btn.disabled=true;btn.textContent='Entrando...';}
 try{
   if(typeof window.inicializarFirebase_!=='function')throw new Error('Firebase não inicializado.');
   await window.inicializarFirebase_();
   var auth=window.FIREBASE_AUTH||(window.firebase&&firebase.auth&&firebase.auth());
   if(!auth)throw new Error('Firebase Auth indisponível.');
   var cred=await auth.signInWithEmailAndPassword(email,senha);
   var user=(cred&&cred.user)||auth.currentUser;
   if(!user)throw new Error('Usuário Firebase não localizado.');
   var cached=lerCache(email);
   if(cached){
     finalizar(cached,email);
     setTimeout(function(){revalidarFundo(email,user);},0);
     return;
   }
   if(msg)msg.innerHTML='<div class="notice info">Verificando aprovação...</div>';
   var u=await aprovadoDireto(email,user);
   salvarCache(email,u);
   finalizar(u,email);
 }catch(e){
   try{var a=window.FIREBASE_AUTH||(window.firebase&&firebase.auth&&firebase.auth());if(a)await a.signOut();}catch(_e){}
   if(msg)msg.innerHTML='<div class="notice error">'+esc(errMsg(e))+'</div>';
 }finally{if(btn){btn.disabled=false;btn.textContent='Entrar no sistema';}}
};
window.PSS_LOGIN_FAST={version:'V2',cacheTtlMs:CACHE_TTL};
})();
