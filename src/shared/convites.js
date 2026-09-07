// =============================================
//  convites.js — Convites pendentes de equipe
//
//  O dono grava um convite em
//  organizations/{orgId}/convites/{id}.
//  Quem ainda não tem loja busca os convites
//  do próprio email (collection group) e aceita.
// =============================================
import { db, auth } from './firebase.js';
import { limparContextoCache } from './tenant.js';
import {
  collection, collectionGroup, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, serverTimestamp
} from 'firebase/firestore';

export const CARGOS_CONVITE = ['vendedor', 'financeiro', 'viewer'];

export const CARGO_LABEL = {
  dono: 'Dono',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  viewer: 'Somente leitura',
};

export function emailConvite(email) {
  return (email || '').trim().toLowerCase();
}

function conviteDaQuery(d) {
  const orgId = d.ref.parent.parent.id;
  return { id: d.id, orgId, ref: d.ref, ...d.data() };
}

/** Convites pendentes do email logado (qualquer revenda). */
export async function buscarConvitesPendentes(email) {
  const emailKey = emailConvite(email);
  if (!emailKey) return [];

  const snap = await getDocs(query(
    collectionGroup(db, 'convites'),
    where('email', '==', emailKey),
    where('status', '==', 'pendente')
  ));

  return snap.docs.map(conviteDaQuery);
}

export async function criarConvite({ orgId, orgNome, email, role, criadoPor }) {
  const emailKey = emailConvite(email);
  const cargo = (role || '').trim();

  if (!emailKey || !emailKey.includes('@')) {
    throw new Error('Informe um email válido.');
  }
  if (!CARGOS_CONVITE.includes(cargo)) {
    throw new Error('Escolha um cargo: vendedor, financeiro ou somente leitura.');
  }

  const existentes = await getDocs(query(
    collection(db, 'organizations', orgId, 'convites'),
    where('email', '==', emailKey),
    where('status', '==', 'pendente')
  ));
  if (!existentes.empty) {
    throw new Error('Já existe um convite pendente para este email.');
  }

  await addDoc(collection(db, 'organizations', orgId, 'convites'), {
    email: emailKey,
    role: cargo,
    status: 'pendente',
    orgNome: orgNome || '',
    criadoPor,
    criadoEm: serverTimestamp(),
  });
}

export async function cancelarConvite(orgId, conviteId) {
  await deleteDoc(doc(db, 'organizations', orgId, 'convites', conviteId));
}

export async function aceitarConvite(convite) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');

  const emailKey = emailConvite(user.email);
  if (emailConvite(convite.email) !== emailKey) {
    throw new Error('Este convite é para outro email.');
  }
  if (convite.status !== 'pendente') {
    throw new Error('Este convite não está mais pendente.');
  }
  if (!CARGOS_CONVITE.includes(convite.role)) {
    throw new Error('Cargo do convite inválido.');
  }

  const orgId = convite.orgId;
  const orgSnap = await getDoc(doc(db, 'organizations', orgId));
  if (!orgSnap.exists()) {
    throw new Error('A revenda deste convite não existe mais.');
  }

  const membroRef = doc(db, 'organizations', orgId, 'members', user.uid);
  await setDoc(membroRef, {
    uid: user.uid,
    email: emailKey,
    role: convite.role,
    conviteId: convite.id,
    criadoEm: serverTimestamp(),
  });

  await setDoc(doc(db, 'users', user.uid), {
    orgId,
    role: convite.role,
    conviteId: convite.id,
  });

  await updateDoc(convite.ref, {
    status: 'aceito',
    aceitoPor: user.uid,
    aceitoEm: serverTimestamp(),
  });

  limparContextoCache();
}

export async function recusarConvite(convite) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');

  await updateDoc(convite.ref, {
    status: 'recusado',
    aceitoPor: user.uid,
    aceitoEm: serverTimestamp(),
  });
}
