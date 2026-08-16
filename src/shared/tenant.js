// =============================================
//  tenant.js — Contexto multi-tenant
//
//  Descobre a qual ORGANIZATION o usuário logado
//  pertence e qual o ROLE dele lá, através de um
//  atalho simples: users/{uid} -> { orgId, role }
//
//  (Antes isso era feito com uma busca collectionGroup
//  em "members", mas o Firestore não permite esse tipo
//  de consulta combinada com regras que usam exists() —
//  por isso o atalho direto em users/{uid}.)
// =============================================
import { db, auth } from './firebase.js';
import { collection, doc, getDoc } from 'firebase/firestore';

let contextoCache = null; // { orgId, orgSlug, orgNome, role, uid }

// Erro específico: usuário logado mas sem organization vinculada.
// Usado pro auth-guard saber diferenciar isso de uma falha
// passageira (rede lenta, token ainda propagando etc.)
export class SemOrganizationError extends Error {}

export async function getOrgContext() {
  if (contextoCache) return contextoCache;

  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');

  const userSnap = await getDoc(doc(db, 'users', user.uid));
  console.log('[DIAGNÓSTICO] uid buscado:', user.uid);
  console.log('[DIAGNÓSTICO] documento existe?', userSnap.exists());
  console.log('[DIAGNÓSTICO] dados do documento:', userSnap.data());

  if (!userSnap.exists()) {
    throw new SemOrganizationError('Usuário não está vinculado a nenhuma revenda (organization).');
  }

  const { orgId, role } = userSnap.data();
  console.log('[DIAGNÓSTICO] orgId extraído:', orgId, '| role extraído:', role);

  const orgSnap = await getDoc(doc(db, 'organizations', orgId));
  const orgData = orgSnap.data() || {};

  contextoCache = {
    orgId,
    orgSlug: orgData.slug || orgId,
    orgNome: orgData.nome || '',
    role,
    uid: user.uid,
  };
  return contextoCache;
}

export function limparContextoCache() {
  contextoCache = null;
}

export async function orgCollection(nome) {
  const { orgId } = await getOrgContext();
  return collection(db, 'organizations', orgId, nome);
}

export async function orgDoc(nome, id) {
  const { orgId } = await getOrgContext();
  return doc(db, 'organizations', orgId, nome, id);
}

export function podeEditar(role, area) {
  const regras = {
    carros:     ['dono','vendedor','financeiro'],
    financeiro: ['dono','financeiro'],
    crm:        ['dono','vendedor'],
    membros:    ['dono'],
  };
  return (regras[area] || []).includes(role);
}
