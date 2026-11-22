// Utilidades para las fotos de los productos (se alojan en Cloudinary).

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD;
const PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;
const TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 10;

/** Pide a Cloudinary una versión liviana y recortada (mejor para celulares con poco internet). */
export function optimizarImagen(url, ancho = 200) {
  if (url && url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${ancho},h_${ancho},c_fill/`);
  }
  return url;
}

/** Reduce la foto antes de subirla (las fotos del celular pesan varios MB). */
async function reducirImagen(archivo, maximo = 900, calidad = 0.82) {
  if (typeof createImageBitmap !== 'function') return archivo;
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      calidad
    );
  });
}

/** Sube la foto a Cloudinary y devuelve su dirección https. Lanza Error con un mensaje claro. */
export async function subirACloudinary(archivo) {
  if (!CLOUD || !PRESET) {
    throw new Error('Falta configurar Cloudinary (VITE_CLOUDINARY_CLOUD y VITE_CLOUDINARY_PRESET en Vercel).');
  }
  if (!TIPOS_VALIDOS.includes(archivo.type)) {
    throw new Error('Usa una foto JPG, PNG o WEBP.');
  }
  if (archivo.size > MAX_MB * 1024 * 1024) {
    throw new Error(`La foto pesa más de ${MAX_MB} MB. Elige una más ligera.`);
  }

  let contenido;
  try {
    contenido = await reducirImagen(archivo);
  } catch {
    contenido = archivo;
  }

  const datos = new FormData();
  datos.append('file', contenido, 'producto.jpg');
  datos.append('upload_preset', PRESET);

  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 30000);
  try {
    const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: 'POST',
      body: datos,
      signal: control.signal,
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !json.secure_url) {
      throw new Error(json.error?.message ? `Cloudinary: ${json.error.message}` : 'No se pudo subir la foto.');
    }
    return json.secure_url;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('La subida tardó demasiado. Revisa tu internet e intenta de nuevo.');
    if (err instanceof TypeError) throw new Error('No hay conexión para subir la foto. Intenta de nuevo.');
    throw err;
  } finally {
    clearTimeout(limite);
  }
}
