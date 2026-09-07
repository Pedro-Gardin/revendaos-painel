import '../shared/auth-guard.js';
import { db } from '../shared/firebase.js';
import { getOrgContext } from '../shared/tenant.js';
import { esc } from '../shared/seguranca.js';
import { CARGO_LABEL, cancelarConvite, criarConvite } from '../shared/convites.js';
import { collection, onSnapshot } from 'firebase/firestore';

let orgCtx = null;
let membros = [];
let convites = [];

function iniciais(email = '') {
  return email.split('@')[0].split(/[._-]/).map(p => p[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

function cargoLabel(role) {
  return CARGO_LABEL[role] || role || 'Sem cargo';
}

function mostrarMsg(texto, tipo = 'ok') {
  const el = document.getElementById('equipe-msg');
  el.textContent = texto;
  el.className = `equipe-msg show ${tipo}`;
}

function renderMembros() {
  const el = document.getElementById('lista-membros');
  const contador = document.getElementById('membros-contador');
  contador.textContent = `${membros.length} ${membros.length === 1 ? 'membro' : 'membros'}`;
  if (!membros.length) {
    el.innerHTML = '<div class="equipe-vazio">Nenhum membro encontrado.</div>';
    return;
  }
  el.innerHTML = membros.map(membro => `
    <div class="equipe-item">
      <div class="equipe-avatar">${esc(iniciais(membro.email))}</div>
      <div class="equipe-item-dados"><div class="equipe-item-email">${esc(membro.email || 'Usuário sem e-mail')}</div><div class="equipe-item-sub">Acesso ativo</div></div>
      <span class="equipe-cargo ${esc(membro.role || '')}">${esc(cargoLabel(membro.role))}</span>
    </div>`).join('');
}

function renderConvites() {
  const el = document.getElementById('lista-convites');
  if (!convites.length) {
    el.innerHTML = '<div class="equipe-vazio">Nenhum convite pendente.</div>';
    return;
  }
  el.innerHTML = convites.map(convite => `
    <div class="equipe-item">
      <div class="equipe-avatar"><i class="ti ti-mail"></i></div>
      <div class="equipe-item-dados"><div class="equipe-item-email">${esc(convite.email || '')}</div><div class="equipe-item-sub">Aguardando resposta</div></div>
      <span class="equipe-cargo pendente">${esc(cargoLabel(convite.role))}</span>
      <button class="btn-cancelar-convite" type="button" data-cancelar="${esc(convite.id)}" title="Cancelar convite"><i class="ti ti-x"></i></button>
    </div>`).join('');
}

async function enviarConvite(event) {
  event.preventDefault();
  const email = document.getElementById('convite-email').value.trim();
  const role = document.getElementById('convite-role').value;
  const botao = document.getElementById('btn-convidar');
  botao.disabled = true;
  botao.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Enviando...';
  try {
    await criarConvite({ orgId: orgCtx.orgId, orgNome: orgCtx.orgNome, email, role, criadoPor: orgCtx.uid });
    document.getElementById('form-convite').reset();
    mostrarMsg(`Convite enviado para ${email}.`);
  } catch (erro) {
    mostrarMsg(erro.message || 'Não foi possível enviar o convite.', 'erro');
  } finally {
    botao.disabled = false;
    botao.innerHTML = '<i class="ti ti-send"></i> Enviar convite';
  }
}

document.getElementById('form-convite').addEventListener('submit', enviarConvite);
document.getElementById('lista-convites').addEventListener('click', async event => {
  const botao = event.target.closest('[data-cancelar]');
  if (!botao || !orgCtx) return;
  const convite = convites.find(item => item.id === botao.dataset.cancelar);
  if (!convite || !confirm(`Cancelar o convite enviado para ${convite.email}?`)) return;
  botao.disabled = true;
  try {
    await cancelarConvite(orgCtx.orgId, convite.id);
    mostrarMsg('Convite cancelado.');
  } catch (erro) {
    mostrarMsg(erro.message || 'Não foi possível cancelar o convite.', 'erro');
    botao.disabled = false;
  }
});

async function iniciar() {
  orgCtx = await getOrgContext();
  if (orgCtx.role !== 'dono') {
    window.location.replace('index.html');
    return;
  }
  document.getElementById('equipe-org-nome').textContent = `Equipe — ${orgCtx.orgNome || 'sua revenda'}`;
  const membrosRef = collection(db, 'organizations', orgCtx.orgId, 'members');
  const convitesRef = collection(db, 'organizations', orgCtx.orgId, 'convites');
  onSnapshot(membrosRef, snap => {
    membros = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.role === 'dono' ? -1 : 1) || (a.email || '').localeCompare(b.email || ''));
    renderMembros();
  }, erro => mostrarMsg(`Não foi possível carregar a equipe: ${erro.message}`, 'erro'));
  onSnapshot(convitesRef, snap => {
    convites = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(convite => convite.status === 'pendente').sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    renderConvites();
  }, erro => mostrarMsg(`Não foi possível carregar os convites: ${erro.message}`, 'erro'));
}

window.addEventListener('org-pronta', () => iniciar().catch(erro => mostrarMsg(erro.message, 'erro')), { once: true });
