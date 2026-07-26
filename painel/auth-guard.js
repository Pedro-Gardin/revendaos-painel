// =============================================
//  auth-guard.js v2 — Proteção do painel
//  - Verifica login
//  - Rate limiting local (bloqueia força bruta)
//  - Detecta sessão expirada
//  - Loga tentativas suspeitas
// =============================================

(function() {

  // ── RATE LIMITING ────────────────────────
  // Bloqueia o navegador após 5 tentativas erradas
  const MAX_TENTATIVAS = 5;
  const BLOQUEIO_MS    = 15 * 60 * 1000; // 15 minutos

  function verificarBloqueio() {
    const dados = JSON.parse(sessionStorage.getItem('_ap_auth') || '{}');
    if (!dados.bloqueadoAte) return false;
    if (Date.now() < dados.bloqueadoAte) return true;
    // Bloqueio expirou
    sessionStorage.removeItem('_ap_auth');
    return false;
  }

  function registrarTentativaFalha() {
    const dados = JSON.parse(sessionStorage.getItem('_ap_auth') || '{}');
    dados.tentativas = (dados.tentativas || 0) + 1;
    if (dados.tentativas >= MAX_TENTATIVAS) {
      dados.bloqueadoAte = Date.now() + BLOQUEIO_MS;
      console.warn('[AutoPrime] Muitas tentativas. Acesso bloqueado por 15min.');
    }
    sessionStorage.setItem('_ap_auth', JSON.stringify(dados));
    return dados.tentativas;
  }

  function limparTentativas() {
    sessionStorage.removeItem('_ap_auth');
  }

  function tempoRestanteBloqueio() {
    const dados = JSON.parse(sessionStorage.getItem('_ap_auth') || '{}');
    if (!dados.bloqueadoAte) return 0;
    return Math.ceil((dados.bloqueadoAte - Date.now()) / 60000);
  }

  // Expõe funções pro login.html usar
  window._authGuard = {
    verificarBloqueio,
    registrarTentativaFalha,
    limparTentativas,
    tempoRestanteBloqueio
  };

  // ── VERIFICAÇÃO DE LOGIN ─────────────────
  const checkInterval = setInterval(() => {
    if (typeof firebase === 'undefined') return;
    clearInterval(checkInterval);

    const auth = firebase.auth();

    // Timeout de segurança — se demorar mais de 5s sem resposta
    const timeout = setTimeout(() => {
      window.location.href = 'login.html';
    }, 5000);

    auth.onAuthStateChanged(user => {
      clearTimeout(timeout);

      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      // Usuário logado — mostra email na sidebar
      const emailEl = document.getElementById('usuario-email');
      if (emailEl) emailEl.textContent = user.email;

      // Limpa tentativas após login bem sucedido
      limparTentativas();

      // ── SESSÃO EXPIRADA ──────────────────
      // Verifica a cada 30 minutos se o token ainda é válido
      setInterval(() => {
        user.getIdToken(true).catch(() => {
          alert('Sua sessão expirou. Faça login novamente.');
          auth.signOut().then(() => window.location.href = 'login.html');
        });
      }, 30 * 60 * 1000);
    });
  }, 100);

  // ── LOGOUT ──────────────────────────────
  window.sair = function() {
    if (!confirm('Deseja sair do painel?')) return;
    firebase.auth().signOut().then(() => {
      limparTentativas();
      window.location.href = 'login.html';
    });
  };

  // ── PROTEÇÃO BÁSICA CONTRA DEVTOOLS ─────
  // Detecta abertura do console e avisa (não bloqueia, só registra)
  let devtools = false;
  setInterval(() => {
    const antes = Date.now();
    debugger;
    if (Date.now() - antes > 100 && !devtools) {
      devtools = true;
      console.warn('%c⚠️ AutoPrime — Acesso restrito', 'color:red;font-size:20px;font-weight:bold');
      console.warn('Este painel é de uso exclusivo do lojista autorizado.');
    }
  }, 1000);

})();