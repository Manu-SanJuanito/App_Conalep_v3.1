import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import pedidoService from '../services/pedidoService';
import { useToast } from '../contexts/ToastContext';
import Icono from './Icono';

const CADA_MS = 20000;

const folio = (id) => String(id).padStart(5, '0');

const leerAvisados = () => {
  try { return JSON.parse(localStorage.getItem('conalep_avisados') || '[]'); } catch { return []; }
};

// Avisa al alumno cuando su pedido pasa a "Listo". Solo consulta mientras tenga pedidos activos.
export default function AvisoPedidoListo({ onCambio }) {
  const { notificar } = useToast();
  const [listos, setListos] = useState([]);
  const [hayActivos, setHayActivos] = useState(true); // la primera vez siempre se consulta
  const avisados = useRef(leerAvisados());

  const emitirAviso = useCallback((pedido) => {
    notificar(`¡Tu pedido #${folio(pedido.id)} está listo! Pasa a recogerlo a caja.`, 'ok', { duracion: 15000 });
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch { /* sin vibración */ }
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Cafetería CONALEP', { body: `Tu pedido #${folio(pedido.id)} está listo para recoger.` });
      }
    } catch { /* el navegador no permite notificaciones aquí */ }
  }, [notificar]);

  const consultar = useCallback(async () => {
    try {
      const activos = await pedidoService.pedidosActivos();
      const listosAhora = activos.filter((p) => p.estado === 'LISTO');
      setListos(listosAhora);
      onCambio?.(listosAhora.length > 0);
      setHayActivos(activos.length > 0);

      listosAhora.forEach((pedido) => {
        if (!avisados.current.includes(pedido.id)) {
          avisados.current = [...avisados.current.slice(-30), pedido.id];
          localStorage.setItem('conalep_avisados', JSON.stringify(avisados.current));
          emitirAviso(pedido);
        }
      });
    } catch {
      // Sin conexión o cafetería cerrada: se reintenta en el siguiente ciclo.
    }
  }, [emitirAviso, onCambio]);

  // Primera consulta y cada vez que se hace un pedido nuevo.
  useEffect(() => {
    consultar();
    const alNuevoPedido = () => { setHayActivos(true); consultar(); };
    window.addEventListener('conalep:pedido-nuevo', alNuevoPedido);
    return () => window.removeEventListener('conalep:pedido-nuevo', alNuevoPedido);
  }, [consultar]);

  // Mientras haya pedidos en curso, consulta cada 20 s (solo con la pestaña visible).
  useEffect(() => {
    if (!hayActivos) return undefined;
    const intervalo = setInterval(() => { if (!document.hidden) consultar(); }, CADA_MS);
    const alVolver = () => { if (!document.hidden) consultar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(intervalo); document.removeEventListener('visibilitychange', alVolver); };
  }, [hayActivos, consultar]);

  if (listos.length === 0) return null;

  return (
    <div className="banner-listo" role="alert">
      <Icono nombre="campana" tam={20} />
      <span>
        {listos.length === 1
          ? `Tu pedido #${folio(listos[0].id)} está listo para recoger.`
          : `Tienes ${listos.length} pedidos listos para recoger.`}{' '}
        <Link to="/mis-pedidos">Ver</Link>
      </span>
    </div>
  );
}
