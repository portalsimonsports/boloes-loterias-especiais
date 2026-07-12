(function () {
  'use strict';

  if (window.PSS_V364_EXCLUSAO_RAPIDA_APLICADA) return;
  window.PSS_V364_EXCLUSAO_RAPIDA_APLICADA = true;

  var VERSAO = 'V364_EXCLUSAO_RAPIDA_SEGURA';
  var exclusaoPendente = null;
  var timerBotoes = 0;

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (e) {}

  function txt(v) {
    return String(v == null ? '' : v).trim();
  }

  function esc(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function normalizar(v) {
    return txt(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function comLimite(promise, ms) {
    return new Promise(function (resolve, reject) {
      var fim = false;
      var timer = setTimeout(function () {
        if (fim) return;
        fim = true;
        var erro = new Error('A exclusão excedeu 60 segundos. Recarregue a lista antes de tentar novamente.');
        erro.code = 'pss/excluir-timeout-v364';
        reject(erro);
      }, ms);

      Promise.resolve(promise).then(function (r) {
        if (fim) return;
        fim = true;
        clearTimeout(timer);
        resolve(r);
      }, function (e) {
        if (fim) return;
        fim = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function unwrap(r) {
    var atual = r;
    if (atual && atual.dados !== undefined) atual = atual.dados;
    if (atual && atual.result !== undefined && !atual.sucesso && !atual.ok) atual = atual.result;
    return atual || {};
  }

  function linhaCard(card) {
    if (!card) return 0;
    var data = Number(card.getAttribute('data-pay-row') || 0);
    if (data) return data;
    var ref = card.querySelector('button[onclick*="reprocessarPagamentoAdmin("]');
    var acao = ref ? txt(ref.getAttribute('onclick')) : '';
    var m = acao.match(/reprocessarPagamentoAdmin\s*\(\s*(\d+)\s*\)/i);
    return m ? Number(m[1]) : 0;
  }

  function valorCampo(card, rotulo) {
    var alvo = normalizar(rotulo);
    var itens = card ? card.querySelectorAll('.pay-admin-info') : [];
    for (var i = 0; i < itens.length; i++) {
      var b = itens[i].querySelector('b');
      var span = itens[i].querySelector('span');
      if (b && normalizar(b.textContent) === alvo) return txt(span ? span.textContent : '');
    }
    return '';
  }

  function dadosCard(card) {
    var sub = txt(card && card.querySelector('.pay-admin-sub') ? card.querySelector('.pay-admin-sub').textContent : '');
    var email = (sub.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
    return {
      linha: linhaCard(card),
      emailEsperado: txt(email).toLowerCase(),
      loteriaEsperada: txt(card && card.querySelector('.pay-admin-title') ? card.querySelector('.pay-admin-title').textContent : ''),
      idTransacaoEsperado: valorCampo(card, 'ID transação')
    };
  }

  function abrir(dados) {
    dados = dados || {};
    dados.linha = Number(dados.linha || 0);
    if (!dados.linha) {
      if (typeof toast === 'function') toast('Linha do comprovante não localizada.', 'error');
      return;
    }

    exclusaoPendente = dados;
    var descricao = [dados.emailEsperado, dados.loteriaEsperada, dados.idTransacaoEsperado].filter(Boolean).join(' • ');
    var html = '' +
      '<div class="notice warn"><strong>Excluir este comprovante?</strong></div>' +
      (descricao ? '<p style="word-break:break-word;"><strong>' + esc(descricao) + '</strong></p>' : '') +
      '<p>O registro será removido da aba PAGAMENTOS. O arquivo será enviado para a lixeira somente quando não estiver vinculado a outro registro.</p>' +
      '<p><strong>Use somente para comprovante duplicado ou enviado por engano.</strong></p>' +
      '<div class="actions" style="justify-content:flex-end;">' +
        '<button type="button" class="btn btn-light" onclick="fecharModal()">Cancelar</button>' +
        '<button type="button" class="btn btn-danger" id="btnExcluirComprovanteV364" onclick="executarExcluirComprovanteV364()">Excluir comprovante</button>' +
      '</div>';

    if (typeof abrirModal === 'function') abrirModal('Confirmar exclusão', html);
    else if (window.confirm('Excluir este comprovante?')) window.executarExcluirComprovanteV364();
  }

  window.executarExcluirComprovanteV364 = async function () {
    if (!exclusaoPendente || !exclusaoPendente.linha) return;
    var botao = document.getElementById('btnExcluirComprovanteV364');
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Excluindo...';
    }

    try {
      var dados = Object.assign({}, exclusaoPendente, {
        adminEmail: txt(window.ESTADO && ESTADO.email).toLowerCase()
      });

      if (typeof api !== 'function') throw new Error('API do site não inicializada.');

      var resposta = unwrap(await comLimite(
        api('excluirComprovantePagamentoV364', dados, [dados]),
        60000
      ));

      if (resposta.sucesso === false || resposta.ok === false) {
        throw new Error(resposta.erro || resposta.msg || 'A API não confirmou a exclusão.');
      }

      if (typeof fecharModal === 'function') fecharModal();
      try {
        if (typeof limparCacheRapidoV362 === 'function') limparCacheRapidoV362();
        if (window.ESTADO) ESTADO.pagamentosAdminCache = null;
      } catch (e) {}

      if (typeof toast === 'function') toast(resposta.msg || 'Comprovante excluído com sucesso.');

      var seletor = '.pss-v364-excluir-comprovante[data-linha-pagamento="' + dados.linha + '"]';
      var btnCard = document.querySelector(seletor);
      var card = btnCard && btnCard.closest('.pay-admin-card-pro, .payment-admin-card');
      if (card) card.remove();

      if (typeof renderPagamentosAdminTab === 'function') {
        setTimeout(function () { renderPagamentosAdminTab('efetuados'); }, 250);
      }
    } catch (erro) {
      var msg = txt(erro && erro.message ? erro.message : erro);
      if (/Action n[aã]o reconhecida|excluirComprovantePagamentoV364/i.test(msg)) {
        msg = 'A versão V364 ainda não foi publicada no Apps Script da planilha.';
      }
      if (typeof toast === 'function') toast(msg || 'Não foi possível excluir o comprovante.', 'error');
      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Excluir comprovante';
      }
    }
  };

  window.abrirExcluirComprovanteV364 = abrir;
  window.abrirExcluirComprovanteV363 = function (linha) {
    var card = document.querySelector('.pay-admin-card-pro[data-pay-row="' + Number(linha || 0) + '"]');
    var dados = card ? dadosCard(card) : { linha: Number(linha || 0) };
    abrir(dados);
  };
  window.executarExcluirComprovanteV363 = window.executarExcluirComprovanteV364;

  function preparar() {
    document.querySelectorAll('.pay-admin-card-pro, .payment-admin-card').forEach(function (card) {
      var linha = linhaCard(card);
      if (!linha) return;
      var acoes = card.querySelector('.pay-card-actions');
      if (!acoes) return;

      var antigo = card.querySelector('.pss-v363-excluir-comprovante');
      if (antigo) antigo.remove();
      if (card.querySelector('.pss-v364-excluir-comprovante')) return;

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn-danger pss-v364-excluir-comprovante';
      botao.textContent = 'Excluir comprovante';
      botao.setAttribute('data-linha-pagamento', String(linha));
      botao.addEventListener('click', function () { abrir(dadosCard(card)); });
      acoes.appendChild(botao);
    });
  }

  function agendar() {
    clearTimeout(timerBotoes);
    timerBotoes = setTimeout(preparar, 100);
  }

  new MutationObserver(agendar).observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  setTimeout(preparar, 200);

  window.diagnosticarExclusaoV364 = function () {
    return {
      sucesso: true,
      versao: VERSAO,
      action: 'excluirComprovantePagamentoV364',
      timeoutMs: 60000,
      assinaturaRegistro: true,
      leituraBackend: 'em bloco'
    };
  };
})();
