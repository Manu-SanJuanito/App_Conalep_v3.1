import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

const leerSesion = () => ({
  token: localStorage.getItem('token') || null,
  esAdmin: localStorage.getItem('esAdmin') === 'true',
  nombre: localStorage.getItem('nombre') || '',
  rol: localStorage.getItem('rol') || '',
  cookies: localStorage.getItem('cookies') === 'true',
});

const limpiarSesion = () => {
  ['token', 'esAdmin', 'nombre', 'rol', 'cookies', 'conalep_cart', 'conalep_avisados'].forEach((k) => localStorage.removeItem(k));
};

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const { notificar } = useToast();

  // Guarda la sesión que devuelve el login del servidor.
  const iniciarSesion = useCallback((datos) => {
    localStorage.setItem('token', datos.token);
    localStorage.setItem('esAdmin', datos.es_admin ? 'true' : 'false');
    localStorage.setItem('nombre', datos.nombre || '');
    localStorage.setItem('rol', datos.rol || '');
    localStorage.setItem('cookies', datos.acepto_cookies ? 'true' : 'false');
    setSesion(leerSesion());
  }, []);

  const actualizarDatos = useCallback((cambios) => {
    if (cambios.nombre !== undefined) localStorage.setItem('nombre', cambios.nombre);
    if (cambios.cookies !== undefined) localStorage.setItem('cookies', cambios.cookies ? 'true' : 'false');
    setSesion(leerSesion());
  }, []);

  // Cierra sesión en el servidor (borra el token allá) y limpia este dispositivo.
  const cerrarSesion = useCallback(async () => {
    try {
      if (localStorage.getItem('token')) await authService.logout();
    } catch {
      // Si falla (sin internet, token vencido) igual limpiamos este dispositivo.
    }
    limpiarSesion();
    setSesion(leerSesion());
  }, []);

  // El interceptor de Axios avisa cuando el servidor rechaza el token (sesión vencida).
  useEffect(() => {
    const alExpirar = () => {
      limpiarSesion();
      setSesion(leerSesion());
      notificar('Tu sesión expiró. Inicia sesión de nuevo.', 'aviso');
    };
    window.addEventListener('conalep:sesion-expirada', alExpirar);
    return () => window.removeEventListener('conalep:sesion-expirada', alExpirar);
  }, [notificar]);

  const valor = useMemo(
    () => ({ sesion, iniciarSesion, cerrarSesion, actualizarDatos }),
    [sesion, iniciarSesion, cerrarSesion, actualizarDatos]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
