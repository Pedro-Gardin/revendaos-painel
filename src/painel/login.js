// =============================================
//  login.js — Autenticação do painel (SDK modular)
// =============================================
import { auth } from '../shared/firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

// Se já tiver logado, vai direto pro painel
onAuthStateChanged(auth, user => {
  if (user) window.location.href = 'index.html';
});

// ── ENTRAR ──────────────────────────────
async function entrar() {
  const email   = document.getElementById('inp-email').value.trim();
  const senha   = document.getElementById('inp-senha').value;
  const lembrar = document.getElementById('chk-lembrar').checked;

  if (!email || !senha) {
    mostrarErro('Preencha email e senha.');
    return;
  }

  setLoading(true);
  limparMensagens();

  try {
    const persistencia = lembrar ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistencia);
    await signInWithEmailAndPassword(auth, email, senha);
    // onAuthStateChanged vai redirecionar automaticamente
  } catch(e) {
    setLoading(false);
    mostrarErro(traduzirErro(e.code));
  }
}

// Entrar com Enter
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') entrar();
});

// ── TOGGLE SENHA ────────────────────────
function toggleSenha() {
  const inp  = document.getElementById('inp-senha');
  const icon = document.getElementById('icone-olho');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'ti ti-eye-off';
  } else {
    inp.type = 'password';
    icon.className = 'ti ti-eye';
  }
}

// ── RECUPERAR SENHA ─────────────────────
function abrirRecuperar() {
  const email = document.getElementById('inp-email').value;
  if (email) document.getElementById('inp-recuperar').value = email;
  document.getElementById('modal-recuperar').classList.add('aberto');
}

function fecharRecuperar() {
  document.getElementById('modal-recuperar').classList.remove('aberto');
}

async function enviarRecuperacao() {
  const email = document.getElementById('inp-recuperar').value.trim();
  if (!email) return;
  try {
    await sendPasswordResetEmail(auth, email);
    fecharRecuperar();
    mostrarOk('Link enviado para ' + email + '. Verifique sua caixa de entrada.');
  } catch(e) {
    mostrarErro('Email não encontrado. Verifique e tente novamente.');
  }
}

// ── UTILITÁRIOS ─────────────────────────
function setLoading(on) {
  const btn = document.getElementById('btn-entrar');
  btn.disabled = on;
  btn.innerHTML = on
    ? '<i class="ti ti-loader-2 spin"></i> Entrando...'
    : '<i class="ti ti-login"></i> Entrar no painel';
}

function mostrarErro(msg) {
  limparMensagens();
  document.getElementById('msg-erro-txt').textContent = msg;
  document.getElementById('msg-erro').classList.add('show');
}

function mostrarOk(msg) {
  limparMensagens();
  document.getElementById('msg-ok-txt').textContent = msg;
  document.getElementById('msg-ok').classList.add('show');
}

function limparMensagens() {
  document.getElementById('msg-erro').classList.remove('show');
  document.getElementById('msg-ok').classList.remove('show');
}

function traduzirErro(code) {
  const erros = {
    'auth/user-not-found':      'Email não cadastrado.',
    'auth/wrong-password':      'Senha incorreta. Tente novamente.',
    'auth/invalid-email':       'Email inválido.',
    'auth/too-many-requests':   'Muitas tentativas. Aguarde alguns minutos.',
    'auth/user-disabled':       'Usuário desativado. Contate o suporte.',
    'auth/invalid-credential':  'Email ou senha incorretos.',
  };
  return erros[code] || 'Erro ao entrar. Tente novamente.';
}

// ─── EXPOSTAS AO HTML (onclick inline) ───
Object.assign(window, {
  entrar, toggleSenha, abrirRecuperar, fecharRecuperar, enviarRecuperacao
});
