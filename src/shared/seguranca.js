// =============================================
//  seguranca.js — Proteção contra XSS
//  Use esc() em qualquer dado que vem do usuário
//  ou do banco antes de colocar no innerHTML.
//
//  Agora é um módulo ES: quem precisa, importa.
//  Isso elimina o bug de path relativo/404 que
//  quebrava o site quando o arquivo não carregava.
// =============================================

/** Escapa texto para uso seguro dentro de HTML */
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa valor para atributos HTML (onclick, value, etc.) */
export function escAttr(str) {
  return esc(str);
}

/** Permite só URLs http/https em src/href */
export function escUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '';
}
