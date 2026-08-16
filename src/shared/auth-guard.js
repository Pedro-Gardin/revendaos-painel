// =============================================
//  auth-guard.js — Proteção do painel
//  Importa como side-effect no topo de main.js
//  e relatorio.js pra rodar antes de tudo.
// =============================================
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';

let redirecionou = false;

onAuthStateChanged(auth, user => {
  if (redirecionou) return;

  if (!user) {
    redirecionou = true;
    window.location.replace('login.html');
    return;
  }

  const emailEl = document.getElementById('usuario-email');
  if (emailEl) emailEl.textContent = user.email;
});

// Função de logout, exposta pro onclick="sair()" no HTML
window.sair = function() {
  if (!confirm('Deseja sair do painel?')) return;
  signOut(auth).then(() => {
    window.location.replace('login.html');
  });
};
