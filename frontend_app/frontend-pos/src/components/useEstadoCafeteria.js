import { useEffect, useState } from 'react';
import authService from '../services/authService';

// Pregunta al servidor si la cafetería está abierta y lo revisa cada minuto.
export default function useEstadoCafeteria() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      try {
        const datos = await authService.estadoCafeteria();
        if (activo) setEstado(datos);
      } catch {
        // Si no hay conexión no bloqueamos nada; el servidor igual valida.
      }
    };
    consultar();
    const intervalo = setInterval(consultar, 60000);
    return () => { activo = false; clearInterval(intervalo); };
  }, []);

  return estado;
}
