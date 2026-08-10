/* Portal SimonSports - Public Data Bridge V4
 * CONFIG abre pelo api/bootstrap.json (leve).
 * Snapshot local abre instantaneamente nas visitas seguintes.
 * Dados completos/Supabase atualizam em segundo plano.
 */
(function () {
  'use strict';

  if (window.PSS_SUPABASE_BRIDGE && window.PSS_SUPABASE_BRIDGE.versao === 'V4_BOOTSTRAP_FAST') return;

  var CACHE_KEY = 'PSS_PUBLIC_BOOTSTRAP_V4';
  var configPromise = null;
  var refreshPromise = null;
  var prefetchPromise = null;

  function lerCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && obj.data ? obj : null;
    } catch (e) { return null; }
  }

  function salvarCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
  }

  function normalizarDados(raw) {
    raw = raw || {};
    return {
      boloes: Array.isArray(raw.boloes) ? raw.boloes : [],
      resultadosPublicos: Array.isArray(raw.resultadosPublicos) ? raw.resultadosPublicos : [],
      configPublica: Array.isArray(raw.configPublica) ? raw.configPublica : []
    };
  }

  function publicarDados(dados, fonte) {
    try { window.PSS_SUPABASE_PUBLIC_DATA = dados; } catch (e) {}
    try { window.PSS_PUBLIC_DATA_SOURCE = fonte || ''; } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('pss:supabase-public-ready', { detail: dados })); } catch (e) {}
  }

  async function carregarBootstrap() {
    var r = await fetch('./api/bootstrap.json', { cache: 'force-cache' });
    if (!r.ok) throw new Error('bootstrap HTTP ' + r.status);
    var dados = normalizarDados(await r.json());
    if (!dados.boloes.length) throw new Error('bootstrap sem boloes');
    salvarCache(dados);
    publicarDados(dados, 'bootstrap');
    return dados;
  }

  async function carregarJsonCompletoSegundoPlano() {
    try {
      var r = await fetch('./dados-publicos.json', { cache: 'default' });
      if (!r.ok) return null;
      var dados = normalizarDados(await r.json());
      if (!dados.boloes.length) return null;
      salvarCache(dados);
      publicarDados(dados, 'github-json-completo');
      return dados;
    } catch (e) { return null; }
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
        var r = await fetch('./api/supabase-public.json', { cache: 'force-cache' });
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
    if (!c.url || !c.key) throw new Error('Supabase publico ainda nao configurado');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 2500);
    try {
      var r = await fetch(c.url + '/rest/v1/rpc/' + encodeURIComponent(nome), {
        method: 'POST',
        headers: { 'apikey': c.key, 'Content-Type': 'application/json' },
        body: '{}', signal: controller.signal, cache: 'no-store'
      });
      if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  function atualizarSupabaseSegundoPlano() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async function () {
      try {
        var partes = await Promise.all([
          rpc('pss_boloes_publicos'),
          rpc('pss_resultados_publicos'),
          rpc('pss_configuracoes_publicas')
        ]);
        var dados = normalizarDados({ boloes: partes[0], resultadosPublicos: partes[1], configPublica: partes[2] });
        if (!dados.boloes.length) throw new Error('Supabase sem boloes');
        salvarCache(dados);
        publicarDados(dados, 'supabase');
        return dados;
      } finally { refreshPromise = null; }
    })();
    return refreshPromise;
  }

  async function carregarPublico(opcoes) {
    opcoes = opcoes || {};
    var cache = lerCache();

    if (!opcoes.forcar && cache && cache.data && Array.isArray(cache.data.boloes) && cache.data.boloes.length) {
      setTimeout(function () { carregarBootstrap().catch(function () {}); }, 0);
      setTimeout(function () { carregarJsonCompletoSegundoPlano(); }, 100);
      setTimeout(function () { atualizarSupabaseSegundoPlano().catch(function () {}); }, 250);
      return { fonte: 'cache-imediato', dados: cache.data };
    }

    if (!opcoes.forcar) {
      try {
        var boot = await carregarBootstrap();
        setTimeout(function () { carregarJsonCompletoSegundoPlano(); }, 50);
        setTimeout(function () { atualizarSupabaseSegundoPlano().catch(function () {}); }, 200);
        return { fonte: 'bootstrap', dados: boot };
      } catch (e) {}
    }

    try {
      var full = await carregarJsonCompletoSegundoPlano();
      if (full) return { fonte: 'github-json', dados: full };
    } catch (e2) {}

    try {
      var sb = await atualizarSupabaseSegundoPlano();
      return { fonte: 'supabase', dados: sb };
    } catch (erro) {
      if (cache && cache.data) return { fonte: 'cache-stale', dados: cache.data, erro: erro };
      return { fonte: 'legacy', dados: null, erro: erro };
    }
  }

  function primeiro() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function listaConfigCompat(dados) {
    var lista = dados && Array.isArray(dados.boloes) ? dados.boloes : [];
    return lista.map(function (b) {
      return Object.assign({}, b, {
        ID: b.id, ID_BOLAO: b.id, idBolao: b.id,
        NOME: b.nome, NOME_BOLAO: b.nome, LOTERIA: b.loteria || b.nome, STATUS: b.status,
        DATA_SORTEIO: primeiro(b.data_sorteio, b.dataSorteio),
        INI_BOL: primeiro(b.inicio_pagamento, b.inicioPagamento),
        FIM_BOL: primeiro(b.fim_pagamento, b.fimPagamento),
        INI_PAL: primeiro(b.inicio_palpite, b.inicioPalpite),
        FIM_PAL: primeiro(b.fim_palpite, b.fimPalpite),
        VALOR_COTA: primeiro(b.valor_cota, b.valorCota),
        TOTAL_COTAS: primeiro(b.total_cotas, b.totalCotas, b.cotasTotal),
        COTAS_CONFIRMADAS: primeiro(b.cotas_adquiridas, b.cotasAdquiridas),
        COTAS_RESTANTES: primeiro(b.cotas_disponiveis, b.cotasDisponiveis),
        PREMIACAO: b.premiacao,
        PREMIO_POR_COTA: primeiro(b.premio_por_cota, b.premioPorCota),
        RANGE: primeiro(b.faixa_numeros, b.faixaNumeros),
        QTD_MIN: primeiro(b.qtd_min, b.qtdMin),
        QTD_MAX: primeiro(b.qtd_max, b.qtdMax),
        QTD_PALPITE: primeiro(b.qtd_palpite, b.qtdPalpite),
        NUMEROS_SORTEADOS: primeiro(b.numeros_sorteados, b.numerosSorteados)
      });
    });
  }

  function instalarConfigFast() {
    var legado = null;
    try { legado = window.carregarConfigV341; } catch (e) {}
    if (typeof legado !== 'function' || legado.__PSS_SUPABASE_FIRST__) return false;

    var nova = async function () {
      var r = await carregarPublico({ forcar: false });
      if (r && r.dados && Array.isArray(r.dados.boloes) && r.dados.boloes.length) {
        return {
          origem: r.fonte === 'supabase' ? 'Supabase PostgreSQL' : (r.fonte === 'bootstrap' ? 'Bootstrap GitHub' : (r.fonte === 'github-json' ? 'GitHub JSON' : 'cache local')),
          lista: listaConfigCompat(r.dados),
          supabase: true
        };
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
    instalarConfigFast();
    if (!prefetchPromise) prefetchPromise = carregarPublico({ forcar: false }).catch(function () { return null; });
    [0,25,75,150,300,600,1000].forEach(function (ms) { setTimeout(instalarConfigFast, ms); });
  }

  window.PSS_SUPABASE_BRIDGE = {
    versao: 'V4_BOOTSTRAP_FAST',
    carregarPublico: carregarPublico,
    instalarConfigSupabaseFirst: instalarConfigFast,
    limparCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} },
    status: async function () {
      var c = await carregarConfigSupabase();
      var cache = lerCache();
      return {
        configurado: !!(c.url && c.key),
        cache: !!(cache && cache.data),
        configInterceptada: !!(window.carregarConfigV341 && window.carregarConfigV341.__PSS_SUPABASE_FIRST__),
        versao: 'V4_BOOTSTRAP_FAST',
        fonte: window.PSS_PUBLIC_DATA_SOURCE || ''
      };
    }
  };

  /* Inicia imediatamente, sem aguardar DOMContentLoaded. */
  iniciar();
})();
