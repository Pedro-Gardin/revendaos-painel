// =============================================
//  auth-guard.js — Proteção do painel
// =============================================

(function() {

  // Aguarda o Firebase estar pronto
  function iniciar() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(iniciar, 200);
      return;
    }

    // Inicializa o Firebase se ainda não foi
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey:            "AIzaSyDzJP-XF37RCedf_wN7svLg1YZ82u3ULF8",
        authDomain:        "painelrevenda-2bc8b.firebaseapp.com",
        projectId:         "painelrevenda-2bc8b",
        storageBucket:     "painelrevenda-2bc8b.firebasestorage.app",
        messagingSenderId: "57821691298",
        appId:             "1:57821691298:web:04198c179330458a3ac6fb"
      });
    }

    const auth = firebase.auth();

    // Flag para evitar redirecionamento duplo
    let redirecionou = false;

    auth.onAuthStateChanged(function(user) {
      if (redirecionou) return;

      if (!user) {
        redirecionou = true;
        window.location.replace('login.html');
        return;
      }

      // Logado — mostra email
      const emailEl = document.getElementById('usuario-email');
      if (emailEl) emailEl.textContent = user.email;
    });
  }

  iniciar();

  // Função de logout
  window.sair = function() {
    if (!confirm('Deseja sair do painel?')) return;
    firebase.auth().signOut().then(function() {
      window.location.replace('login.html');
    });
  };

})();