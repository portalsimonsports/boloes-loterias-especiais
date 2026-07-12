(function () {
  'use strict';

  if (window.PSS_V371_PAGAMENTOS_PAGOS_APLICADO) return;
  window.PSS_V371_PAGAMENTOS_PAGOS_APLICADO = true;

  /* Impede que filtros antigos sejam reinstalados nesta mesma página. */
  window.PSS_V368_PAGAMENTOS_PAGOS_RECOLHIDOS = true;
  window.PSS_V369_FILTRO_PAGAMENTOS_APLICADO = true;
  window.PSS_V370_FILTRO_PAGAMENTOS_APLICADO = true;

  var VERSAO = 'V371_PAGAMENTOS_PAGOS_DIRETO';
  var grupoAberto = '';
  var timer = 0;

  function texto(valor) {
    return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
  }

  function normalizar(valor) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  function instalarCss() {
    var antigos = [
      'pss-v368-pagamentos-recolhidos-css',
      'pss-v369-filtro-pagamentos-css',
      'pss-v370-filtro-pagamentos-css'
    ];

    antigos.forEach(function (id) {
      var elemento = document.getElementById(id);
      if (elemento && elemento.parentNode) elemento.parentNode.removeChild(elemento);
    });

    if (document.getElementById('pss-v371-pagamentos-pagos-css')) return;

    var style = document.createElement('style');
    style.id = 'pss-v371-pagamentos-pagos-css';
    style.textContent = [
      '.pay-summary-card.pss-v371-resumo{position:relative;cursor:pointer;user-select:none;padding-bottom:38px!important;transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease}',
      '.pay-summary-card.pss-v371-resumo:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,80,30,.12);border-color:#0b7a35!important}',
      '.pay-summary-card.pss-v371-resumo:focus-visible{outline:3px solid rgba(0,123,54,.28);outline-offset:2px}',
      '.pay-summary-card.pss-v371-resumo::after{content:"VER PAGAMENTOS PAGOS ▼";position:absolute;left:10px;right:10px;bottom:8px;display:flex;align-items:center;justify-content:center;min-height:24px;border:1px solid #c8e2d0;border-radius:7px;background:#eef8f1;color:#075b25;font-size:10px;font-weight:900}',
      '.pay-summary-card.pss-v371-resumo[aria-expanded="true"]{border-color:#08782f!important;box-shadow:0 6px 18px rgba(0,95,36,.14)}',
      '.pay-summary-card.pss-v371-resumo[aria-expanded="true"]::after{content:"OCULTAR PAGAMENTOS PAGOS ▲";background:#08782f;border-color:#08782f;color:#fff}',
      '.pay-admin-card-pro.pss-v371-pago-oculto,.payment-admin-card.pss-v371-pago-oculto{display:none!important}',
      '.pay-admin-card-pro.pss-v371-pago-aberto,.payment-admin-card.pss-v371-pago-aberto{display:block!important;scroll-margin-top:165px}',
      '@media(max-width:700px){.pay-summary-card.pss-v371-resumo{padding-bottom:42px!important}.pay-summary-card.pss-v371-resumo::after{font-size:9px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function dadosResumo(cartao) {
    if (!cartao) return null;
    var cabecalho = cartao.querySelector('b');
    var valor = texto(cabecalho ? cabecalho.textContent : cartao.textContent);
    var encontrado = valor.match(/^(\d{2}\/\d{4})\s*[·•-]\s*(.+)$/i);
    if (!encontrado) return null;

    var mes = encontrado[1];
    var loteria = texto(encontrado[2]);
    if (!mes || !loteria) return null;

    return {
      mes: mes,
      loteria: loteria,
      loteriaNormalizada: normalizar(loteria),
      chave: mes + '|' + normalizar(loteria)
    };
  }

  function resumos() {
    return Array.prototype.slice.call(document.querySelectorAll('.pay-summary-card'))
      .filter(function (cartao) { return !!dadosResumo(cartao); });
  }

  function cartoesPagamento() {
    return Array.prototype.slice.call(document.querySelectorAll('.pay-admin-card-pro,.payment-admin-card'))
      .filter(function (cartao, indice, lista) { return lista.indexOf(cartao) === indice; });
  }

  function statusCartao(cartao) {
    var elemento = cartao.querySelector('.pay-admin-status,.pay-status,[class*="pay-admin-status"]');
    var status = normalizar(elemento ? elemento.textContent : '');

    if (status.indexOf('DUPLIC') >= 0) return 'DUPLICADO';
    if (status.indexOf('ANALIS') >= 0) return 'EM_ANALISE';
    if (status.indexOf('PEND') >= 0) return 'PENDENTE';
    if (status.indexOf('RECUS') >= 0) return 'RECUSADO';
    if (status.indexOf('CANCEL') >= 0) return 'CANCELADO';
    if (status.indexOf('ERRO') >= 0) return 'ERRO';
    if (status.indexOf('PAGO') >= 0 || status.indexOf('CONFIRM') >= 0 || status.indexOf('APROV') >= 0) return 'PAGO';

    return '';
  }

  function tituloCartao(cartao) {
    var titulo = cartao.querySelector('.pay-admin-title,.payment-title,.pay-title');
    return texto(titulo ? titulo.textContent : '');
  }

  function mesCartao(cartao) {
    var caixas = cartao.querySelectorAll('.pay-admin-info,.pay-info');

    for (var i = 0; i < caixas.length; i++) {
      var rotulo = caixas[i].querySelector('b');
      if (normalizar(rotulo ? rotulo.textContent : '') !== 'MESREFERENCIA') continue;
      var valor = caixas[i].querySelector('span');
      var encontrado = texto(valor ? valor.textContent : caixas[i].textContent).match(/\d{2}\/\d{4}/);
      return encontrado ? encontrado[0] : '';
    }

    var fallback = texto(cartao.textContent).match(/M[ÊE]S\s+REFER[ÊE]NCIA\s*[:\-]?\s*(\d{2}\/\d{4})/i);
    return fallback ? fallback[1] : '';
  }

  function pertenceAoGrupo(cartao, grupo) {
    if (!grupo) return false;
    return mesCartao(cartao) === grupo.mes && normalizar(tituloCartao(cartao)) === grupo.loteriaNormalizada;
  }

  function limparVersoesAntigas(elemento) {
    elemento.classList.remove(
      'pss-v368-resumo-toggle',
      'pss-v368-pago-oculto',
      'pss-v368-pago-aberto',
      'pss-v369-resumo',
      'pss-v369-pago-oculto',
      'pss-v369-pago-aberto',
      'pss-v370-resumo',
      'pss-v370-pago-oculto',
      'pss-v370-pago-aberto'
    );
  }

  function mostrar(cartao, chave) {
    limparVersoesAntigas(cartao);
    cartao.classList.remove('pss-v371-pago-oculto');
    cartao.classList.add('pss-v371-pago-aberto');
    cartao.dataset.pssV371Grupo = chave || '';
    cartao.style.setProperty('display', 'block', 'important');
  }

  function ocultar(cartao) {
    limparVersoesAntigas(cartao);
    cartao.classList.remove('pss-v371-pago-aberto');
    cartao.classList.add('pss-v371-pago-oculto');
    cartao.dataset.pssV371Grupo = '';
    cartao.style.setProperty('display', 'none', 'important');
  }

  function liberarNaoPago(cartao) {
    limparVersoesAntigas(cartao);
    cartao.classList.remove('pss-v371-pago-oculto', 'pss-v371-pago-aberto');
    cartao.removeAttribute('data-pss-v371-grupo');
    cartao.style.removeProperty('display');
  }

  function aplicar() {
    instalarCss();

    var mapaGrupos = {};
    var listaResumos = resumos();

    listaResumos.forEach(function (resumo) {
      var dados = dadosResumo(resumo);
      if (!dados) return;

      mapaGrupos[dados.chave] = dados;
      limparVersoesAntigas(resumo);
      resumo.classList.add('pss-v371-resumo');
      resumo.dataset.pssV371Chave = dados.chave;
      resumo.setAttribute('role', 'button');
      resumo.setAttribute('tabindex', '0');
      resumo.setAttribute('aria-expanded', grupoAberto === dados.chave ? 'true' : 'false');
    });

    var selecionado = grupoAberto ? mapaGrupos[grupoAberto] : null;

    cartoesPagamento().forEach(function (cartao) {
      if (statusCartao(cartao) !== 'PAGO') {
        liberarNaoPago(cartao);
        return;
      }

      if (selecionado && pertenceAoGrupo(cartao, selecionado)) mostrar(cartao, selecionado.chave);
      else ocultar(cartao);
    });
  }

  function alternar(resumo) {
    var chave = resumo && resumo.dataset ? resumo.dataset.pssV371Chave : '';
    if (!chave) return;

    grupoAberto = grupoAberto === chave ? '' : chave;
    aplicar();

    if (grupoAberto) {
      setTimeout(function () {
        var primeiro = document.querySelector('.pss-v371-pago-aberto[data-pss-v371-grupo="' + grupoAberto.replace(/"/g, '') + '"]');
        if (!primeiro) return;
        primeiro.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  document.addEventListener('click', function (evento) {
    var resumo = evento.target && evento.target.closest ? evento.target.closest('.pay-summary-card.pss-v371-resumo') : null;
    if (!resumo) return;
    evento.preventDefault();
    evento.stopPropagation();
    if (evento.stopImmediatePropagation) evento.stopImmediatePropagation();
    alternar(resumo);
  }, true);

  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    var resumo = evento.target && evento.target.closest ? evento.target.closest('.pay-summary-card.pss-v371-resumo') : null;
    if (!resumo) return;
    evento.preventDefault();
    evento.stopPropagation();
    alternar(resumo);
  }, true);

  function programar() {
    clearTimeout(timer);
    timer = setTimeout(aplicar, 80);
  }

  var observer = new MutationObserver(function (registros) {
    var mudou = registros.some(function (registro) {
      return registro.addedNodes && registro.addedNodes.length;
    });
    if (mudou) programar();
  });

  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  document.addEventListener('input', programar, true);
  document.addEventListener('change', programar, true);

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (erroVersao) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar, { once: true });
  else aplicar();

  window.PSS_V371_REAPLICAR = aplicar;
  window.PSS_V371_DIAGNOSTICAR = function () {
    var cartoes = cartoesPagamento();
    return {
      sucesso: true,
      versao: VERSAO,
      grupoAberto: grupoAberto,
      resumos: resumos().length,
      cartoes: cartoes.length,
      pagosVisiveis: cartoes.filter(function (cartao) {
        return statusCartao(cartao) === 'PAGO' && cartao.style.display !== 'none';
      }).length,
      naoPagosVisiveis: cartoes.filter(function (cartao) {
        return statusCartao(cartao) !== 'PAGO' && cartao.style.display !== 'none';
      }).length,
      regra: 'Todos os PAGO ocultos; somente o grupo clicado abre; não-PAGO permanece visível.'
    };
  };
})();
