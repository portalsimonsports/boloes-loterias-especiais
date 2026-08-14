from pathlib import Path
import re

asset = Path('assets/pss-admin-edge-fast-v1.js')
s = asset.read_text(encoding='utf-8')

if 'function instalarContadorInscritosSupabase()' not in s:
    marker = 'function instalar(){instalarApiMulti();instalarApi();instalarPagamentosDireto();instalarParticipantesDireto();instalarResultadosPublicosJson();}'
    if marker not in s:
        raise SystemExit('Marcador do Admin Edge nao localizado')

    bloco = r'''function totalAprovadosSupabase(lista){
  lista=Array.isArray(lista)?lista:[];
  return lista.filter(function(u){
    var ap=u&&u.aprovado;
    var ok=(ap===true||ap===1||String(ap||'').toUpperCase()==='TRUE'||String(ap||'').toUpperCase()==='SIM');
    var st=String((u&&u.status)||'').trim().toUpperCase();
    return ok && st!=='RECUSADO' && st!=='INATIVO' && st!=='CANCELADO';
  }).length;
}
function aplicarContadorInscritosSupabase(total){
  total=Number(total)||0;
  if(total<=0)return false;
  var card=document.getElementById('sistemaAtivoCardV275')||document.querySelector('[id^="sistemaAtivoCard"]');
  if(!card)return false;
  var alterou=false;
  [].slice.call(card.querySelectorAll('button')).forEach(function(b){
    if(/inscritos\s*:/i.test(String(b.textContent||''))){
      b.textContent='👥 Inscritos: '+total;
      alterou=true;
    }
  });
  try{
    window.PSS_RESUMO_INSCRITOS_TOPO=Object.assign({},window.PSS_RESUMO_INSCRITOS_TOPO||{},{totalAprovadosSite:total,totalInscritosSite:total,totalInscritos:total,total:total,origem:'SUPABASE_USUARIOS'});
  }catch(e){}
  return alterou;
}
async function atualizarContadorInscritosSupabase(forcar){
  try{
    var lista=await call('usuarios',!!forcar);
    var total=totalAprovadosSupabase(lista);
    if(total>0)aplicarContadorInscritosSupabase(total);
    return total;
  }catch(e){return 0;}
}
function instalarContadorInscritosSupabase(){
  if(window.PSS_CONTADOR_INSCRITOS_SUPABASE_V14)return true;
  window.PSS_CONTADOR_INSCRITOS_SUPABASE_V14=true;
  var baseInicio=window.renderInicio;
  if(typeof baseInicio==='function'&&!baseInicio.__PSS_INSCRITOS_SUPABASE_V14){
    var novo=async function(){
      var r=await baseInicio.apply(this,arguments);
      [80,250,700,1500].forEach(function(ms){setTimeout(function(){atualizarContadorInscritosSupabase(false);},ms);});
      return r;
    };
    novo.__PSS_INSCRITOS_SUPABASE_V14=true;
    novo.__base=baseInicio;
    window.renderInicio=novo;
    try{renderInicio=novo;}catch(e){}
  }
  [0,150,500,1200,2500].forEach(function(ms){setTimeout(function(){atualizarContadorInscritosSupabase(false);},ms);});
  return true;
}

'''
    s = s.replace(marker, bloco + 'function instalar(){instalarApiMulti();instalarApi();instalarPagamentosDireto();instalarParticipantesDireto();instalarResultadosPublicosJson();instalarContadorInscritosSupabase();}', 1)

s = s.replace("version:'V1.2'", "version:'V1.4_INSCRITOS_SUPABASE'", 1)
asset.write_text(s, encoding='utf-8')

index = Path('index.html')
h = index.read_text(encoding='utf-8')
if 'V10_REARM_4_20260814_1945' not in h:
    raise SystemExit('V10 dos quatro menus nao localizada; abortando')
pat = r"assets/pss-admin-edge-fast-v1\.js\?v=[^\"']+"
rep = 'assets/pss-admin-edge-fast-v1.js?v=V1_4_INSCRITOS_SUPABASE_20260814_2025'
if not re.search(pat, h):
    raise SystemExit('Script Admin Edge nao localizado no index')
h = re.sub(pat, rep, h)
index.write_text(h, encoding='utf-8')
