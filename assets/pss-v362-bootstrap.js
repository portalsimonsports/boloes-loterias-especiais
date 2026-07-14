(function () {
  'use strict';

  if (window.PSS_V362_BOOTSTRAP) return;
  window.PSS_V362_BOOTSTRAP = true;

  var html = document.documentElement;
  var carregamentos = {};

  try {
    var memoria = Number(navigator.deviceMemory || 0);
    var nucleos = Number(navigator.hardwareConcurrency || 0);
    if ((memoria && memoria <= 4) || (nucleos && nucleos <= 4)) {
      html.classList.add('pss-v362-low-end');
    }
  } catch (erroDispositivo) {}

  window.PSS_V362_VISIVEL = !document.hidden;

  document.addEventListener('visibilitychange', function () {
    window.PSS_V362_VISIVEL = !document.hidden;
    html.classList.toggle('pss-v362-hidden', document.hidden);
  }, { passive: true });

  function idle(callback, timeout) {
    if (typeof window.PSS_V390_IDLE === 'function') {
      return window.PSS_V390_IDLE(callback, timeout || 1200);
    }

    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout: timeout || 1200 });
    }

    return window.setTimeout(callback, Math.min(timeout || 1200, 250));
  }

  function carregarScript(src, atributo) {
    if (carregamentos[atributo]) return carregamentos[atributo];

    var existente = document.querySelector('script[' + atributo + ']');
    if (existente) {
      carregamentos[atributo] = Promise.resolve(existente);
      return carregamentos[atributo];
    }

    carregamentos[atributo] = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute(atributo, '1');
      script.onload = function () { resolve(script); };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });

    return carregamentos[atributo];
  }

  function carregarEssenciais() {
    return Promise.all([
      carregarScript(
        'assets/pss-v390-performance-runtime.js?v=V390_CARREGAMENTO_RAPIDO',
        'data-pss-v390-performance-runtime'
      ),
      carregarScript(
        'assets/pss-v363-login-pagamentos.js?v=V363_FIX_LOGIN_EXCLUIR_COMPROVANTE',
        'data-pss-v363-login-pagamentos'
      ),
      carregarScript(
        'assets/pss-v371-pagamentos-pagos.js?v=V390_PAGAMENTOS_OBSERVER_OTIMIZADO',
        'data-pss-v371-pagamentos-pagos'
      )
    ]);
  }

  function carregarSecundarios() {
    Promise.all([
      carregarScript(
        'assets/pss-v365-corrige-botoes-pagamentos.js?v=V365_CORRIGE_BOTOES_PAGAMENTOS',
        'data-pss-v365-corrige-botoes-pagamentos'
      ),
      carregarScript(
        'assets/pss-v381-cotas-vivas.js?v=V390_COTAS_VIVAS_EFICIENTE',
        'data-pss-v381-cotas-vivas'
      ),
      carregarScript(
        'assets/pss-v386-letreiro-data-ptbr.js?v=V390_LETREIRO_OBSERVER_OTIMIZADO',
        'data-pss-v390-letreiro-data-ptbr'
      )
    ]).catch(function () {});
  }

  function iniciar() {
    carregarEssenciais().finally(function () {
      idle(carregarSecundarios, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
