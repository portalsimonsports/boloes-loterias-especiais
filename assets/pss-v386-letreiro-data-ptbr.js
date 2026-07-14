(function () {
  'use strict';

  if (window.PSS_V387_LETREIRO_DATA_PTBR) return;
  window.PSS_V387_LETREIRO_DATA_PTBR = true;

  var RAF_PENDENTE = false;
  var OBSERVADOR_TICKER = null;
  var OBSERVADOR_PAGINA = null;
  var TICKER_ATUAL = null;
  var TENTATIVAS = [0, 400, 1200, 3000, 7000, 15000];
  var SELETOR = [
    '#resultadosPublicosTickerV213',
    '[id*="resultadosPublicosTicker"]',
    '[id*="resultados"][class*="ticker"]',
    '.resultados-ticker',
    '.resultados-ticker-track',
    '.ticker-track'
  ].join(',');

  function dois(valor) {
    return String(Number(valor) || 0).padStart(2, '0');
  }

  function criarData(ano, mes, dia) {
    var data = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0, 0);
    return (
      !Number.isNaN(data.getTime()) &&
      data.getFullYear() === Number(ano) &&
      data.getMonth() === Number(mes) - 1 &&
      data.getDate() === Number(dia)
    ) ? data : null;
  }

  function distanciaHoje(data) {
    return data ? Math.abs(Date.now() - data.getTime()) : Number.POSITIVE_INFINITY;
  }

  function converterPartes(primeiro, segundo, ano) {
    var a = Number(primeiro);
    var b = Number(segundo);
    var y = Number(ano);
    var escolhida = null;

    if (a > 12 && b <= 12) {
      escolhida = criarData(y, b, a);
    } else if (b > 12 && a <= 12) {
      escolhida = criarData(y, a, b);
    } else {
      var ptbr = criarData(y, b, a);
      var americana = criarData(y, a, b);

      if (!ptbr) escolhida = americana;
      else if (!americana) escolhida = ptbr;
      else escolhida = distanciaHoje(ptbr) <= distanciaHoje(americana) ? ptbr : americana;
    }

    if (!escolhida) return primeiro + '/' + segundo + '/' + ano;

    return dois(escolhida.getDate()) + '/' +
      dois(escolhida.getMonth() + 1) + '/' +
      escolhida.getFullYear();
  }

  function corrigirTexto(texto) {
    var saida = String(texto == null ? '' : texto);

    saida = saida.replace(
      /(\d{3,6})(\d{2})\/(\d{2})\/(\d{4})/g,
      function (_, concurso, primeiro, segundo, ano) {
        return concurso + ' • ' + converterPartes(primeiro, segundo, ano);
      }
    );

    saida = saida.replace(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      function (_, primeiro, segundo, ano) {
        return converterPartes(primeiro, segundo, ano);
      }
    );

    saida = saida.replace(
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      function (_, ano, mes, dia) {
        var data = criarData(ano, mes, dia);
        return data
          ? dois(data.getDate()) + '/' + dois(data.getMonth() + 1) + '/' + data.getFullYear()
          : _;
      }
    );

    return saida;
  }

  function localizarTicker(raiz) {
    var escopo = raiz && raiz.querySelector ? raiz : document;
    if (escopo.matches && escopo.matches(SELETOR)) return escopo;
    return escopo.querySelector ? escopo.querySelector(SELETOR) : null;
  }

  function corrigirTicker(ticker) {
    if (!ticker) return false;

    var walker = document.createTreeWalker(
      ticker,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var pai = node.parentElement;
          if (!pai || /^(SCRIPT|STYLE|NOSCRIPT)$/i.test(pai.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{1,2}-\d{1,2}/.test(node.nodeValue || '')
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );

    var nos = [];
    var no;
    while ((no = walker.nextNode())) nos.push(no);

    var anterior = '';
    var mudou = false;

    nos.forEach(function (textoNode) {
      var original = textoNode.nodeValue || '';
      var corrigido = corrigirTexto(original);

      if (
        /^\s*\d{1,2}\/\d{1,2}\/\d{4}/.test(corrigido) &&
        /\d\s*$/.test(anterior) &&
        !/[•·|\-]\s*$/.test(anterior)
      ) {
        corrigido = ' • ' + corrigido.replace(/^\s+/, '');
      }

      if (corrigido !== original) {
        textoNode.nodeValue = corrigido;
        mudou = true;
      }

      var significativo = String(corrigido || '').trim();
      if (significativo) anterior = significativo;
    });

    ticker.setAttribute('lang', 'pt-BR');
    ticker.setAttribute('data-pss-v390-data-ptbr', '1');
    return mudou;
  }

  function observarTicker(ticker) {
    if (OBSERVADOR_TICKER) OBSERVADOR_TICKER.disconnect();

    OBSERVADOR_TICKER = new MutationObserver(function (registros) {
      var relevante = registros.some(function (registro) {
        if (registro.type === 'characterData') return true;
        return registro.addedNodes && registro.addedNodes.length > 0;
      });
      if (relevante) agendar();
    });

    OBSERVADOR_TICKER.observe(ticker, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function executar() {
    RAF_PENDENTE = false;
    if (document.hidden) return;

    var ticker = localizarTicker(document);
    if (!ticker) return;

    if (ticker !== TICKER_ATUAL) {
      TICKER_ATUAL = ticker;
      observarTicker(ticker);
    }

    corrigirTicker(ticker);
  }

  function agendar() {
    if (RAF_PENDENTE) return;
    RAF_PENDENTE = true;
    window.requestAnimationFrame(executar);
  }

  function nodePodeConterTicker(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches && node.matches(SELETOR)) return true;
    return !!(node.querySelector && node.querySelector(SELETOR));
  }

  function observarPagina() {
    if (!document.body || OBSERVADOR_PAGINA) return;

    OBSERVADOR_PAGINA = new MutationObserver(function (registros) {
      var tickerNovo = null;

      registros.some(function (registro) {
        return Array.prototype.some.call(registro.addedNodes || [], function (node) {
          if (!nodePodeConterTicker(node)) return false;
          tickerNovo = localizarTicker(node) || localizarTicker(document);
          return !!tickerNovo;
        });
      });

      if (tickerNovo && tickerNovo !== TICKER_ATUAL) agendar();
    });

    OBSERVADOR_PAGINA.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function iniciar() {
    observarPagina();
    TENTATIVAS.forEach(function (atraso) {
      window.setTimeout(agendar, atraso);
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) agendar();
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  window.PSS_V387_CORRIGIR_LETREIRO = agendar;
  window.PSS_V387_FORMATAR_DATA_PTBR = function (valor) {
    return corrigirTexto(String(valor == null ? '' : valor));
  };
  window.PSS_V390_DIAGNOSTICAR_LETREIRO = function () {
    return {
      sucesso: true,
      versao: 'V390_LETREIRO_OBSERVER_OTIMIZADO',
      tickerLocalizado: !!TICKER_ATUAL,
      buscaGlobalPorTodosElementos: false,
      intervaloContinuo: false
    };
  };
})();
