(function () {
  'use strict';

  if (window.PSS_V370_FILTRO_PAGAMENTOS_APLICADO) return;
  window.PSS_V370_FILTRO_PAGAMENTOS_APLICADO = true;

  var VERSAO = 'V370_ABRE_PAGAMENTOS_PAGOS_CORRETAMENTE';
  var grupoAberto = '';
  var grupos = {};
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

  function removerEstilosAntigos() {
    [
      'pss-v368-pagamentos-recolhidos-css',
      'pss-v369-filtro-pagamentos-css'
    ].forEach(function (id) {
      var antigo = document.getElementById(id);
      if (antigo && antigo.parentNode) antigo.parentNode.removeChild(antigo);
    });
  }

  function instalarCss() {
    removerEstilosAntigos();
    if (document.getElementById('pss-v370-filtro-pagamentos-css')) return;

    var style = document.createElement('style');
    style.id = 'pss-v370-filtro-pagamentos-css';
    style.textContent = [
      '.pss-v370-resumo{position:relative;cursor:pointer;user-select:none;padding-bottom:38px!important;transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease}',
      '.pss-v370-resumo:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,80,30,.12);border-color:#0b7a35!important}',
      '.pss-v370-resumo:focus-visible{outline:3px solid rgba(0,123,54,.28);outline-offset:2px}',
      '.pss-v370-resumo::after{content:"VER PAGAMENTOS PAGOS ▼";position:absolute;left:10px;right:10px;bottom:8px;display:flex;align-items:center;justify-content:center;min-height:24px;border:1px solid #c8e2d0;border-radius:7px;background:#eef8f1;color:#075b25;font-size:10px;font-weight:900}',
      '.pss-v370-resumo[aria-expanded="true"]{border-color:#08782f!important;box-shadow:0 6px 18px rgba(0,95,36,.14)}',
      '.pss-v370-resumo[aria-expanded="true"]::after{content:"OCULTAR PAGAMENTOS PAGOS ▲";background:#08782f;border-color:#08782f;color:#fff}',
      '.pss-v370-pago-oculto{display:none!important}',
      '.pss-v370-pago-aberto{display:block!important;scroll-margin-top:165px}',
      '@media(max-width:700px){.pss-v370-resumo{padding-bottom:42px!important}.pss-v370-resumo::after{font-size:9px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function dadosResumo(elemento) {
    var conteudo = texto(elemento && elemento.textContent);
    var encontrado = conteudo.match(/(\d{2}\/\d{4})\s*[·•-]\s*(.+?)(?=\s+R\$\s*[\d.]+(?:,\d{2})?)/i);
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

  function pareceResumo(elemento) {
    if (!elemento || elemento.nodeType !== 1) return false;
    var conteudo = texto(elemento.textContent);
    return /\d{2}\/\d{4}\s*[·•-]/.test(conteudo) &&
      /comprovante\s*\(s\)/i.test(conteudo) &&
      /valor\s+cota\s+R\$/i.test(conteudo) &&
      !!dadosResumo(elemento);
  }

  function encontrarResumos() {
    var candidatos = Array.prototype.slice.call(
      document.querySelectorAll('button,a,article,section,div')
    ).filter(pareceResumo);

    return candidatos.filter(function (elemento) {
      return !Array.prototype.some.call(elemento.children || [], pareceResumo);
    });
  }

  function encontrarCartoes() {
    var principais = Array.prototype.slice.call(document.querySelectorAll(
      '.pay-admin-card-pro,.payment-admin-card'
    ));

    if (principais.length) {
      return principais.filter(function (elemento, indice, lista) {
        return lista.indexOf(elemento) === indice;
      });
    }

    return Array.prototype.slice.call(document.querySelectorAll(
      '[class*="pay-admin-card"],[class*="payment-admin-card"]'
    )).filter(function (elemento, indice, lista) {
      if (lista.indexOf(elemento) !== indice) return false;
      return !elemento.parentElement || !elemento.parentElement.closest(
        '[class*="pay-admin-card"],[class*="payment-admin-card"]'
      );
    });
  }

  function statusCartao(cartao) {
    var candidatos = Array.prototype.slice.call(cartao.querySelectorAll(
      '.badge,.status,.pill,[class*="badge"],[class*="status"],[class*="pill"]'
    ));

    for (var i = 0; i < candidatos.length; i++) {
      var valor = texto(candidatos[i].textContent).toUpperCase();
      if (/^(PAGO|PENDENTE|EM AN[ÁA]LISE|ERRO|DUPLICADO|RECUSADO|CANCELADO)$/.test(valor)) {
        return valor;
      }
    }

    var conteudo = texto(cartao.textContent).toUpperCase();
    if (/\bDUPLICADO\b/.test(conteudo)) return 'DUPLICADO';
    if (/\bEM AN[ÁA]LISE\b/.test(conteudo)) return 'EM ANÁLISE';
    if (/\bPENDENTE\b/.test(conteudo)) return 'PENDENTE';
    if (/\bRECUSADO\b/.test(conteudo)) return 'RECUSADO';
    if (/\bCANCELADO\b/.test(conteudo)) return 'CANCELADO';
    if (/\bERRO\b/.test(conteudo)) return 'ERRO';
    if (/\bPAGO\b/.test(conteudo)) return 'PAGO';
    return '';
  }

  function mesCartao(cartao) {
    var conteudo = texto(cartao.textContent);
    var encontrado = conteudo.match(/M[ÊE]S\s+REFER[ÊE]NCIA\s*[:\-]?\s*(\d{2}\/\d{4})/i);
    return encontrado ? encontrado[1] : '';
  }

  function correspondeAoGrupo(cartao, grupo) {
    if (!grupo) return false;

    var conteudoOriginal = texto(cartao.textContent);
    var conteudoNormalizado = normalizar(conteudoOriginal);
    var mesDoCartao = mesCartao(cartao);

    var mesmoMes = mesDoCartao === grupo.mes || conteudoOriginal.indexOf(grupo.mes) >= 0;
    var mesmaLoteria = conteudoNormalizado.indexOf(grupo.loteriaNormalizada) >= 0;

    return mesmoMes && mesmaLoteria;
  }

  function limparClassesAntigas(elemento) {
    elemento.classList.remove(
      'pss-v368-resumo-toggle',
      'pss-v368-pago-oculto',
      'pss-v368-pago-aberto',
      'pss-v369-resumo',
      'pss-v369-pago-oculto',
      'pss-v369-pago-aberto'
    );
  }

  function mostrarCartao(cartao) {
    limparClassesAntigas(cartao);
    cartao.classList.remove('pss-v370-pago-oculto');
    cartao.classList.add('pss-v370-pago-aberto');
    cartao.style.setProperty('display', 'block', 'important');
  }

  function ocultarCartao(cartao) {
    limparClassesAntigas(cartao);
    cartao.classList.remove('pss-v370-pago-aberto');
    cartao.classList.add('pss-v370-pago-oculto');
    cartao.style.setProperty('display', 'none', 'important');
  }

  function liberarCartaoNaoPago(cartao) {
    limparClassesAntigas(cartao);
    cartao.classList.remove('pss-v370-pago-oculto', 'pss-v370-pago-aberto');
    cartao.style.removeProperty('display');
    cartao.removeAttribute('data-pss-v370-grupo');
  }

  function aplicar() {
    instalarCss();
    grupos = {};

    encontrarResumos().forEach(function (resumo) {
      var dados = dadosResumo(resumo);
      if (!dados) return;

      grupos[dados.chave] = dados;
      limparClassesAntigas(resumo);
      resumo.classList.add('pss-v370-resumo');
      resumo.dataset.pssV370Chave = dados.chave;
      resumo.setAttribute('role', 'button');
      resumo.setAttribute('tabindex', '0');
      resumo.setAttribute('aria-expanded', grupoAberto === dados.chave ? 'true' : 'false');
      resumo.setAttribute(
        'aria-label',
        (grupoAberto === dados.chave ? 'Ocultar' : 'Ver') +
        ' pagamentos pagos de ' + dados.loteria + ' em ' + dados.mes
      );
    });

    var grupoSelecionado = grupoAberto ? grupos[grupoAberto] : null;

    encontrarCartoes().forEach(function (cartao) {
      var status = statusCartao(cartao);

      if (status !== 'PAGO') {
        liberarCartaoNaoPago(cartao);
        return;
      }

      if (grupoSelecionado && correspondeAoGrupo(cartao, grupoSelecionado)) {
        cartao.dataset.pssV370Grupo = grupoSelecionado.chave;
        mostrarCartao(cartao);
      } else {
        cartao.dataset.pssV370Grupo = '';
        ocultarCartao(cartao);
      }
    });
  }

  function alternarResumo(resumo) {
    var chave = resumo && resumo.dataset ? resumo.dataset.pssV370Chave : '';
    if (!chave) return;

    grupoAberto = grupoAberto === chave ? '' : chave;
    aplicar();

    if (grupoAberto) {
      setTimeout(function () {
        var primeiro = document.querySelector(
          '.pss-v370-pago-aberto[data-pss-v370-grupo="' + grupoAberto.replace(/"/g, '') + '"]'
        );
        if (!primeiro) return;
        var posicao = primeiro.getBoundingClientRect();
        if (posicao.top < 150 || posicao.top > window.innerHeight - 80) {
          primeiro.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  }

  function programar() {
    clearTimeout(timer);
    timer = setTimeout(aplicar, 100);
  }

  document.addEventListener('click', function (evento) {
    var resumo = evento.target && evento.target.closest
      ? evento.target.closest('.pss-v370-resumo')
      : null;
    if (!resumo) return;

    evento.preventDefault();
    evento.stopPropagation();
    if (evento.stopImmediatePropagation) evento.stopImmediatePropagation();
    alternarResumo(resumo);
  }, true);

  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    var resumo = evento.target && evento.target.closest
      ? evento.target.closest('.pss-v370-resumo')
      : null;
    if (!resumo) return;

    evento.preventDefault();
    evento.stopPropagation();
    if (evento.stopImmediatePropagation) evento.stopImmediatePropagation();
    alternarResumo(resumo);
  }, true);

  var observer = new MutationObserver(function (registros) {
    var alterouEstrutura = registros.some(function (registro) {
      return registro.addedNodes && registro.addedNodes.length;
    });
    if (alterouEstrutura) programar();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('input', programar, true);
  document.addEventListener('change', programar, true);

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (erroVersao) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar, { once: true });
  } else {
    aplicar();
  }

  window.PSS_V370_REAPLICAR = aplicar;
  window.PSS_V370_DIAGNOSTICAR = function () {
    var cartoes = encontrarCartoes();
    return {
      sucesso: true,
      versao: VERSAO,
      grupoAberto: grupoAberto,
      resumos: encontrarResumos().length,
      cartoes: cartoes.length,
      pagosVisiveis: cartoes.filter(function (cartao) {
        return statusCartao(cartao) === 'PAGO' && cartao.style.display !== 'none';
      }).length,
      naoPagosVisiveis: cartoes.filter(function (cartao) {
        return statusCartao(cartao) !== 'PAGO' && cartao.style.display !== 'none';
      }).length,
      regra: 'Todos os PAGO ocultos; somente o grupo clicado abre; não-PAGO sempre visível.'
    };
  };
})();
