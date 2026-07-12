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

  function carregarCorrecaoV363() {
    if (window.PSS_V363_LOGIN_PAGAMENTOS_APLICADO) return;
    if (document.querySelector('script[data-pss-v363-login-pagamentos]')) return;

    var script = document.createElement('script');
    script.src = 'assets/pss-v363-login-pagamentos.js?v=V363_FIX_LOGIN_EXCLUIR_COMPROVANTE';
    script.async = false;
    script.setAttribute('data-pss-v363-login-pagamentos', '1');
    document.head.appendChild(script);
  }

  if (document.readyState === 'complete') {
    setTimeout(carregarCorrecaoV363, 0);
  } else {
    window.addEventListener('load', carregarCorrecaoV363, { once: true });
  }
})();
