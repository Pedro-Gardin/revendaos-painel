// =============================================
//  auth-guard.js — Proteção do painel
//  1) Confere se está logado (senão -> login.html)
//  2) Confere se pertence a uma organization
//     (senão -> onboarding.html, pra criar a revenda)
//
//  Importante: só redireciona pro onboarding quando
//  temos CERTEZA de que o usuário não tem organization
//  (SemOrganizationError). Qualquer outro erro (rede
//  lenta, token do Firebase ainda propagando logo após
//  o login) só tenta de novo, sem chutar o usuário pra
//  tela errada.
// =============================================
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getOrgContext, SemOrganizationError, limparContextoCache } from './tenant.js';

let redirecionouLogin = false;
let tentativas = 0;
const MAX_TENTATIVAS = 3;

const PAGINAS_SEM_CHECAGEM_ORG = ['onboarding.html', 'migrar.html'];

function paginaAtual() {
  return window.location.pathname.split('/').pop();
}

async function checarOrganization() {
  try {
    await getOrgContext();
    // Sucesso — avisa o resto da página (main.js) que já pode
    // seguir em frente, em vez de cada arquivo checar por conta própria
    window.dispatchEvent(new CustomEvent('org-pronta'));
  } catch (e) {
    if (e instanceof SemOrganizationError) {
      // Certeza: não existe organization pra esse usuário
      window.location.replace('onboarding.html');
      return;
    }

    // Erro incerto (rede, timing, permissão temporária) —
    // tenta de novo em vez de assumir que não tem organization
    tentativas++;
    console.warn(`Falha ao carregar contexto da organization (tentativa ${tentativas}):`, e.message);
    if (tentativas < MAX_TENTATIVAS) {
      limparContextoCache();
      setTimeout(checarOrganization, 800);
    } else {
      console.error('Não foi possível carregar a organization após várias tentativas.', e);
    }
  }
}

onAuthStateChanged(auth, user => {
  if (!user) {
    if (!redirecionouLogin) {
      redirecionouLogin = true;
      window.location.replace('login.html');
    }
    return;
  }

  const emailEl = document.getElementById('usuario-email');
  if (emailEl) emailEl.textContent = user.email;

  if (PAGINAS_SEM_CHECAGEM_ORG.includes(paginaAtual())) return;

  checarOrganization();
});

window.sair = function() {
  if (!confirm('Deseja sair do painel?')) return;
  signOut(auth).then(() => {
    window.location.replace('login.html');
  });
};
