import axios from 'axios';

// En tu compu (sin archivo .env) apunta a tu Django local.
// En Vercel defines VITE_API_URL con la URL real de tu backend en Railway,
// ej: https://tu-app.up.railway.app/api
const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const API = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Inyecta el token de la sesión en cada petición.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// Si el servidor dice que la sesión ya no vale (expiró), avisamos a la app
// para que cierre sesión y mande al usuario al inicio de sesión.
API.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const url = error.config?.url || '';
    const esAcceso = url.includes('/auth/login/') || url.includes('/auth/registro/') || url.includes('/auth/verificar/');
    if (error.response?.status === 401 && localStorage.getItem('token') && !esAcceso) {
      window.dispatchEvent(new Event('conalep:sesion-expirada'));
    }
    return Promise.reject(error);
  }
);

export default API;
