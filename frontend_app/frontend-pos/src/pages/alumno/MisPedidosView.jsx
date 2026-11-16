import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import pedidoService from '../../services/pedidoService';
import { mensajeDeError } from '../../utils/errores';
import Icono from '../../components/Icono';

const ESTADOS = {
  PENDIENTE: { texto: 'En espera', fondo: 'var(--amarillo-claro)', color: '#92650a' },
  PREPARANDO: { texto: 'Preparando', fondo: 'var(--azul-claro)', color: 'var(--azul)' },
  LISTO: { texto: '¡Listo para recoger!', fondo: 'var(--verde-claro)', color: 'var(--verde-oscuro)' },
  ENTREGADO: { texto: 'Entregado', fondo: 'var(--gris-100)', color: 'var(--gris-500)' },
};
const METODOS = { EFECTIVO: 'Efectivo en caja', TARJETA: 'Tarjeta', LINEA: 'En línea' };

const folio = (id) => String(id).padStart(5, '0');

export default function MisPedidosView() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setPedidos(await pedidoService.misPedidos());
      setError('');
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cargar tus pedidos.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => { if (!document.hidden) cargar(); }, 20000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  return (
    <div className="contenedor con-barra-inferior">
      <header style={{ marginBottom: 16 }}>
        <h1>Mis pedidos</h1>
        <p style={{ color: 'var(--gris-500)', fontSize: '0.9rem' }}>Se actualizan solos. Tus pedidos se borran a los 15 días.</p>
      </header>

      {error && <div className="alerta alerta-error" role="alert" style={{ marginBottom: 12 }}><Icono nombre="alerta" tam={20} /><span>{error}</span></div>}
      {cargando && <p style={{ textAlign: 'center', color: 'var(--gris-500)' }}>Cargando…</p>}

      {!cargando && pedidos.length === 0 && !error && (
        <div className="tarjeta tarjeta-pad" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 14 }}>Todavía no has hecho pedidos.</p>
          <Link to="/menu" className="btn btn-primario">Ver el menú</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pedidos.map((pedido) => {
          const estado = ESTADOS[pedido.estado] || ESTADOS.PENDIENTE;
          const activo = pedido.estado !== 'ENTREGADO';
          return (
            <article key={pedido.id} className="tarjeta" style={{ padding: 16, borderLeft: `5px solid ${estado.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <strong style={{ fontSize: '1.1rem' }}>Folio #{folio(pedido.id)}</strong>
                <span style={{ background: estado.fondo, color: estado.color, padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800 }}>
                  {estado.texto}
                </span>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.92rem', color: 'var(--gris-700)' }}>
                {pedido.detalles?.map((d, i) => (
                  <li key={i}><strong style={{ color: 'var(--verde)' }}>{d.cantidad}×</strong> {d.producto_nombre}</li>
                ))}
              </ul>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gris-300)', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--gris-500)' }}>
                  {METODOS[pedido.metodo_pago] || pedido.metodo_pago} · {new Date(pedido.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <strong>${Number(pedido.total).toFixed(2)}</strong>
              </div>

              {activo && (
                <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--gris-700)' }}>
                  Al recogerlo, di tu folio y tu código: <strong style={{ letterSpacing: 2 }}>{pedido.codigo_recogida}</strong>
                  {pedido.quiere_ticket && ' · Pediste ticket: te lo da la cocina al pagar.'}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
