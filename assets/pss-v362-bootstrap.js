(function () {
  'use strict';

  if (window.PSS_V362_BOOTSTRAP) return;
  window.PSS_V362_BOOTSTRAP = true;

  var html = document.documentElement;

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

  function carregarScript(src, atributo, callback) {
    if (document.querySelector('script[' + atributo + ']')) {
      if (callback) callback();
      return;
    }

    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(atributo, '1');
    if (callback) script.onload = callback;
    document.head.appendChild(script);
  }

  function carregarCorrecoes() {
    carregarScript(
      'assets/pss-v363-login-pagamentos.js?v=V363_FIX_LOGIN_EXCLUIR_COMPROVANTE',
      'data-pss-v363-login-pagamentos',
      function () {
        carregarScript(
          'assets/pss-v365-corrige-botoes-pagamentos.js?v=V365_CORRIGE_BOTOES_PAGAMENTOS',
          'data-pss-v365-corrige-botoes-pagamentos',
          function () {
            carregarScript(
              'assets/pss-v369-filtro-pagamentos.js?v=V369_FILTRO_PAGAMENTOS_CORRETO',
              'data-pss-v369-filtro-pagamentos'
            );
          }
        );
      }
    );
  }

  if (document.readyState === 'complete') {
    setTimeout(carregarCorrecoes, 0);
  } else {
    window.addEventListener('load', carregarCorrecoes, { once: true });
  }
})();
