(function () {
  'use strict';

  if (window.PSS_V368_PAGAMENTOS_PAGOS_RECOLHIDOS) return;
  window.PSS_V368_PAGAMENTOS_PAGOS_RECOLHIDOS = true;

  var VERSAO = 'V368_PAGAMENTOS_PAGOS_RECOLHIDOS';
  var grupoAberto = '';
  var timerAplicar = 0;

  function texto(valor) {
    return String(valor == null ? '' : valor)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  function instalarEstilos() {
    if (document.getElementById('pss-v368-pagamentos-recolhidos-css')) return;

    var style = document.createElement('style');
    style.id = 'pss-v368-pagamentos-recolhidos-css';
    style.textContent = [
      '.pss-v368-resumo-toggle{position:relative;cursor:pointer;user-select:none;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;padding-bottom:38px!important}',
      '.pss-v368-resumo-toggle:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,70,28,.10);border-color:rgba(0,120,45,.45)!important}',
      '.pss-v368-resumo-toggle:focus-visible{outline:3px solid rgba(0,123,54,.28);outline-offset:2px}',
      '.pss-v368-resumo-toggle::after{content:"Ver pagamentos pagos ▼";position:absolute;left:12px;right:12px;bottom:9px;min-height:23px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef8f1;border:1px solid #cfe6d6;color:#075b25;font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase}',
      '.pss-v368-resumo-toggle[aria-expanded="true"]{border-color:#08782f!important;box-shadow:0 7px 20px rgba(0,95,36,.14)}',
      '.pss-v368-resumo-toggle[aria-expanded="true"]::after{content:"Ocultar pagamentos pagos ▲";background:#08782f;border-color:#08782f;color:#fff}',
      '.pss-v368-pago-oculto{display:none!important}',
      '.pss-v368-pago-aberto{scroll-margin-top:170px;animation:pssV368Abrir .18s ease-out}',
      '@keyframes pssV368Abrir{from{opacity:.35;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}',
      '@media(max-width:700px){.pss-v368-resumo-toggle{padding-bottom:42px!important}.pss-v368-resumo-toggle::after{font-size:10px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function dadosResumo(elemento) {
    var t = texto(elemento && elemento.textContent);
    var encontrado = t.match(/(\d{2}\/\d{4})\s*[·•]\s*(.+?)(?=\s+R\$\s*[\d.]+(?:,\d{2})?)/i);
    if (!encontrado) return null;

    var mes = encontrado[1];
    var loteria = texto(encontrado[2]);
    if (!mes || !loteria) return null;

    return {
      mes: mes,
      loteria: loteria,
      chave: mes + '|' + normalizar(loteria)
    };
  }

  function pareceResumo(elemento) {
    if (!elemento || elemento.nodeType !== 1) return false;
    var t = texto(elemento.textContent);
    return /\d{2}\/\d{4}\s*[·•]/.test(t) &&
      /comprovante\s*\(s\)/i.test(t) &&
      /valor\s+cota\s+R\$/i.test(t) &&
      !!dadosResumo(elemento);
  }

  function encontrarResumos() {
    var todos = Array.prototype.slice.call(
      document.querySelectorAll('button,a,article,section,div')
    ).filter(pareceResumo);

    return todos.filter(function (elemento) {
      return !Array.prototype.some.call(elemento.children || [], pareceResumo);
    });
  }

  function statusCartao(cartao) {
    var seletores = '.badge,.status,.pill,[class*="badge"],[class*="status"],[class*="pill"]';
    var elementos = Array.prototype.slice.call(cartao.querySelectorAll(seletores));

    for (var i = 0; i < elementos.length; i++) {
      var valor = texto(elementos[i].textContent).toUpperCase();
      if (/^(PAGO|PENDENTE|EM AN[ÁA]LISE|ERRO|DUPLICADO|RECUSADO|CANCELADO)$/.test(valor)) {
        return valor;
      }
    }

    var conteudo = texto(cartao.textContent).toUpperCase();
    if (/(^|\s)DUPLICADO(\s|$)/.test(conteudo)) return 'DUPLICADO';
    if (/(^|\s)EM AN[ÁA]LISE(\s|$)/.test(conteudo)) return 'EM ANÁLISE';
    if (/(^|\s)PENDENTE(\s|$)/.test(conteudo)) return 'PENDENTE';
    if (/(^|\s)ERRO(\s|$)/.test(conteudo)) return 'ERRO';
    if (/(^|\s)PAGO(\s|$)/.test(conteudo)) return 'PAGO';
    return '';
  }

  function tituloCartao(cartao) {
    var candidatos = Array.prototype.slice.call(cartao.querySelectorAll(
      'h2,h3,h4,[class*="card-title"],[class*="pay-title"],[class*="payment-title"]'
    ));

    for (var i = 0; i < candidatos.length; i++) {
      var valor = texto(candidatos[i].textContent);
      if (valor && valor.length <= 100 && !/^(PAGO|PENDENTE|DUPLICADO|ERRO)$/i.test(valor)) {
        return valor;
      }
    }

    var primeiroFilho = cartao.firstElementChild;
    if (primeiroFilho) {
      var fallback = texto(primeiroFilho.textContent);
      if (fallback && fallback.length <= 120) return fallback;
    }

    return '';
  }

  function mesCartao(cartao) {
    var t = texto(cartao.textContent);
    var encontrado = t.match(/M[ÊE]S\s+REFER[ÊE]NCIA\s*(\d{2}\/\d{4})/i);
    return encontrado ? encontrado[1] : '';
  }

  function chaveCartao(cartao) {
    var mes = mesCartao(cartao);
    var loteria = tituloCartao(cartao);
    return mes && loteria ? mes + '|' + normalizar(loteria) : '';
  }

  function cartoesPagamento() {
    return Array.prototype.slice.call(document.querySelectorAll([
      '.pay-admin-card-pro',
      '.payment-admin-card',
      '[class*="pay-admin-card"]',
      '[class*="payment-admin-card"]'
    ].join(','))).filter(function (elemento, indice, lista) {
      return lista.indexOf(elemento) === indice;
    });
  }

  function localizarPrimeiroAberto(chave) {
    var cartoes = cartoesPagamento();
    for (var i = 0; i < cartoes.length; i++) {
      if (cartoes[i].getAttribute('data-pss-v368-grupo') === chave &&
          cartoes[i].classList.contains('pss-v368-pago-aberto')) {
        return cartoes[i];
      }
    }
    return null;
  }

  function aplicar() {
    instalarEstilos();

    var resumos = encontrarResumos();
    if (!resumos.length) return;

    var grupos = {};

    resumos.forEach(function (resumo) {
      var dados = dadosResumo(resumo);
      if (!dados) return;

      grupos[dados.chave] = resumo;
      resumo.classList.add('pss-v368-resumo-toggle');
      resumo.setAttribute('role', 'button');
      resumo.setAttribute('tabindex', '0');
      resumo.setAttribute('aria-expanded', grupoAberto === dados.chave ? 'true' : 'false');
      resumo.setAttribute(
        'aria-label',
        (grupoAberto === dados.chave ? 'Ocultar' : 'Ver') +
        ' pagamentos pagos de ' + dados.loteria + ' em ' + dados.mes
      );

      if (!resumo.dataset.pssV368Ligado) {
        resumo.dataset.pssV368Ligado = '1';

        var alternar = function (evento) {
          if (evento && evento.type === 'keydown' && evento.key !== 'Enter' && evento.key !== ' ') return;
          if (evento) evento.preventDefault();

          var atual = dadosResumo(resumo);
          if (!atual) return;

          grupoAberto = grupoAberto === atual.chave ? '' : atual.chave;
          aplicar();

          if (grupoAberto) {
            setTimeout(function () {
              var primeiroAberto = localizarPrimeiroAberto(grupoAberto);
              if (!primeiroAberto) return;
              var posicao = primeiroAberto.getBoundingClientRect();
              if (posicao.top < 145 || posicao.top > window.innerHeight - 80) {
                primeiroAberto.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 70);
          }
        };

        resumo.addEventListener('click', alternar);
        resumo.addEventListener('keydown', alternar);
      }
    });

    cartoesPagamento().forEach(function (cartao) {
      var status = statusCartao(cartao);

      if (status !== 'PAGO') {
        cartao.classList.remove('pss-v368-pago-oculto', 'pss-v368-pago-aberto');
        cartao.removeAttribute('data-pss-v368-grupo');
        return;
      }

      var chave = chaveCartao(cartao);
      if (!chave || !grupos[chave]) {
        cartao.classList.remove('pss-v368-pago-oculto', 'pss-v368-pago-aberto');
        cartao.removeAttribute('data-pss-v368-grupo');
        return;
      }

      cartao.setAttribute('data-pss-v368-grupo', chave);

      if (grupoAberto === chave) {
        cartao.classList.remove('pss-v368-pago-oculto');
        cartao.classList.add('pss-v368-pago-aberto');
      } else {
        cartao.classList.remove('pss-v368-pago-aberto');
        cartao.classList.add('pss-v368-pago-oculto');
      }
    });

    resumos.forEach(function (resumo) {
      var dados = dadosResumo(resumo);
      if (!dados) return;
      resumo.setAttribute('aria-expanded', grupoAberto === dados.chave ? 'true' : 'false');
    });
  }

  function programar() {
    clearTimeout(timerAplicar);
    timerAplicar = setTimeout(aplicar, 90);
  }

  function iniciar() {
    instalarEstilos();

    var observador = new MutationObserver(function (registros) {
      var precisa = registros.some(function (registro) {
        return registro.addedNodes && registro.addedNodes.length;
      });
      if (precisa) programar();
    });

    observador.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    document.addEventListener('click', function () {
      setTimeout(programar, 160);
    }, true);
    document.addEventListener('input', programar, true);
    document.addEventListener('change', programar, true);

    aplicar();
  }

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (erroVersao) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  window.PSS_V368_REAPLICAR_PAGAMENTOS = aplicar;
  window.PSS_V368_DIAGNOSTICAR = function () {
    return {
      sucesso: true,
      versao: VERSAO,
      grupoAberto: grupoAberto,
      resumosEncontrados: encontrarResumos().length,
      cartoesEncontrados: cartoesPagamento().length,
      regra: 'PAGO recolhido; demais status visíveis'
    };
  };
})();
