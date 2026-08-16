// =============================================
//  cloudinary.js — Config e upload de fotos
// =============================================
export const CLOUDINARY_CLOUD  = 'x2xybz4b';
export const CLOUDINARY_PRESET = 'autoprime_upload'; // Unsigned preset

/** Faz upload de uma foto pro Cloudinary e retorna a URL permanente */
export async function uploadFoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'autoprime');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) throw new Error('Erro no upload da foto');
  const data = await res.json();
  return data.secure_url;
}
