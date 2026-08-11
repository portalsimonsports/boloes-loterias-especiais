/* Portal SimonSports — Data Fast Router V2
 * Somente roteamento de LEITURA. Não altera layout/renderizadores/escritas.
 */
(function(){
'use strict';
if(window.PSS_DATA_FAST_ROUTER_V2)return;
window.PSS_DATA_FAST_ROUTER_V2=true;

function norm(v){return String(v||'').trim().toUpperCase();}
function fast(){return window.PSS_DATA_FAST&&typeof window.PSS_DATA_FAST.bootstrap==='function';}

async function boloesFast(){
  if(!fast())throw new Error('DATA_FAST_NAO_INICIALIZADO');
  var b=await window.PSS_DATA_FAST.bootstrap(false);
  var lista=(b&&Array.isArray(b.boloes))?b.boloes:[];
  try{
    if(window.ESTADO){
      ESTADO.boloes=lista;
      ESTADO.boloesCompletoV267=lista;
      ESTADO.boloesCompletoV268=lista;
      ESTADO.boloesCompletoV277=lista;
    }
  }catch(e){}
  return lista;
}

function instalarLoaders(){
  if(!fast())return false;
  window.PSS_carregarBoloesRapidoV268_=async function(){return boloesFast();};
  window.PSS_carregarBoloesCompletoV267_=async function(){return boloesFast();};
  window.PSS_carregarBoloesV277_=async function(){return boloesFast();};
  return true;
}

var READ={};[
 'checarStatusPalpite','getStatusPalpite','obterDadosPalpite','getDadosPalpite',
 'getHistoricoComprovantes','historicoComprovantes','getDadosRecebimento','listarDadosRecebimento',
 'getJogosRealizadosBolao','listarJogosRealizadosBolao','getJogosBolao',
 'getLoteriasPagamentoAtivas','listarBoloes','getConfigBoloesRapidoV233','listarConfigBoloesRapidoV233','getBoloesAtivos',
 'getEstatisticasAtivaUsuario','getEstatisticasAtiva','dashboard','getResumoInscritosBoloes','resumoInscritosBoloes',
 'getDadosAdmin','getDadosRecebimentoAdmin','getBaseLoteriasTemplates','listarBaseLoteriasTemplates',
 'getRegulamento','obterRegulamento','getRegulamentoRapidoV222','getConfigPublica','getTelegramCanalLink'
].forEach(function(x){READ[norm(x)]=1;});

function instalarJsonp(){
  var base=window.apiJsonpDireto_;
  if(typeof base!=='function'||base.__PSS_DATA_FAST_ROUTER_V2__)return false;
  var nova=async function(action,dados,args){
    if(READ[norm(action)]&&typeof window.api==='function'){
      try{return await window.api(action,dados||{},args||[]);}catch(e){
        window.PSS_DATA_FAST_ROUTER_ERROR=String((e&&e.message)||e);
      }
    }
    return base.apply(this,arguments);
  };
  nova.__PSS_DATA_FAST_ROUTER_V2__=true;
  nova.__base=base;
  window.apiJsonpDireto_=nova;
  try{apiJsonpDireto_=nova;}catch(e){}
  return true;
}

function instalar(){instalarLoaders();instalarJsonp();}
instalar();
[50,150,350,800,1500,3000].forEach(function(ms){setTimeout(instalar,ms);});
window.PSS_DATA_FAST_ROUTER={version:'V2',status:function(){return {fast:fast(),jsonp:!!(window.apiJsonpDireto_&&window.apiJsonpDireto_.__PSS_DATA_FAST_ROUTER_V2__),erro:window.PSS_DATA_FAST_ROUTER_ERROR||''};}};
})();
