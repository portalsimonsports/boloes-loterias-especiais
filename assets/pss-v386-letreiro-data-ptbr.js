(function () {
  'use strict';

  if (window.PSS_V387_LETREIRO_DATA_PTBR) return;
  window.PSS_V387_LETREIRO_DATA_PTBR = true;

  var RAF_PENDENTE = false;
  var OBSERVADOR = null;
  var TICKER_ATUAL = null;

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

    /* Concurso e data vieram colados: 373407/13/2026. */
    saida = saida.replace(
      /(\d{3,6})(\d{2})\/(\d{2})\/(\d{4})/g,
      function (_, concurso, primeiro, segundo, ano) {
        return concurso + ' • ' + converterPartes(primeiro, segundo, ano);
      }
    );

    /* Data isolada em formato americano ou brasileiro. */
    saida = saida.replace(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      function (_, primeiro, segundo, ano) {
        return converterPartes(primeiro, segundo, ano);
      }
    );

    /* Data ISO. */
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

  function localizarTicker() {
    var seletores = [
      '#resultadosPublicosTickerV213',
      '[id*="resultadosPublicosTicker"]',
      '[id*="resultados"][class*="ticker"]',
      '.resultados-ticker',
      '.ticker-track'
    ];

    for (var i = 0; i < seletores.length; i += 1) {
      var encontrado = document.querySelector(seletores[i]);
      if (encontrado) return encontrado;
    }

    var candidatos = document.querySelectorAll('[id], [class]');
    for (var j = 0; j < candidatos.length; j += 1) {
      var texto = String(candidatos[j].textContent || '');
      if (
        /LOTOF[AÁ]CIL|QUINA|DUPLA SENA|LOTERIA FEDERAL/i.test(texto) &&
        /\d{1,2}\/\d{1,2}\/\d{4}/.test(texto) &&
        texto.length < 5000
      ) {
        return candidatos[j];
      }
    }

    return null;
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
          return NodeFilter.FILTER_ACCEPT;
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
    ticker.setAttribute('data-pss-v387-data-ptbr', '1');
    return mudou;
  }

  function executar() {
    RAF_PENDENTE = false;
    var ticker = localizarTicker();
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

  function observarTicker(ticker) {
    if (OBSERVADOR) OBSERVADOR.disconnect();

    OBSERVADOR = new MutationObserver(function () {
      agendar();
    });

    OBSERVADOR.observe(ticker, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function iniciar() {
    agendar();

    /* Captura o ticker quando ele for criado ou substituído. */
    var observadorPagina = new MutationObserver(function () {
      var ticker = localizarTicker();
      if (ticker && ticker !== TICKER_ATUAL) agendar();
    });

    observadorPagina.observe(document.body, {
      childList: true,
      subtree: true
    });

    /* Reforço leve para atualizações assíncronas do letreiro. */
    var repeticoes = 0;
    var intervalo = window.setInterval(function () {
      repeticoes += 1;
      if (!document.hidden) agendar();
      if (repeticoes >= 90) window.clearInterval(intervalo);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  window.PSS_V387_CORRIGIR_LETREIRO = agendar;
  window.PSS_V387_FORMATAR_DATA_PTBR = function (valor) {
    return corrigirTexto(String(valor == null ? '' : valor));
  };
})();
