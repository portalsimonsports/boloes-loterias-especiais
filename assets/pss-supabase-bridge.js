/* Portal SimonSports - Supabase First Bridge V2
 * Supabase primeiro para leitura pública; backend legado permanece como fallback.
 * Nenhuma chave service_role deve ser usada neste arquivo.
 */
(function () {
  'use strict';

  if (window.PSS_SUPABASE_BRIDGE && window.PSS_SUPABASE_BRIDGE.versao === 'V2_CONFIG_SUPABASE_FIRST') return;

  var CACHE_KEY = 'PSS_SUPABASE_PUBLIC_SNAPSHOT_V1';
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var configPromise = null;
  var prefetchPromise = null;

  function agora() { return Date.now(); }

  function lerCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.data) return null;
      return obj;
    } catch (e) { return null; }
  }

  function salvarCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: agora(), data: data })); } catch (e) {}
  }

  function normalizarConfig(c) {
    c = c || {};
    return {
      url: String(c.url || c.supabaseUrl || '').replace(/\/$/, ''),
      key: String(c.key || c.publishableKey || c.anonKey || '')
    };
  }

  function carregarConfigSupabase() {
    if (configPromise) return configPromise;
    configPromise = (async function () {
      var inline = normalizarConfig(window.PSS_SUPABASE_PUBLIC || {});
      if (inline.url && inline.key) return inline;
      try {
        var r = await fetch('./api/supabase-public.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('config HTTP ' + r.status);
        var c = normalizarConfig(await r.json());
        if (c.url && c.key) return c;
      } catch (e) {}
      return { url: '', key: '' };
    })();
    return configPromise;
  }

  async function rpc(nome) {
    var c = await carregarConfigSupabase();
    if (!c.url || !c.key) throw new Error('Supabase público ainda não configurado');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4500);
    try {
      var r = await fetch(c.url + '/rest/v1/rpc/' + encodeURIComponent(nome), {
        method: 'POST',
        headers: {
          'apikey': c.key,
          'Content-Type': 'application/json'
        },
        body: '{}',
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function carregarPublico(opcoes) {
    opcoes = opcoes || {};
    var cache = lerCache();
    if (!opcoes.forcar && cache && (agora() - Number(cache.ts || 0) < CACHE_TTL_MS)) {
      return { fonte: 'cache', dados: cache.data };
    }
    try {
      var partes = await Promise.all([
        rpc('pss_boloes_publicos'),
        rpc('pss_resultados_publicos'),
        rpc('pss_configuracoes_publicas')
      ]);
      var dados = { boloes: partes[0] || [], resultadosPublicos: partes[1] || [], configPublica: partes[2] || [] };
      salvarCache(dados);
      try { window.PSS_SUPABASE_PUBLIC_DATA = dados; } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('pss:supabase-public-ready', { detail: dados })); } catch (e) {}
      return { fonte: 'supabase', dados: dados };
    } catch (erro) {
      if (cache && cache.data) return { fonte: 'cache-stale', dados: cache.data, erro: erro };
      return { fonte: 'legacy', dados: null, erro: erro };
    }
  }

  function listaConfigCompat(dados) {
    var lista = dados && Array.isArray(dados.boloes) ? dados.boloes : [];
    return lista.map(function (b) {
      return Object.assign({}, b, {
        ID: b.id, ID_BOLAO: b.id, idBolao: b.id,
        NOME: b.nome, NOME_BOLAO: b.nome, LOTERIA: b.loteria || b.nome, STATUS: b.status,
        DATA_SORTEIO: b.data_sorteio, INI_BOL: b.inicio_pagamento, FIM_BOL: b.fim_pagamento,
        INI_PAL: b.inicio_palpite, FIM_PAL: b.fim_palpite, VALOR_COTA: b.valor_cota,
        TOTAL_COTAS: b.total_cotas, COTAS_CONFIRMADAS: b.cotas_adquiridas,
        COTAS_RESTANTES: b.cotas_disponiveis, PREMIACAO: b.premiacao,
        PREMIO_POR_COTA: b.premio_por_cota, RANGE: b.faixa_numeros,
        QTD_MIN: b.qtd_min, QTD_MAX: b.qtd_max, QTD_PALPITE: b.qtd_palpite,
        NUMEROS_SORTEADOS: b.numeros_sorteados
      });
    });
  }

  function instalarConfigSupabaseFirst() {
    var legado = null;
    try { legado = window.carregarConfigV341; } catch (e) {}
    if (typeof legado !== 'function' || legado.__PSS_SUPABASE_FIRST__) return false;
    var nova = async function () {
      var r = await carregarPublico({ forcar: false });
      if (r && r.dados && Array.isArray(r.dados.boloes) && r.dados.boloes.length) {
        return { origem: r.fonte === 'supabase' ? 'Supabase PostgreSQL' : 'cache Supabase', lista: listaConfigCompat(r.dados), supabase: true };
      }
      return legado.apply(this, arguments);
    };
    nova.__PSS_SUPABASE_FIRST__ = true;
    nova.__PSS_LEGACY__ = legado;
    window.carregarConfigV341 = nova;
    try { carregarConfigV341 = nova; } catch (e) {}
    return true;
  }

  function iniciar() {
    instalarConfigSupabaseFirst();
    if (!prefetchPromise) prefetchPromise = carregarPublico({ forcar: false }).catch(function () { return null; });
    setTimeout(instalarConfigSupabaseFirst, 0);
    setTimeout(instalarConfigSupabaseFirst, 250);
    setTimeout(instalarConfigSupabaseFirst, 1000);
  }

  window.PSS_SUPABASE_BRIDGE = {
    versao: 'V2_CONFIG_SUPABASE_FIRST',
    carregarPublico: carregarPublico,
    instalarConfigSupabaseFirst: instalarConfigSupabaseFirst,
    limparCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} },
    status: async function () {
      var c = await carregarConfigSupabase();
      return { configurado: !!(c.url && c.key), cache: !!lerCache(), configInterceptada: !!(window.carregarConfigV341 && window.carregarConfigV341.__PSS_SUPABASE_FIRST__) };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
