// Convierte los errores del servidor (Django REST) en mensajes claros en español.

const NOMBRES_CAMPOS = {
  nombre: 'Nombre',
  email: 'Correo',
  password: 'Contraseña',
  password_confirmacion: 'Confirmación de contraseña',
  password_actual: 'Contraseña actual',
  password_nueva: 'Contraseña nueva',
  codigo_docente: 'Código de docente',
  acepto_privacidad: 'Aviso de privacidad',
  matricula: 'Matrícula',
  stock: 'Disponibilidad',
  metodo_pago: 'Método de pago',
  detalles: 'Pedido',
};

const aTexto = (valor) => {
  if (Array.isArray(valor)) return valor.map(aTexto).join(' ');
  if (valor && typeof valor === 'object') return Object.values(valor).map(aTexto).join(' ');
  return String(valor ?? '');
};

/** Texto único para mostrar en un aviso. */
export function mensajeDeError(err, porDefecto = 'Algo salió mal. Intenta de nuevo.') {
  if (!err) return porDefecto;
  if (!err.response) {
    return 'No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.';
  }
  const { status, data } = err.response;
  if (status === 429) return 'Demasiados intentos. Espera un rato antes de intentar otra vez.';
  if (status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en un momento.';
  if (typeof data === 'string') return data.includes('<') ? porDefecto : data;
  if (data?.detail) return aTexto(data.detail);
  if (data?.error) return aTexto(data.error);
  if (data && typeof data === 'object') {
    const partes = Object.entries(data).map(([campo, valor]) => {
      const nombre = NOMBRES_CAMPOS[campo];
      return nombre && campo !== 'stock' ? `${nombre}: ${aTexto(valor)}` : aTexto(valor);
    });
    if (partes.length) return partes.join(' ');
  }
  return porDefecto;
}

/** Errores por campo, para mostrarlos debajo de cada casilla. */
export function erroresPorCampo(err) {
  const data = err?.response?.data;
  const resultado = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(data).forEach(([campo, valor]) => {
      if (campo !== 'detail' && campo !== 'codigo') resultado[campo] = aTexto(valor);
    });
  }
  return resultado;
}

export const codigoDeError = (err) => err?.response?.data?.codigo || null;
