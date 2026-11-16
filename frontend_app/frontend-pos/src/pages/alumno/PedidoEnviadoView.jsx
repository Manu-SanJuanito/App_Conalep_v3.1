import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Icono from '../../components/Icono';

const folio = (id) => String(id).padStart(5, '0');

export default function PedidoEnviadoView() {
  const location = useLocation();
  const pedido = location.state?.pedido;
  const [permiso, setPermiso] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  if (!pedido) return <Navigate to="/mis-pedidos" replace />;

  const activarAvisos = async () => {
    try { setPermiso(await Notification.requestPermission()); } catch { setPermiso('denied'); }
  };

  return (
    <div className="contenedor contenedor-angosto con-barra-inferior">
      <div className="tarjeta tarjeta-pad" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--verde-claro)', color: 'var(--verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Icono nombre="check" tam={34} grosor={2.6} />
        </div>
        <h1>¡Pedido enviado!</h1>
        <p style={{ color: 'var(--gris-500)', marginBottom: 18 }}>La cocina ya lo recibió. Te avisaremos aquí cuando esté listo.</p>

        <div style={{ background: 'var(--gris-100)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--gris-500)', fontWeight: 700, letterSpacing: 1 }}>TU FOLIO</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--verde)' }}>#{folio(pedido.id)}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--gris-500)', fontWeight: 700, letterSpacing: 1, marginTop: 8 }}>CÓDIGO DE RECOGIDA</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: 4 }}>{pedido.codigo_recogida}</p>
        </div>

        <p style={{ fontSize: '0.92rem', marginBottom: 6 }}>
          Paga <strong>${Number(pedido.total).toFixed(2)}</strong> en caja ({pedido.metodo_pago === 'TARJETA' ? 'con tarjeta' : 'en efectivo'}) y muestra tu folio y código.
        </p>
        {pedido.quiere_ticket && (
          <p style={{ fontSize: '0.88rem', color: 'var(--gris-700)', marginBottom: 6 }}>
            Pediste ticket: la cocina te lo entregará cuando pagues.
          </p>
        )}

        {permiso === 'default' && (
          <button type="button" className="btn btn-gris btn-bloque" style={{ marginTop: 12 }} onClick={activarAvisos}>
            <Icono nombre="campana" tam={18} /> Avisarme también con notificaciones
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <Link to="/mis-pedidos" className="btn btn-primario btn-bloque">Ver mis pedidos</Link>
          <Link to="/menu" className="btn btn-borde btn-bloque">Seguir pidiendo</Link>
        </div>
      </div>
    </div>
  );
}
