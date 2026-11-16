import API from './api';

const authService = {
  login: async (usuario, password) => (await API.post('/auth/login/', { username: usuario, password })).data,

  registro: async (datos) => (await API.post('/auth/registro/', datos)).data,

  verificarCorreo: async (email, codigo) => (await API.post('/auth/verificar/', { email, codigo })).data,

  reenviarCodigo: async (email) => (await API.post('/auth/reenviar-codigo/', { email })).data,

  logout: async () => (await API.post('/auth/logout/')).data,

  obtenerPerfil: async () => (await API.get('/auth/perfil/')).data,

  actualizarPerfil: async (cambios) => (await API.patch('/auth/perfil/', cambios)).data,

  borrarCuenta: async (password) => (await API.delete('/auth/perfil/', { data: { password } })).data,

  estadoCafeteria: async () => (await API.get('/estado/')).data,
};

export default authService;
