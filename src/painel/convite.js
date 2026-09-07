import { auth } from '../shared/firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { buscarConvitesPendentes, aceitarConvite, recusarConvite, CARGO_LABEL } from '../shared/convites.js';
import { esc } from '../shared/seguranca.js';

let convites = [];

function mostrarMsg(texto, tipo = 'erro') {
  const el = document.getElementById('convite-msg');
  el.textContent = texto;
  el.className = `convite-msg show ${tipo}`;
}

function renderConvites() {
  const el = document.getElementById('convites-disponiveis');
  if (!convites.length) {
    el.innerHTML = '<div class="convite-vazio">Não há convites pendentes para este e-mail.</div>';
    return;
  }
  el.innerHTML = convites.map(convite => `
    <article class="convite-opcao">
      <div class="convite-opcao-titulo">${esc(convite.orgNome || convite.orgId)}</div>
      <div class="convite-opcao-cargo">Você foi convidado como ${esc(CARGO_LABEL[convite.role] || convite.role)}.</div>
      <div class="convite-acoes">
        <button type="button" class="convite-aceitar" data-aceitar="${esc(convite.id)}">Aceitar convite</button>
        <button type="button" class="convite-recusar" data-recusar="${esc(convite.id)}">Recusar</button>
      </div>
    </article>`).join('');
}

async function carregarConvites(email) {
  try {
    convites = await buscarConvitesPendentes(email);
    renderConvites();
  } catch (erro) {
    mostrarMsg(`Não foi possível buscar os convites: ${erro.message}`);
    document.getElementById('convites-disponiveis').innerHTML = '';
  }
}

document.getElementById('convites-disponiveis').addEventListener('click', async event => {
  const botao = event.target.closest('[data-aceitar], [data-recusar]');
  if (!botao) return;
  const id = botao.dataset.aceitar || botao.dataset.recusar;
  const convite = convites.find(item => item.id === id);
  if (!convite) return;
  document.querySelectorAll('.convite-aceitar, .convite-recusar').forEach(item => { item.disabled = true; });
  try {
    if (botao.dataset.aceitar) {
      botao.textContent = 'Entrando...';
      await aceitarConvite(convite);
      window.location.replace('index.html');
    } else {
      await recusarConvite(convite);
      convites = convites.filter(item => item.id !== convite.id);
      renderConvites();
    }
  } catch (erro) {
    mostrarMsg(erro.message || 'Não foi possível atualizar o convite.');
    document.querySelectorAll('.convite-aceitar, .convite-recusar').forEach(item => { item.disabled = false; });
  }
});

document.getElementById('btn-sair-convite').addEventListener('click', () => signOut(auth).then(() => window.location.replace('login.html')));

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace('login.html');
    return;
  }
  document.getElementById('convite-email').textContent = user.email || '';
  carregarConvites(user.email);
});
