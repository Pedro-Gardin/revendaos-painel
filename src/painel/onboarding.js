// =============================================
//  onboarding.js — Criação de uma nova revenda
//  (organization) + o usuário logado vira "dono"
// =============================================
import { db, auth } from '../shared/firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

let usuarioAtual = null;

onAuthStateChanged(auth, user => {
  if (!user) { window.location.replace('login.html'); return; }
  usuarioAtual = user;
  const emailEl = document.getElementById('onb-email');
  if (emailEl) emailEl.textContent = user.email;
});

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Gera o slug automaticamente enquanto digita o nome
document.getElementById('onb-nome')?.addEventListener('input', e => {
  const slugEl = document.getElementById('onb-slug');
  if (!slugEl.dataset.editadoManual) {
    slugEl.value = slugify(e.target.value);
  }
});
document.getElementById('onb-slug')?.addEventListener('input', e => {
  e.target.dataset.editadoManual = '1';
  e.target.value = slugify(e.target.value);
});

async function criarRevenda() {
  const nome = document.getElementById('onb-nome').value.trim();
  let slug   = document.getElementById('onb-slug').value.trim();
  const cidade = document.getElementById('onb-cidade').value.trim();
  const uf     = document.getElementById('onb-uf').value.trim().toUpperCase();
  const msgEl = document.getElementById('onb-msg');

  if (!nome) { mostrarMsg('Informe o nome da revenda.', 'erro'); return; }
  if (!slug) slug = slugify(nome);
  if (!usuarioAtual) { mostrarMsg('Sessão expirada. Faça login novamente.', 'erro'); return; }

  const btn = document.getElementById('onb-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Criando...';

  try {
    // Confere se o slug já existe (organization ID = slug, direto)
    const orgRef  = doc(db, 'organizations', slug);
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      mostrarMsg('Esse identificador já está em uso. Escolha outro.', 'erro');
      btn.disabled = false;
      btn.innerHTML = 'Criar minha revenda';
      return;
    }

    // Cria a organization
    await setDoc(orgRef, {
      nome,
      slug,
      cidade,
      uf,
      plano: 'gratis',
      criadoEm: serverTimestamp(),
      criadoPor: usuarioAtual.uid,
    });

    // Cria o membro "dono" (o próprio usuário)
    await setDoc(doc(db, 'organizations', slug, 'members', usuarioAtual.uid), {
      uid: usuarioAtual.uid,
      email: usuarioAtual.email,
      role: 'dono',
      criadoEm: serverTimestamp(),
    });

    // Atalho pra achar rápido a organization do usuário (evita
    // consulta collectionGroup, que o Firestore não permite
    // combinar com regras baseadas em exists())
    await setDoc(doc(db, 'users', usuarioAtual.uid), {
      orgId: slug,
      role: 'dono',
    });

    mostrarMsg('Revenda criada! Redirecionando...', 'ok');
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  } catch (e) {
    mostrarMsg('Erro ao criar: ' + e.message, 'erro');
    btn.disabled = false;
    btn.innerHTML = 'Criar minha revenda';
  }
}

function mostrarMsg(texto, tipo) {
  const el = document.getElementById('onb-msg');
  el.textContent = texto;
  el.className = 'msg show ' + (tipo === 'erro' ? 'erro' : 'ok');
}

window.criarRevenda = criarRevenda;
window.sairOnboarding = function() {
  signOut(auth).then(() => window.location.replace('login.html'));
};
