(function () {
  'use strict';

  if (window.PSS_V386_LETREIRO_DATA_PTBR) return;
  window.PSS_V386_LETREIRO_DATA_PTBR = true;

  var SELETOR_TICKER = '#resultadosPublicosTickerV213';
  var SELETOR_DATA = '.resultado-letreiro-data';
  var observadorTicker = null;
  var tentativaLocalizar = null;
  var tentativas = 0;

  function doisDigitos(valor) {
    return String(Number(valor) || 0).padStart(2, '0');
  }

  function dataValida(ano, mes, dia) {
    var data = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0, 0);
    return (
      !Number.isNaN(data.getTime()) &&
      data.getFullYear() === Number(ano) &&
      data.getMonth() === Number(mes) - 1 &&
      data.getDate() === Number(dia)
    ) ? data : null;
  }

  function distanciaDoHoje(data) {
    if (!data) return Number.POSITIVE_INFINITY;
    return Math.abs(Date.now() - data.getTime());
  }

  function escolherDataComBarras(primeiro, segundo, ano) {
    var a = Number(primeiro);
    var b = Number(segundo);
    var y = Number(ano);

    if (a > 12 && b <= 12) return dataValida(y, b, a);
    if (b > 12 && a <= 12) return dataValida(y, a, b);

    var interpretacaoPtBr = dataValida(y, b, a);
    var interpretacaoUsa = dataValida(y, a, b);

    if (!interpretacaoPtBr) return interpretacaoUsa;
    if (!interpretacaoUsa) return interpretacaoPtBr;

    return distanciaDoHoje(interpretacaoPtBr) <= distanciaDoHoje(interpretacaoUsa)
      ? interpretacaoPtBr
      : interpretacaoUsa;
  }

  function formatarDataPtBr(valor) {
    var texto = String(valor == null ? '' : valor).trim();
    if (!texto) return '';

    var iso = texto.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (iso) {
      var dataIso = dataValida(iso[1], iso[2], iso[3]);
      if (dataIso) {
        return doisDigitos(dataIso.getDate()) + '/' +
          doisDigitos(dataIso.getMonth() + 1) + '/' +
          dataIso.getFullYear();
      }
    }

    var barras = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (barras) {
      var dataBarras = escolherDataComBarras(barras[1], barras[2], barras[3]);
      if (dataBarras) {
        return doisDigitos(dataBarras.getDate()) + '/' +
          doisDigitos(dataBarras.getMonth() + 1) + '/' +
          dataBarras.getFullYear();
      }
    }

    var timestamp = Number(texto);
    if (Number.isFinite(timestamp) && timestamp > 100000000000) {
      var dataTimestamp = new Date(timestamp);
      if (!Number.isNaN(dataTimestamp.getTime())) {
        return new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(dataTimestamp);
      }
    }

    return texto;
  }

  function corrigirDatas(raiz) {
    var escopo = raiz && raiz.querySelectorAll ? raiz : document;
    var elementos = [];

    if (escopo.matches && escopo.matches(SELETOR_DATA)) {
      elementos.push(escopo);
    }

    Array.prototype.push.apply(
      elementos,
      Array.prototype.slice.call(escopo.querySelectorAll(SELETOR_DATA))
    );

    elementos.forEach(function (elemento) {
      var original = String(elemento.textContent || '').trim();
      var corrigida = formatarDataPtBr(original);

      if (corrigida && corrigida !== original) {
        elemento.textContent = corrigida;
      }

      elemento.setAttribute('lang', 'pt-BR');
      elemento.setAttribute('data-pss-v386-data-ptbr', '1');
    });
  }

  function observarTicker(ticker) {
    if (!ticker || ticker.getAttribute('data-pss-v386-observado') === '1') return;

    ticker.setAttribute('data-pss-v386-observado', '1');
    corrigirDatas(ticker);

    observadorTicker = new MutationObserver(function (mutacoes) {
      var precisaCorrigir = mutacoes.some(function (mutacao) {
        return mutacao.type === 'childList' || mutacao.type === 'characterData';
      });

      if (precisaCorrigir) {
        window.requestAnimationFrame(function () {
          corrigirDatas(ticker);
        });
      }
    });

    observadorTicker.observe(ticker, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function localizarTicker() {
    tentativas += 1;

    var ticker = document.querySelector(SELETOR_TICKER);
    if (ticker) {
      observarTicker(ticker);
      if (tentativaLocalizar) {
        window.clearInterval(tentativaLocalizar);
        tentativaLocalizar = null;
      }
      return;
    }

    if (tentativas >= 120 && tentativaLocalizar) {
      window.clearInterval(tentativaLocalizar);
      tentativaLocalizar = null;
    }
  }

  function inserirEstilo() {
    if (document.getElementById('pss-v386-letreiro-data-ptbr-style')) return;

    var style = document.createElement('style');
    style.id = 'pss-v386-letreiro-data-ptbr-style';
    style.textContent = [
      '.resultado-letreiro-data{white-space:nowrap}',
      '.resultado-letreiro-concurso + .resultado-letreiro-data::before{content:" • ";display:inline;color:inherit;margin:0 .18em}'
    ].join('');
    document.head.appendChild(style);
  }

  inserirEstilo();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', localizarTicker, { once: true });
  } else {
    localizarTicker();
  }

  tentativaLocalizar = window.setInterval(localizarTicker, 500);

  window.PSS_V386_FORMATAR_DATA_PTBR = formatarDataPtBr;
  window.PSS_V386_CORRIGIR_LETREIRO = function () {
    var ticker = document.querySelector(SELETOR_TICKER);
    if (ticker) corrigirDatas(ticker);
  };
})();
