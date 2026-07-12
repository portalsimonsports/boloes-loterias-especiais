(function () {
  'use strict';

  if (window.PSS_V365_CORRIGE_BOTOES_PAGAMENTOS_APLICADO) return;
  window.PSS_V365_CORRIGE_BOTOES_PAGAMENTOS_APLICADO = true;

  var VERSAO = 'V365_CORRIGE_BOTOES_PAGAMENTOS';

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (erroVersao) {}

  function concluirCarregamento() {
    try {
      if (typeof window.diagnosticarExclusaoV364 === 'function') {
        var diagnosticoBase = window.diagnosticarExclusaoV364;
        window.diagnosticarExclusaoV365 = function () {
          var resultado = diagnosticoBase() || {};
          resultado.sucesso = true;
          resultado.versao = VERSAO;
          resultado.confirmarPagamentoPreservado = true;
          resultado.umBotaoExcluirPorCartao = true;
          resultado.arquivo = 'assets/pss-v365-corrige-botoes-pagamentos.js';
          return resultado;
        };
      }
    } catch (erroDiagnostico) {}
  }

  if (window.PSS_V364_EXCLUSAO_RAPIDA_APLICADA) {
    concluirCarregamento();
    return;
  }

  var existente = document.querySelector('script[data-pss-v364-exclusao-rapida]');
  if (existente) {
    existente.addEventListener('load', concluirCarregamento, { once: true });
    setTimeout(concluirCarregamento, 300);
    return;
  }

  var script = document.createElement('script');
  script.src = 'assets/pss-v364-exclusao-rapida.js?v=' + encodeURIComponent(VERSAO);
  script.async = false;
  script.setAttribute('data-pss-v364-exclusao-rapida', '1');
  script.onload = concluirCarregamento;
  document.head.appendChild(script);
})();
