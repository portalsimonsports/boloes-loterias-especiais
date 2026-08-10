/* Portal SimonSports - Supabase First Bridge V1
 * Camada compatível: tenta Supabase quando configurado e mantém o backend legado intacto.
 * Nenhuma chave service_role deve ser usada aqui.
 */
(function () {
  'use strict';

  if (window.PSS_SUPABASE_BRIDGE) return;

  var CACHE_KEY = 'PSS_SUPABASE_PUBLIC_SNAPSHOT_V1';
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var configPromise = null;

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
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: agora(), data: data }));
    } catch (e) {}
  }

  function normalizarConfig(c) {
    c = c || {};
    return {
      url: String(c.url || c.supabaseUrl || '').replace(/\/$/, ''),
      key: String(c.key || c.publishableKey || c.anonKey || '')
    };
  }

  function carregarConfig() {
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
    var c = await carregarConfig();
    if (!c.url || !c.key) throw new Error('Supabase público ainda não configurado');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4500);
    try {
      var r = await fetch(c.url + '/rest/v1/rpc/' + encodeURIComponent(nome), {
        method: 'POST',
        headers: {
          'apikey': c.key,
          'Authorization': 'Bearer ' + c.key,
          'Content-Type': 'application/json'
        },
        body: '{}',
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
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
      var dados = {
        boloes: partes[0] || [],
        resultadosPublicos: partes[1] || [],
        configPublica: partes[2] || []
      };
      salvarCache(dados);
      window.dispatchEvent(new CustomEvent('pss:supabase-public-ready', { detail: dados }));
      return { fonte: 'supabase', dados: dados };
    } catch (erro) {
      if (cache && cache.data) return { fonte: 'cache-stale', dados: cache.data, erro: erro };
      return { fonte: 'legacy', dados: null, erro: erro };
    }
  }

  window.PSS_SUPABASE_BRIDGE = {
    versao: 'V1_SUPABASE_FIRST_FALLBACK_LEGACY',
    carregarPublico: carregarPublico,
    limparCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} },
    status: async function () {
      var c = await carregarConfig();
      return { configurado: !!(c.url && c.key), cache: !!lerCache() };
    }
  };
})();
