/* Portal SimonSports - Supabase First Bridge V3
 * CONFIG abre imediatamente pelo snapshot/local JSON.
 * Supabase atualiza em segundo plano; backend legado fica apenas como ultimo fallback.
 * Nenhuma chave service_role deve ser usada neste arquivo.
 */
(function () {
  'use strict';

  if (window.PSS_SUPABASE_BRIDGE && window.PSS_SUPABASE_BRIDGE.versao === 'V3_CONFIG_INSTANT') return;

  var CACHE_KEY = 'PSS_SUPABASE_PUBLIC_SNAPSHOT_V1';
  var configPromise = null;
  var prefetchPromise = null;
  var refreshPromise = null;

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

  function normalizarDados(raw) {
    raw = raw || {};
    return {
      boloes: Array.isArray(raw.boloes) ? raw.boloes : [],
      resultadosPublicos: Array.isArray(raw.resultadosPublicos) ? raw.resultadosPublicos : [],
      configPublica: Array.isArray(raw.configPublica) ? raw.configPublica : []
    };
  }

  function publicarDados(dados) {
    try { window.PSS_SUPABASE_PUBLIC_DATA = dados; } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('pss:supabase-public-ready', { detail: dados })); } catch (e) {}
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
        var r = await fetch('./api/supabase-public.json', { cache: 'default' });
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
    var timer = setTimeout(function () { controller.abort(); }, 3500);
    try {
      var r = await fetch(c.url + '/rest/v1/rpc/' + encodeURIComponent(nome), {
        method: 'POST',
        headers: { 'apikey': c.key, 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function carregarJsonEstatico() {
    var r = await fetch('./dados-publicos.json', { cache: 'default' });
    if (!r.ok) throw new Error('dados-publicos HTTP ' + r.status);
    var dados = normalizarDados(await r.json());
    if (!dados.boloes.length) throw new Error('dados-publicos sem boloes');
    salvarCache(dados);
    publicarDados(dados);
    return dados;
  }

  function atualizarSegundoPlano() {
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
        publicarDados(dados);
        return { fonte: 'supabase', dados: dados };
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  async function carregarPublico(opcoes) {
    opcoes = opcoes || {};
    var cache = lerCache();

    /* STALE-WHILE-REVALIDATE REAL: qualquer snapshot abre imediatamente. */
    if (!opcoes.forcar && cache && cache.data && Array.isArray(cache.data.boloes) && cache.data.boloes.length) {
      atualizarSegundoPlano().catch(function () {});
      return { fonte: 'cache-imediato', dados: cache.data };
    }

    /* Primeira visita: GitHub JSON e muito mais rapido que bloquear em RPC/JSONP. */
    if (!opcoes.forcar) {
      try {
        var estatico = await carregarJsonEstatico();
        atualizarSegundoPlano().catch(function () {});
        return { fonte: 'github-json', dados: estatico };
      } catch (e) {}
    }

    try {
      return await atualizarSegundoPlano();
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

  function instalarConfigSupabaseFirst() {
    var legado = null;
    try { legado = window.carregarConfigV341; } catch (e) {}
    if (typeof legado !== 'function' || legado.__PSS_SUPABASE_FIRST__) return false;

    var nova = async function () {
      var r = await carregarPublico({ forcar: false });
      if (r && r.dados && Array.isArray(r.dados.boloes) && r.dados.boloes.length) {
        return {
          origem: r.fonte === 'supabase' ? 'Supabase PostgreSQL' : (r.fonte === 'github-json' ? 'GitHub JSON' : 'cache local'),
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
    instalarConfigSupabaseFirst();
    if (!prefetchPromise) prefetchPromise = carregarPublico({ forcar: false }).catch(function () { return null; });
    setTimeout(instalarConfigSupabaseFirst, 0);
    setTimeout(instalarConfigSupabaseFirst, 100);
    setTimeout(instalarConfigSupabaseFirst, 400);
    setTimeout(instalarConfigSupabaseFirst, 1000);
  }

  window.PSS_SUPABASE_BRIDGE = {
    versao: 'V3_CONFIG_INSTANT',
    carregarPublico: carregarPublico,
    instalarConfigSupabaseFirst: instalarConfigSupabaseFirst,
    limparCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} },
    status: async function () {
      var c = await carregarConfigSupabase();
      var cache = lerCache();
      return {
        configurado: !!(c.url && c.key),
        cache: !!(cache && cache.data),
        configInterceptada: !!(window.carregarConfigV341 && window.carregarConfigV341.__PSS_SUPABASE_FIRST__),
        versao: 'V3_CONFIG_INSTANT'
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
