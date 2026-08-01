// =============================================
//  seguranca.js — Proteção contra XSS
//  Use esc() em qualquer dado que vem do usuário
//  ou do banco antes de colocar no innerHTML.
// =============================================

/** Escapa texto para uso seguro dentro de HTML */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa valor para atributos HTML (onclick, value, etc.) */
function escAttr(str) {
  return esc(str);
}

/** Permite só URLs http/https em src/href */
function escUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '';
}
