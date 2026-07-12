(function () {
  'use strict';

  if (window.PSS_V363_LOGIN_PAGAMENTOS_APLICADO) return;
  window.PSS_V363_LOGIN_PAGAMENTOS_APLICADO = true;

  var VERSAO = 'V363_FIX_LOGIN_EXCLUIR_COMPROVANTE';
  var loginEmAndamento = false;
  var prepararBotoesTimer = 0;

  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) CONFIG.versao = VERSAO;
    if (window.CONFIG) window.CONFIG.versao = VERSAO;
    localStorage.setItem('PSS_INDEX_VERSION', VERSAO);
  } catch (erroVersao) {}

  function elemento(id) {
    return document.getElementById(id);
  }

  function texto(valor) {
    return String(valor == null ? '' : valor).trim();
  }

  function escapar(valor) {
    if (typeof escapeHtml === 'function') return escapeHtml(valor);
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (caractere) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[caractere];
    });
  }

  function esperar(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function erroComCodigo(codigo, mensagem) {
    var erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
  }

  function comLimite(promise, limiteMs, codigo, mensagem) {
    return new Promise(function (resolve, reject) {
      var concluido = false;
      var timer = setTimeout(function () {
        if (concluido) return;
        concluido = true;
        reject(erroComCodigo(codigo, mensagem));
      }, limiteMs);

      Promise.resolve(promise).then(function (resultado) {
        if (concluido) return;
        concluido = true;
        clearTimeout(timer);
        resolve(resultado);
      }, function (erro) {
        if (concluido) return;
        concluido = true;
        clearTimeout(timer);
        reject(erro);
      });
    });
  }

  function limparPromessaFirebaseFalha() {
    try {
      if (typeof FIREBASE_INIT_PROMISE !== 'undefined') FIREBASE_INIT_PROMISE = null;
    } catch (erroPromessa) {}
  }

  function aguardarBibliotecaFirebase(limiteMs) {
    return new Promise(function (resolve, reject) {
      var inicio = Date.now();

      (function verificar() {
        if (window.firebase && firebase.auth && firebase.firestore) {
          resolve(true);
          return;
        }

        if (Date.now() - inicio >= limiteMs) {
          reject(erroComCodigo(
            'pss/firebase-sdk-timeout',
            'O Firebase não carregou dentro do tempo esperado.'
          ));
          return;
        }

        setTimeout(verificar, 100);
      })();
    });
  }

  async function inicializarFirebaseRapido() {
    if (!window.firebase || !firebase.auth || !firebase.firestore) {
      await aguardarBibliotecaFirebase(6000);
    }

    if (typeof inicializarFirebase_ !== 'function') {
      throw erroComCodigo('pss/firebase-init-ausente', 'Inicialização do Firebase não localizada.');
    }

    try {
      return await comLimite(
        inicializarFirebase_(),
        8000,
        'pss/firebase-init-timeout',
        'A inicialização do Firebase excedeu 8 segundos.'
      );
    } catch (primeiroErro) {
      limparPromessaFirebaseFalha();

      if (String(primeiroErro && primeiroErro.code || '').indexOf('timeout') < 0 && window.firebase) {
        await esperar(250);
        return comLimite(
          inicializarFirebase_(),
          8000,
          'pss/firebase-init-timeout',
          'A inicialização do Firebase excedeu 8 segundos.'
        );
      }

      throw primeiroErro;
    }
  }

  function mensagemLogin(erro) {
    var codigo = String(erro && erro.code || '');
    var mensagem = texto(erro && erro.message ? erro.message : erro);

    if (codigo === 'auth/user-not-found' || codigo === 'auth/invalid-credential' || codigo === 'auth/wrong-password') {
      return 'E-mail ou senha inválidos no Firebase.';
    }
    if (codigo === 'auth/too-many-requests') {
      return 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.';
    }
    if (codigo === 'auth/network-request-failed') {
      return 'O Firebase não respondeu. Verifique a conexão e toque em Entrar novamente.';
    }
    if (codigo === 'pss/firebase-sdk-timeout' || codigo === 'pss/firebase-init-timeout') {
      return 'O Firebase demorou para carregar. Atualize a página e tente novamente.';
    }
    if (codigo === 'pss/firebase-login-timeout') {
      return 'A autenticação excedeu 12 segundos e foi interrompida. Tente novamente.';
    }
    if (codigo === 'pss/firebase-aprovacao-timeout') {
      return 'O acesso foi autenticado, mas a verificação do cadastro demorou. Tente novamente.';
    }

    try {
      if (typeof firebaseMensagemErro_ === 'function') {
        var traduzida = firebaseMensagemErro_(erro);
        if (traduzida) return traduzida;
      }
    } catch (erroTraducao) {}

    return mensagem || 'Não foi possível entrar no sistema.';
  }

  function normalizarUsuario(usuario, email) {
    try {
      if (typeof normalizarUsuarioSessao_ === 'function') {
        return normalizarUsuarioSessao_(usuario);
      }
    } catch (erroNormalizar) {}

    usuario = usuario || {};
    var perfil = texto(usuario.perfil || usuario.role || 'USUARIO').toUpperCase();
    return {
      nome: texto(usuario.nome || usuario.name || email || 'Usuário'),
      email: texto(usuario.email || email).toLowerCase(),
      perfil: perfil,
      role: perfil.indexOf('ADMIN') >= 0 ? 'admin' : 'usuario',
      status: texto(usuario.status || 'APROVADO'),
      ativo: usuario.ativo !== false
    };
  }

  function concluirLogin(usuario, email, lembrar) {
    var u = normalizarUsuario(usuario, email);
    if (!u.email) throw new Error('O Firebase retornou o usuário sem e-mail.');

    if (typeof ESTADO !== 'undefined' && ESTADO) {
      ESTADO.usuario = u;
      ESTADO.email = u.email;
      ESTADO.role = u.role;
    }

    if (lembrar) localStorage.setItem('PSS_BOLAO_EMAIL', u.email);
    else localStorage.removeItem('PSS_BOLAO_EMAIL');

    try {
      if (typeof salvarSessao === 'function') salvarSessao(u);
      else localStorage.setItem('PSS_BOLAO_SESSAO', JSON.stringify({
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        role: u.role,
        status: u.status,
        ativo: u.ativo,
        _auth: 'firebase',
        _ts: Date.now(),
        _versao: VERSAO
      }));
    } catch (erroSessao) {}

    if (typeof aplicarLayoutLogado === 'function') aplicarLayoutLogado();
    if (typeof navegar === 'function') navegar('inicio');
  }

  async function autenticarFirebase(email, senha, caixaMensagem) {
    await inicializarFirebaseRapido();

    if (typeof FIREBASE_AUTH === 'undefined' || !FIREBASE_AUTH) {
      throw erroComCodigo('pss/firebase-auth-ausente', 'Autenticação Firebase não inicializada.');
    }

    await comLimite(
      FIREBASE_AUTH.signInWithEmailAndPassword(email, senha),
      12000,
      'pss/firebase-login-timeout',
      'A autenticação Firebase excedeu 12 segundos.'
    );

    if (caixaMensagem) {
      caixaMensagem.innerHTML = '<div class="notice info">Verificando aprovação do cadastro...</div>';
    }

    if (typeof firebaseValidarUsuarioAprovado_ === 'function') {
      return comLimite(
        firebaseValidarUsuarioAprovado_(email),
        10000,
        'pss/firebase-aprovacao-timeout',
        'A verificação do cadastro excedeu 10 segundos.'
      );
    }

    return {
      nome: email,
      email: email,
      perfil: 'USUARIO',
      role: 'usuario',
      status: 'APROVADO',
      ativo: true
    };
  }

  window.fazerLogin = async function (evento) {
    if (evento && evento.preventDefault) evento.preventDefault();
    if (evento && evento.stopPropagation) evento.stopPropagation();
    if (loginEmAndamento) return false;

    var campoEmail = elemento('loginEmail');
    var campoSenha = elemento('loginSenha');
    var lembrarCampo = elemento('lembrarEmail');
    var botao = elemento('btnLogin');
    var caixaMensagem = elemento('loginMsg');
    var email = texto(campoEmail && campoEmail.value).toLowerCase();
    var senha = texto(campoSenha && campoSenha.value);
    var lembrar = !!(lembrarCampo && lembrarCampo.checked);

    if (!email || !senha) {
      if (caixaMensagem) caixaMensagem.innerHTML = '<div class="notice error">Informe e-mail e senha.</div>';
      return false;
    }

    loginEmAndamento = true;
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Entrando...';
    }
    if (caixaMensagem) {
      caixaMensagem.innerHTML = '<div class="notice info">Autenticando no Firebase...</div>';
    }

    try {
      var usuario = await autenticarFirebase(email, senha, caixaMensagem);
      concluirLogin(usuario, email, lembrar);
      return false;
    } catch (erroLogin) {
      limparPromessaFirebaseFalha();
      try {
        if (typeof FIREBASE_AUTH !== 'undefined' && FIREBASE_AUTH) {
          comLimite(FIREBASE_AUTH.signOut(), 2000, 'pss/signout-timeout', 'Tempo excedido.').catch(function () {});
        }
      } catch (erroSair) {}

      var mensagem = mensagemLogin(erroLogin);
      if (caixaMensagem) caixaMensagem.innerHTML = '<div class="notice error">' + escapar(mensagem) + '</div>';
      try {
        if (typeof toast === 'function') toast(mensagem, 'error');
      } catch (erroToast) {}
      return false;
    } finally {
      loginEmAndamento = false;
      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Entrar';
      }
    }
  };

  try {
    fazerLogin = window.fazerLogin;
  } catch (erroAliasLogin) {}

  function preAquecerFirebase() {
    if (document.hidden) return;
    inicializarFirebaseRapido().catch(function () {
      limparPromessaFirebaseFalha();
    });
  }

  var renderLoginAnterior = window.renderLogin;
  if (typeof renderLoginAnterior === 'function') {
    window.renderLogin = function () {
      var resultado = renderLoginAnterior.apply(this, arguments);
      setTimeout(preAquecerFirebase, 30);
      return resultado;
    };
    try {
      renderLogin = window.renderLogin;
    } catch (erroAliasRender) {}
  }

  function usuarioAdministrador() {
    try {
      if (typeof isAdmin === 'function') return !!isAdmin();
    } catch (erroAdmin) {}

    try {
      var perfil = texto(
        typeof ESTADO !== 'undefined' && ESTADO
          ? (ESTADO.role + ' ' + (ESTADO.usuario && ESTADO.usuario.perfil || ''))
          : ''
      ).toUpperCase();
      return perfil.indexOf('ADMIN') >= 0 || perfil.indexOf('MESTRE') >= 0;
    } catch (erroPerfil) {
      return false;
    }
  }

  function linhaDoCard(card) {
    if (!card) return 0;
    var botaoReferencia = card.querySelector('button[onclick*="reprocessarPagamentoAdmin("]');
    if (!botaoReferencia) return 0;
    var atributo = texto(botaoReferencia.getAttribute('onclick'));
    var encontrado = atributo.match(/reprocessarPagamentoAdmin\s*\(\s*(\d+)\s*\)/i);
    return encontrado ? Number(encontrado[1]) : 0;
  }

  function programarBotoesExclusao() {
    clearTimeout(prepararBotoesTimer);
    prepararBotoesTimer = setTimeout(adicionarBotoesExclusao, 80);
  }

  function adicionarBotoesExclusao() {
    if (!usuarioAdministrador()) return;

    document.querySelectorAll('.pay-admin-card-pro, .payment-admin-card').forEach(function (card) {
      if (card.querySelector('.pss-v363-excluir-comprovante')) return;
      var acoes = card.querySelector('.pay-card-actions');
      if (!acoes) return;

      var linha = linhaDoCard(card);
      if (!linha) return;

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn-danger pss-v363-excluir-comprovante';
      botao.textContent = 'Excluir comprovante';
      botao.setAttribute('data-linha-pagamento', String(linha));
      botao.addEventListener('click', function () {
        window.abrirExcluirComprovanteV363(linha);
      });
      acoes.appendChild(botao);
    });
  }

  window.abrirExcluirComprovanteV363 = function (linha) {
    linha = Number(linha || 0);
    if (!linha) {
      if (typeof toast === 'function') toast('Linha do comprovante não localizada.', 'error');
      return;
    }

    var conteudo = '' +
      '<div class="notice warn"><strong>Excluir este comprovante?</strong></div>' +
      '<p>O registro será removido da aba PAGAMENTOS e o arquivo correspondente será enviado para a lixeira do Google Drive.</p>' +
      '<p><strong>Use somente para comprovante duplicado ou enviado por engano.</strong></p>' +
      '<div class="actions" style="justify-content:flex-end;">' +
        '<button type="button" class="btn btn-light" onclick="fecharModal()">Cancelar</button>' +
        '<button type="button" class="btn btn-danger" id="btnExcluirComprovanteV363" onclick="executarExcluirComprovanteV363(' + linha + ')">Excluir comprovante</button>' +
      '</div>';

    if (typeof abrirModal === 'function') abrirModal('Confirmar exclusão', conteudo);
    else if (window.confirm('Excluir definitivamente este comprovante duplicado?')) {
      window.executarExcluirComprovanteV363(linha);
    }
  };

  window.executarExcluirComprovanteV363 = async function (linha) {
    linha = Number(linha || 0);
    var botao = elemento('btnExcluirComprovanteV363');
    if (!linha) return;

    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Excluindo...';
    }

    try {
      var adminEmail = '';
      try {
        adminEmail = texto(typeof ESTADO !== 'undefined' && ESTADO ? ESTADO.email : '').toLowerCase();
      } catch (erroEmail) {}

      if (typeof api !== 'function') throw new Error('API do site não inicializada.');

      var resposta = await comLimite(
        api('excluirComprovantePagamentoV363', {
          linha: linha,
          adminEmail: adminEmail
        }, [linha]),
        20000,
        'pss/excluir-timeout',
        'A exclusão excedeu 20 segundos.'
      );

      if (resposta && (resposta.sucesso === false || resposta.ok === false)) {
        throw new Error(resposta.erro || resposta.msg || 'A API não confirmou a exclusão.');
      }

      try {
        if (typeof fecharModal === 'function') fecharModal();
        if (typeof limparCacheRapidoV362 === 'function') limparCacheRapidoV362();
        if (typeof ESTADO !== 'undefined' && ESTADO) ESTADO.pagamentosAdminCache = null;
      } catch (erroLimpeza) {}

      if (typeof toast === 'function') {
        toast(resposta && resposta.msg ? resposta.msg : 'Comprovante excluído com sucesso.');
      }

      var botaoCard = document.querySelector('.pss-v363-excluir-comprovante[data-linha-pagamento="' + linha + '"]');
      var card = botaoCard && botaoCard.closest('.pay-admin-card-pro, .payment-admin-card');
      if (card) card.remove();

      if (typeof renderPagamentosAdminTab === 'function') {
        setTimeout(function () {
          renderPagamentosAdminTab('efetuados');
        }, 150);
      }
    } catch (erroExcluir) {
      var mensagem = texto(erroExcluir && erroExcluir.message ? erroExcluir.message : erroExcluir);
      if (/Action n[aã]o reconhecida|excluirComprovantePagamentoV363/i.test(mensagem)) {
        mensagem = 'A rota de exclusão ainda não foi instalada no Apps Script. Aplique o PATCH_V363 e publique uma nova versão da API.';
      }
      if (typeof toast === 'function') toast(mensagem || 'Não foi possível excluir o comprovante.', 'error');
      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Excluir comprovante';
      }
    }
  };

  var observador = new MutationObserver(programarBotoesExclusao);
  observador.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('click', function (evento) {
    var alvo = evento.target && evento.target.closest ? evento.target.closest('[data-view="pagamentos"]') : null;
    if (alvo) setTimeout(programarBotoesExclusao, 250);
  }, true);

  setTimeout(programarBotoesExclusao, 300);

  window.diagnosticarV363 = function () {
    return {
      sucesso: true,
      versao: VERSAO,
      loginComLimite: true,
      limiteInicializacaoMs: 8000,
      limiteAutenticacaoMs: 12000,
      limiteAprovacaoMs: 10000,
      temporizadoresGlobaisAlterados: false,
      botaoExcluirComprovante: true,
      rotaBackend: 'excluirComprovantePagamentoV363'
    };
  };
})();
