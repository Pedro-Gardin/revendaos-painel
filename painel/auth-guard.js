// =============================================
//  auth-guard.js
//  Inclua este script no index.html do painel
//  ANTES do app.js
//  Redireciona para login se não estiver logado
// =============================================

// Firebase Auth via CDN — adicione no index.html:
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>

(function() {
  // Aguarda o Firebase carregar
  const checkAuth = setInterval(() => {
    if (typeof firebase === 'undefined') return;
    clearInterval(checkAuth);

    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
      if (!user) {
        // Não está logado — redireciona para login
        window.location.href = 'login.html';
      } else {
        // Logado — mostra o email na sidebar
        const el = document.getElementById('usuario-email');
        if (el) el.textContent = user.email;
      }
    });
  }, 100);
})();

// Função de logout — use no botão sair da sidebar
function sair() {
  if (!confirm('Deseja sair do painel?')) return;
  firebase.auth().signOut().then(() => {
    window.location.href = 'login.html';
  });
}