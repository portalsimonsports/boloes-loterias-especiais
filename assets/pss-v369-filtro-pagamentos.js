(function () {
  'use strict';

  if (window.PSS_V369_FILTRO_PAGAMENTOS_APLICADO) return;
  window.PSS_V369_FILTRO_PAGAMENTOS_APLICADO = true;

  var VERSAO = 'V369_FILTRO_PAGAMENTOS_CORRETO';
  var grupoAberto = '';
  var timer = 0;

  function texto(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function normalizar(v) {
    return texto(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  function instalarCss() {
    if (document.getElementById('pss-v369-filtro-pagamentos-css')) return;
    var style = document.createElement('style');
    style.id = 'pss-v369-filtro-pagamentos-css';
    style.textContent = [
      '.pss-v369-resumo{position:relative;cursor:pointer;user-select:none;padding-bottom:38px!important;transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease}',
      '.pss-v369-resumo:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,80,30,.12);border-color:#0b7a35!important}',
      '.pss-v369-resumo:focus-visible{outline:3px solid rgba(0,123,54,.28);outline-offset:2px}',
      '.pss-v369-resumo::after{content:"VER PAGAMENTOS PAGOS ▼";position:absolute;left:10px;right:10px;bottom:8px;display:flex;align-items:center;justify-content:center;min-height:24px;border:1px solid #c8e2d0;border-radius:7px;background:#eef8f1;color:#075b25;font-size:10px;font-weight:900}',
      '.pss-v369-resumo[aria-expanded="true"]{border-color:#08782f!important;box-shadow:0 6px 18px rgba(0,95,36,.14)}',
      '.pss-v369-resumo[aria-expanded="true"]::after{content:"OCULTAR PAGAMENTOS PAGOS ▲";background:#08782f;border-color:#08782f;color:#fff}',
      '.pss-v369-pago-oculto{display:none!important}',
      '.pss-v369-pago-aberto{display:block!important;scroll-margin-top:165px}',
      '@media(max-width:700px){.pss-v369-resumo{padding-bottom:42px!important}.pss-v369-resumo::after{font-size:9px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function dadosResumo(el) {
    var t = texto(el && el.textContent);
    var m = t.match(/(\d{2}\/\d{4})\s*[·•-]\s*(.+?)(?=\s+R\$\s*[\d.]+(?:,\d{2})?)/i);
    if (!m) return null;
    var mes = m[1];
    var loteria = texto(m[2]);
    if (!mes || !loteria) return null;
    return { mes: mes, loteria: loteria, chave: mes + '|' + normalizar(loteria) };
  }

  function ehResumo(el) {
    if (!el || el.nodeType !== 1) return false;
    var t = texto(el.textContent);
    return /\d{2}\/\d{4}\s*[·•-]/.test(t) &&
      /comprovante\s*\(s\)/i.test(t) &&
      /valor\s+cota\s+R\$/i.test(t) &&
      !!dadosResumo(el);
  }

  function resumos() {
    var lista = Array.prototype.slice.call(document.querySelectorAll('button,a,article,section,div'))
      .filter(ehResumo);
    return lista.filter(function (el) {
      return !Array.prototype.some.call(el.children || [], ehResumo);
    });
  }

  function cartoes() {
    return Array.prototype.slice.call(document.querySelectorAll(
      '.pay-admin-card-pro,.payment-admin-card,[class*="pay-admin-card"],[class*="payment-admin-card"]'
    )).filter(function (el, i, arr) {
      return arr.indexOf(el) === i;
    });
  }

  function status(cartao) {
    var candidatos = Array.prototype.slice.call(cartao.querySelectorAll(
      '.badge,.status,.pill,[class*="badge"],[class*="status"],[class*="pill"]'
    ));
    for (var i = 0; i < candidatos.length; i++) {
      var v = texto(candidatos[i].textContent).toUpperCase();
      if (/^(PAGO|PENDENTE|EM AN[ÁA]LISE|ERRO|DUPLICADO|RECUSADO|CANCELADO)$/.test(v)) return v;
    }
    var t = texto(cartao.textContent).toUpperCase();
    if (/\bDUPLICADO\b/.test(t)) return 'DUPLICADO';
    if (/\bEM AN[ÁA]LISE\b/.test(t)) return 'EM ANÁLISE';
    if (/\bPENDENTE\b/.test(t)) return 'PENDENTE';
    if (/\bRECUSADO\b/.test(t)) return 'RECUSADO';
    if (/\bCANCELADO\b/.test(t)) return 'CANCELADO';
    if (/\bERRO\b/.test(t)) return 'ERRO';
    if (/\bPAGO\b/.test(t)) return 'PAGO';
    return '';
  }

  function titulo(cartao) {
    var seletores = [
      '.pay-card-title','.payment-title','.pay-admin-title','.payment-admin-title',
      '.pay-card-head h2','.pay-card-head h3','.pay-card-head h4',
      'h2','h3','h4','h5','strong','b'
    ];
    for (var s = 0; s < seletores.length; s++) {
      var els = cartao.querySelectorAll(seletores[s]);
      for (var i = 0; i < els.length; i++) {
        var v = texto(els[i].textContent);
        if (!v || v.length > 120) continue;
        if (/^(PAGO|PENDENTE|EM AN[ÁA]LISE|ERRO|DUPLICADO|RECUSADO|CANCELADO)$/i.test(v)) continue;
        if (/^(VALOR|PAGADOR|RECEBEDOR|M[ÊE]S REFER[ÊE]NCIA|ID TRANSA[CÇ][AÃ]O|AUTENTICA[CÇ][AÃ]O|TIPO COTA|PARTES|VALIDA[CÇ][AÃ]O)/i.test(v)) continue;
        return v;
      }
    }
    var linhas = String(cartao.innerText || '').split(/\n+/).map(texto).filter(Boolean);
    for (var j = 0; j < linhas.length; j++) {
      if (/^(PAGO|PENDENTE|EM AN[ÁA]LISE|ERRO|DUPLICADO)$/i.test(linhas[j])) continue;
      if (linhas[j].length <= 120) return linhas[j];
    }
    return '';
  }

  function mes(cartao) {
    var t = texto(cartao.textContent);
    var m = t.match(/M[ÊE]S\s+REFER[ÊE]NCIA\s*[:\-]?\s*(\d{2}\/\d{4})/i);
    return m ? m[1] : '';
  }

  function chaveCartao(cartao) {
    var m = mes(cartao);
    var l = titulo(cartao);
    return m && l ? m + '|' + normalizar(l) : '';
  }

  function aplicar() {
    instalarCss();
    var listaResumos = resumos();
    var chaves = {};

    listaResumos.forEach(function (resumo) {
      var d = dadosResumo(resumo);
      if (!d) return;
      chaves[d.chave] = true;
      resumo.classList.remove('pss-v368-resumo-toggle');
      resumo.classList.add('pss-v369-resumo');
      resumo.dataset.pssV369Chave = d.chave;
      resumo.setAttribute('role', 'button');
      resumo.setAttribute('tabindex', '0');
      resumo.setAttribute('aria-expanded', grupoAberto === d.chave ? 'true' : 'false');
    });

    cartoes().forEach(function (cartao) {
      cartao.classList.remove('pss-v368-pago-oculto','pss-v368-pago-aberto');
      var st = status(cartao);

      if (st !== 'PAGO') {
        cartao.classList.remove('pss-v369-pago-oculto','pss-v369-pago-aberto');
        cartao.removeAttribute('data-pss-v369-grupo');
        return;
      }

      var chave = chaveCartao(cartao);
      cartao.dataset.pssV369Grupo = chave || '';

      if (grupoAberto && chave === grupoAberto && chaves[chave]) {
        cartao.classList.remove('pss-v369-pago-oculto');
        cartao.classList.add('pss-v369-pago-aberto');
      } else {
        cartao.classList.remove('pss-v369-pago-aberto');
        cartao.classList.add('pss-v369-pago-oculto');
      }
    });
  }

  function programar() {
    clearTimeout(timer);
    timer = setTimeout(aplicar, 80);
  }

  document.addEventListener('click', function (evento) {
    var resumo = evento.target && evento.target.closest
      ? evento.target.closest('.pss-v369-resumo')
      : null;
    if (!resumo) return;
    evento.preventDefault();
    evento.stopPropagation();
    var chave = resumo.dataset.pssV369Chave || '';
    grupoAberto = grupoAberto === chave ? '' : chave;
    aplicar();
  }, true);

  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    var resumo = evento.target && evento.target.closest
      ? evento.target.closest('.pss-v369-resumo')
      : null;
    if (!resumo) return;
    evento.preventDefault();
    var chave = resumo.dataset.pssV369Chave || '';
    grupoAberto = grupoAberto === chave ? '' : chave;
    aplicar();
  }, true);

  var observer = new MutationObserver(programar);
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  document.addEventListener('input', programar, true);
  document.addEventListener('change', programar, true);

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar, { once: true });
  } else {
    aplicar();
  }

  window.PSS_V369_REAPLICAR = aplicar;
  window.PSS_V369_DIAGNOSTICAR = function () {
    return {
      sucesso: true,
      versao: VERSAO,
      grupoAberto: grupoAberto,
      resumos: resumos().length,
      cartoes: cartoes().length,
      regra: 'Todos os PAGO ocultos; apenas grupo clicado visível; não-PAGO sempre visível.'
    };
  };
})();
