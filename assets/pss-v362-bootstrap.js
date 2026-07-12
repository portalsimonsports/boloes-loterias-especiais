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
})();
