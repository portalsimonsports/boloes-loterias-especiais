(function () {
  'use strict';

  if (window.PSS_V390_PERFORMANCE_RUNTIME) return;
  window.PSS_V390_PERFORMANCE_RUNTIME = true;

  var html = document.documentElement;
  var observer = null;
  var mediaQueue = [];
  var mediaScheduled = false;

  function idle(callback, timeout) {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout: timeout || 1200 });
    }
    return window.setTimeout(function () {
      callback({ didTimeout: true, timeRemaining: function () { return 0; } });
    }, Math.min(timeout || 1200, 250));
  }

  function conexaoEconomica() {
    try {
      var conexao = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return !!(conexao && (conexao.saveData || /(^|-)2g$/.test(String(conexao.effectiveType || ''))));
    } catch (erroConexao) {
      return false;
    }
  }

  function aplicarClasseDispositivo() {
    try {
      var memoria = Number(navigator.deviceMemory || 0);
      var nucleos = Number(navigator.hardwareConcurrency || 0);
      var economica = conexaoEconomica();
      var baixoDesempenho = economica || (memoria > 0 && memoria <= 4) || (nucleos > 0 && nucleos <= 4);

      html.classList.toggle('pss-v390-low-end', baixoDesempenho);
      html.classList.toggle('pss-v390-save-data', economica);
      html.setAttribute('data-pss-performance', 'V390');
    } catch (erroDispositivo) {}
  }

  function pertoDaTela(elemento) {
    try {
      var caixa = elemento.getBoundingClientRect();
      return caixa.top < (window.innerHeight || 800) * 1.35 && caixa.bottom > -200;
    } catch (erroCaixa) {
      return false;
    }
  }

  function otimizarImagem(imagem) {
    if (!imagem || imagem.nodeType !== 1 || imagem.tagName !== 'IMG') return;
    if (imagem.getAttribute('data-pss-sem-lazy') === '1') return;

    if (!imagem.hasAttribute('decoding')) imagem.decoding = 'async';

    if (!imagem.hasAttribute('loading')) {
      imagem.loading = pertoDaTela(imagem) ? 'eager' : 'lazy';
    }

    if (imagem.loading === 'lazy' && !imagem.hasAttribute('fetchpriority')) {
      imagem.setAttribute('fetchpriority', 'low');
    }
  }

  function otimizarIframe(iframe) {
    if (!iframe || iframe.nodeType !== 1 || iframe.tagName !== 'IFRAME') return;
    if (iframe.getAttribute('data-pss-sem-lazy') === '1') return;
    if (!iframe.hasAttribute('loading')) iframe.loading = 'lazy';
  }

  function otimizarElemento(elemento) {
    if (!elemento || elemento.nodeType !== 1) return;

    if (elemento.tagName === 'IMG') otimizarImagem(elemento);
    if (elemento.tagName === 'IFRAME') otimizarIframe(elemento);

    if (elemento.querySelectorAll) {
      Array.prototype.forEach.call(elemento.querySelectorAll('img'), otimizarImagem);
      Array.prototype.forEach.call(elemento.querySelectorAll('iframe'), otimizarIframe);
    }
  }

  function processarFila() {
    mediaScheduled = false;
    var fila = mediaQueue.splice(0, mediaQueue.length);
    fila.forEach(otimizarElemento);
  }

  function enfileirar(elemento) {
    mediaQueue.push(elemento);
    if (mediaScheduled) return;
    mediaScheduled = true;
    idle(processarFila, 700);
  }

  function iniciarObservador() {
    if (!document.body || observer) return;

    observer = new MutationObserver(function (registros) {
      registros.forEach(function (registro) {
        Array.prototype.forEach.call(registro.addedNodes || [], function (node) {
          if (node && node.nodeType === 1) enfileirar(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    aplicarClasseDispositivo();
    enfileirar(document.body || document.documentElement);
    iniciarObservador();
  }

  document.addEventListener('visibilitychange', function () {
    html.classList.toggle('pss-v390-hidden', document.hidden);
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  window.PSS_V390_IDLE = idle;
  window.PSS_V390_OTIMIZAR_MEDIA = function (raiz) {
    enfileirar(raiz || document.body || document.documentElement);
  };
})();
