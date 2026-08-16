// =============================================
//  migrar.js — Copia os dados da estrutura ANTIGA
//  (coleções na raiz) pra dentro de uma organization
//  nova, sem apagar os dados originais.
//
//  Rode isso só UMA VEZ, com as regras do Firestore
//  ainda no modelo ANTIGO (antes de publicar o
//  firestore.rules multi-tenant). Depois de migrar e
//  conferir que está tudo certo, aí sim publique as
//  novas regras.
// =============================================
import { db, auth } from '../shared/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, getDocs, doc, setDoc, serverTimestamp
} from 'firebase/firestore';

const COLECOES = ['carros', 'financeiro', 'gastos', 'metas', 'vendedores', 'comissoes', 'crm'];

let usuarioAtual = null;

onAuthStateChanged(auth, user => {
  if (!user) { window.location.replace('login.html'); return; }
  usuarioAtual = user;
  document.getElementById('mig-email').textContent = user.email;
});

function log(msg, tipo) {
  const el = document.getElementById('mig-log');
  const linha = document.createElement('div');
  linha.textContent = msg;
  linha.style.color = tipo === 'erro' ? '#fca5a5' : tipo === 'ok' ? '#86efac' : '#a1a1aa';
  el.appendChild(linha);
  el.scrollTop = el.scrollHeight;
}

async function migrar() {
  const nome = document.getElementById('mig-nome').value.trim();
  const slug = document.getElementById('mig-slug').value.trim();

  if (!nome || !slug) { log('Preencha nome e slug da revenda.', 'erro'); return; }
  if (!usuarioAtual) { log('Sessão expirada. Faça login novamente.', 'erro'); return; }

  const btn = document.getElementById('mig-btn');
  btn.disabled = true;
  document.getElementById('mig-log').innerHTML = '';

  try {
    log(`Criando organization "${slug}"...`);
    const orgRef = doc(db, 'organizations', slug);
    await setDoc(orgRef, {
      nome, slug, plano: 'gratis',
      criadoEm: serverTimestamp(), criadoPor: usuarioAtual.uid,
    });

    log('Criando você como dono da revenda...');
    await setDoc(doc(db, 'organizations', slug, 'members', usuarioAtual.uid), {
      uid: usuarioAtual.uid, email: usuarioAtual.email,
      role: 'dono', criadoEm: serverTimestamp(),
    });
    await setDoc(doc(db, 'users', usuarioAtual.uid), { orgId: slug, role: 'dono' });

    let totalMigrado = 0;

    for (const nomeColecao of COLECOES) {
      log(`Lendo coleção antiga "${nomeColecao}"...`);
      const snap = await getDocs(collection(db, nomeColecao));

      if (snap.empty) {
        log(`  → vazia, nada pra migrar.`);
        continue;
      }

      let count = 0;
      for (const d of snap.docs) {
        await setDoc(doc(db, 'organizations', slug, nomeColecao, d.id), d.data());
        count++;
      }
      totalMigrado += count;
      log(`  → ${count} documento(s) copiado(s) para organizations/${slug}/${nomeColecao}`, 'ok');
    }

    log(`\nMigração concluída! ${totalMigrado} documento(s) no total.`, 'ok');
    log('Os dados ANTIGOS continuam intactos na raiz (não foram apagados).');
    log('\nPróximos passos:', 'ok');
    log('1. Confira os dados no Firebase Console dentro de organizations/' + slug);
    log('2. Só depois de conferir, publique o novo firestore.rules');
    log('3. Depois disso, pode apagar as coleções antigas da raiz manualmente, se quiser');

    btn.innerHTML = '<i class="ti ti-check"></i> Migração concluída';
  } catch (e) {
    log('Erro: ' + e.message, 'erro');
    btn.disabled = false;
  }
}

window.migrar = migrar;
