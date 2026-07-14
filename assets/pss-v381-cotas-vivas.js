(function () {
  'use strict';

  if (window.PSS_V381_COTAS_VIVAS) return;
  window.PSS_V381_COTAS_VIVAS = true;

  var ARQUIVO = 'dados-publicos.json';
  var INTERVALO = 60000;
  var CACHE_BUCKET_MS = 45000;
  var timer = 0;
  var ultimaAssinatura = '';
  var ultimaCarga = 0;
  var aplicando = false;
  var requisicaoAtual = null;
  var reagendarObserver = 0;
  var observador = null;

  function numero(valor) {
    if (typeof valor === 'number') return isFinite(valor) ? valor : 0;
    var texto = String(valor == null ? '' : valor)
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    var n = Number(texto);
    return isFinite(n) ? n : 0;
  }

  function formatar(valor) {
    var n = numero(valor);
    return Math.abs(n - Math.round(n)) < 0.000001
      ? String(Math.round(n))
      : String(Math.round(n * 1000) / 1000).replace('.', ',');
  }

  function normalizar(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ativo(bolao) {
    var status = normalizar(bolao && (bolao.statusReal || bolao.status || bolao.STATUS));
    return status === 'ATIVO' || status === 'ABERTO' || status === 'SIM' || status === 'TRUE';
  }

  function listaBoloes(dados) {
    var lista = [];
    if (Array.isArray(dados && dados.boloesAtivos)) lista = dados.boloesAtivos;
    else if (Array.isArray(dados && dados.boloes)) lista = dados.boloes;
    return lista.filter(ativo);
  }

  function totais(dados) {
    var lista = listaBoloes(dados);
    var totalCotas = 0;
    var adquiridas = 0;
    var disponiveis = 0;

    lista.forEach(function (bolao) {
      var total = numero(bolao.totalCotas || bolao.cotasTotal || bolao.TOTAL_COTAS);
      var confirmadas = numero(
        bolao.cotasConfirmadas ||
        bolao.cotasAdquiridas ||
        bolao.cotasTotaisAdquiridas ||
        bolao.COTAS_CONFIRMADAS ||
        bolao.COTAS_TOTAIS_ADQUIRIDAS
      );
      var saldoInformado = bolao.cotasDisponiveis;
      if (saldoInformado === undefined || saldoInformado === null || saldoInformado === '') {
        saldoInformado = bolao.COTAS_DISPONIVEIS;
      }
      var saldo = saldoInformado === undefined || saldoInformado === null || saldoInformado === ''
        ? Math.max(0, total - confirmadas)
        : numero(saldoInformado);

      totalCotas += total;
      adquiridas += confirmadas;
      disponiveis += saldo;
    });

    return {
      lista: lista,
      totalCotas: totalCotas,
      adquiridas: adquiridas,
      disponiveis: disponiveis
    };
  }

  function assinaturaResumo(resumo) {
    return resumo.lista.map(function (b) {
      return [
        b.id || b.ID || '',
        b.cotasConfirmadas || b.cotasAdquiridas || b.COTAS_CONFIRMADAS || '',
        b.cotasDisponiveis || b.COTAS_DISPONIVEIS || ''
      ].join(':');
    }).join('|');
  }

  function atualizarStatCards(resumo) {
    Array.prototype.forEach.call(document.querySelectorAll('.stat-card'), function (card) {
      var rotulo = card.querySelector('span');
      var valor = card.querySelector('strong');
      if (!rotulo || !valor) return;

      var texto = normalizar(rotulo.textContent);
      var novo = '';

      if (texto === 'COTAS DISPONIVEIS') novo = formatar(resumo.disponiveis);
      if (texto === 'TOTAL DE COTAS' || texto === 'TOTAL COTAS') novo = formatar(resumo.totalCotas);

      if (novo && String(valor.textContent || '').trim() !== novo) {
        valor.textContent = novo;
      }
    });
  }

  function bolaoDoCard(card, lista) {
    var titulo = card.querySelector('h3');
    var chaveTitulo = normalizar(titulo ? titulo.textContent : card.textContent);
    var melhor = null;

    lista.forEach(function (bolao) {
      var nome = bolao.nome || bolao.loteria || bolao.NOME || bolao.LOTERIA || '';
      var chave = normalizar(nome);
      if (chave && chaveTitulo.indexOf(chave) >= 0) melhor = bolao;
    });

    return melhor || (lista.length === 1 ? lista[0] : null);
  }

  function atualizarCardsBoloes(resumo) {
    Array.prototype.forEach.call(document.querySelectorAll('.bolao-card'), function (card) {
      var bolao = bolaoDoCard(card, resumo.lista);
      if (!bolao) return;

      var total = numero(bolao.totalCotas || bolao.cotasTotal || bolao.TOTAL_COTAS);
      var confirmadas = numero(
        bolao.cotasConfirmadas ||
        bolao.cotasAdquiridas ||
        bolao.cotasTotaisAdquiridas ||
        bolao.COTAS_CONFIRMADAS ||
        bolao.COTAS_TOTAIS_ADQUIRIDAS
      );
      var saldoValor = bolao.cotasDisponiveis;
      if (saldoValor === undefined || saldoValor === null || saldoValor === '') saldoValor = bolao.COTAS_DISPONIVEIS;
      var saldo = saldoValor === undefined || saldoValor === null || saldoValor === ''
        ? Math.max(0, total - confirmadas)
        : numero(saldoValor);

      Array.prototype.forEach.call(card.querySelectorAll('*'), function (el) {
        if (el.children.length) return;
        var texto = String(el.textContent || '').trim();
        var novo = '';

        if (/^Dispon[ií]veis\s*:\s*[-0-9.,]+$/i.test(texto)) {
          novo = 'Disponíveis: ' + formatar(saldo);
        }
        if (/^Cotas\s+dispon[ií]veis\s*:\s*[-0-9.,]+$/i.test(texto)) {
          novo = 'Cotas disponíveis: ' + formatar(saldo);
        }

        if (novo && texto !== novo) el.textContent = novo;
      });

      var cotasTexto = formatar(confirmadas);
      var saldoTexto = formatar(saldo);

      if (card.getAttribute('data-pss-v381-cotas') !== cotasTexto) {
        card.setAttribute('data-pss-v381-cotas', cotasTexto);
      }
      if (card.getAttribute('data-pss-v381-disponiveis') !== saldoTexto) {
        card.setAttribute('data-pss-v381-disponiveis', saldoTexto);
      }
    });
  }

  function aplicar(dados, forcarDom) {
    if (aplicando) return;

    var resumo = totais(dados);
    if (!resumo.lista.length) return;

    var assinatura = assinaturaResumo(resumo);
    if (!forcarDom && assinatura && assinatura === ultimaAssinatura) {
      window.PSS_V381_ULTIMAS_COTAS = resumo;
      return;
    }

    aplicando = true;
    try {
      atualizarStatCards(resumo);
      atualizarCardsBoloes(resumo);

      ultimaAssinatura = assinatura;
      window.PSS_V381_ULTIMAS_COTAS = resumo;
      document.documentElement.setAttribute('data-pss-v381-cotas-vivas', '1');
    } finally {
      aplicando = false;
    }
  }

  function urlAtual() {
    return ARQUIVO + '?v390=' + Math.floor(Date.now() / CACHE_BUCKET_MS);
  }

  function carregar(forcar) {
    if (document.hidden) return Promise.resolve(null);
    if (requisicaoAtual) return requisicaoAtual;
    if (!forcar && Date.now() - ultimaCarga < 12000) return Promise.resolve(null);

    ultimaCarga = Date.now();

    requisicaoAtual = fetch(urlAtual(), {
      method: 'GET',
      cache: 'default',
      credentials: 'same-origin'
    })
      .then(function (resposta) {
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
        return resposta.json();
      })
      .then(function (dados) {
        aplicar(dados, !!forcar);
        return dados;
      })
      .catch(function () { return null; })
      .finally(function () {
        requisicaoAtual = null;
      });

    return requisicaoAtual;
  }

  function iniciarTimer() {
    clearInterval(timer);
    if (document.hidden) return;
    timer = setInterval(function () { carregar(false); }, INTERVALO);
  }

  function nodeRelevante(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches && node.matches('.stat-card,.bolao-card,.home-section,.inicio-bolao-card')) return true;
    return !!(node.querySelector && node.querySelector('.stat-card,.bolao-card,.home-section,.inicio-bolao-card'));
  }

  function observar() {
    if (observador) observador.disconnect();
    var raiz = document.querySelector('.content') || document.querySelector('main') || document.body;
    if (!raiz) return;

    observador = new MutationObserver(function (registros) {
      if (aplicando || !window.PSS_V381_ULTIMAS_COTAS) return;

      var relevante = registros.some(function (registro) {
        return Array.prototype.some.call(registro.addedNodes || [], nodeRelevante);
      });

      if (!relevante) return;

      clearTimeout(reagendarObserver);
      reagendarObserver = setTimeout(function () {
        aplicar({ boloesAtivos: window.PSS_V381_ULTIMAS_COTAS.lista }, true);
      }, 180);
    });

    observador.observe(raiz, { childList: true, subtree: true });
  }

  function iniciar() {
    observar();
    var iniciarCarga = function () {
      carregar(true);
      iniciarTimer();
    };

    if (typeof window.PSS_V390_IDLE === 'function') {
      window.PSS_V390_IDLE(iniciarCarga, 900);
    } else if ('requestIdleCallback' in window) {
      window.requestIdleCallback(iniciarCarga, { timeout: 900 });
    } else {
      setTimeout(iniciarCarga, 120);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearInterval(timer);
      timer = 0;
      return;
    }
    carregar(false);
    iniciarTimer();
  }, { passive: true });

  window.addEventListener('focus', function () { carregar(false); }, { passive: true });
  window.addEventListener('pss:pagamento-confirmado', function () { carregar(true); });
  window.addEventListener('pss:dados-atualizados', function () { carregar(true); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  window.PSS_V390_ATUALIZAR_COTAS = function () { return carregar(true); };
  window.PSS_V390_DIAGNOSTICAR_COTAS = function () {
    return {
      sucesso: true,
      versao: 'V390_COTAS_VIVAS_EFICIENTE',
      intervaloMs: INTERVALO,
      cacheBucketMs: CACHE_BUCKET_MS,
      requisicaoEmAndamento: !!requisicaoAtual,
      ultimaCarga: ultimaCarga,
      possuiResumo: !!window.PSS_V381_ULTIMAS_COTAS
    };
  };
})();
