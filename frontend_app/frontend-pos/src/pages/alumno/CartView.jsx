import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import pedidoService from '../../services/pedidoService';
import { mensajeDeError } from '../../utils/errores';
import Hoja from '../../components/Hoja';
import Icono from '../../components/Icono';
import theme from '../../theme';

const CartView = () => {
  const { carrito, restarCantidad, agregarAlCarrito, eliminarDelCarrito, montoTotal, limpiarCarrito } = useCart();
  const { sesion } = useAuth();
  const { notificar } = useToast();
  const navigate = useNavigate();

  const esDocente = sesion.rol === 'DOCENTE';
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [preguntarTicket, setPreguntarTicket] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  // Al pulsar "Pagar" primero se pregunta si quiere ticket; luego se envía el pedido.
  const enviarPedido = async (quiereTicket) => {
    setProcesando(true);
    setErrorServidor('');
    try {
      const pedido = await pedidoService.crearPedido(carrito, metodoPago, quiereTicket);
      setPreguntarTicket(false);
      limpiarCarrito();
      window.dispatchEvent(new Event('conalep:pedido-nuevo'));
      navigate('/pedido-enviado', { state: { pedido } });
    } catch (err) {
      setPreguntarTicket(false);
      const mensaje = mensajeDeError(err, 'No pudimos enviar tu pedido. Intenta de nuevo.');
      setErrorServidor(mensaje);
      notificar(mensaje, 'error');
    } finally {
      setProcesando(false);
    }
  };

  if (carrito.length === 0) {
    return (
      <div className="contenedor contenedor-angosto con-barra-inferior" style={{ textAlign: 'center', paddingTop: 70 }}>
        <div style={{ color: 'var(--gris-300)', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Icono nombre="bolsa" tam={56} grosor={1.5} />
        </div>
        <h2>Tu pedido está vacío</h2>
        <p style={{ color: theme.gris500, margin: '6px 0 18px' }}>Agrega productos desde el menú.</p>
        <button type="button" onClick={() => navigate('/menu')} className="btn btn-primario">Ver menú</button>
      </div>
    );
  }

  return (
    <div className="contenedor con-barra-inferior">
      <header style={{ marginBottom: 18 }}>
        <h1>Resumen de tu pedido</h1>
        <p style={{ color: theme.gris500, fontSize: '0.9rem' }}>Revisa tus artículos antes de enviarlos a la cocina.</p>
      </header>

      {errorServidor && (
        <div className="alerta alerta-error" role="alert" style={{ marginBottom: 14 }}>
          <Icono nombre="alerta" tam={20} /><span>{errorServidor}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        {carrito.map((item) => (
          <div key={item.id} className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: '0 0 3px' }}>{item.nombre}</h3>
              <span style={{ color: theme.verde, fontWeight: 600, fontSize: '0.85rem' }}>${item.precio} c/u</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={estilos.selector}>
                <button type="button" onClick={() => restarCantidad(item.id)} style={estilos.btnMenos} aria-label={`Quitar una pieza de ${item.nombre}`}>−</button>
                <span style={estilos.cantidad}>{item.cantidad}</span>
                <button
                  type="button"
                  onClick={() => agregarAlCarrito(item)}
                  disabled={!item.es_preparado && item.cantidad >= item.stock_disponible}
                  style={estilos.btnMas}
                  aria-label={`Agregar una pieza de ${item.nombre}`}
                >+</button>
              </div>
              <button type="button" onClick={() => eliminarDelCarrito(item.id)} className="btn btn-peligro-borde" style={{ minHeight: 38, padding: '0 10px' }} aria-label={`Quitar ${item.nombre}`}>
                <Icono nombre="basura" tam={17} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="tarjeta tarjeta-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700 }}>Total a pagar</span>
          <span style={{ color: theme.verde, fontSize: '1.5rem', fontWeight: 800 }}>${montoTotal.toFixed(2)} MXN</span>
        </div>

        <div className="campo" style={{ marginBottom: 18 }}>
          <label htmlFor="metodo">Método de pago</label>
          <select id="metodo" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
            <option value="EFECTIVO">Efectivo (se paga en caja)</option>
            {esDocente && <option value="TARJETA">Tarjeta (docentes)</option>}
          </select>
          <span className="texto-ayuda">
            {metodoPago === 'TARJETA'
              ? 'El cobro con tarjeta se confirma en caja al recoger tu pedido.'
              : 'Tu pedido queda pendiente hasta que pagues en caja.'}
          </span>
        </div>

        <button type="button" onClick={() => setPreguntarTicket(true)} disabled={procesando} className="btn btn-amarillo btn-bloque">
          {procesando ? 'Enviando…' : `Pagar $${montoTotal.toFixed(2)}`}
        </button>
      </div>

      {/* Pregunta de ticket: aparece al darle a pagar */}
      <Hoja abierta={preguntarTicket} onCerrar={() => !procesando && setPreguntarTicket(false)} titulo="¿Quieres ticket?" centrada>
        <p style={{ color: theme.gris500, fontSize: '0.92rem', marginBottom: 16 }}>
          El ticket lo imprime la cocina cuando pagues. Si no lo necesitas, ahorramos papel.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primario btn-bloque" disabled={procesando} onClick={() => enviarPedido(true)}>
            <Icono nombre="impresora" tam={18} /> Sí, quiero ticket
          </button>
          <button type="button" className="btn btn-borde btn-bloque" disabled={procesando} onClick={() => enviarPedido(false)}>
            No, gracias
          </button>
          <button type="button" className="btn btn-gris btn-bloque" disabled={procesando} onClick={() => setPreguntarTicket(false)}>
            Volver al pedido
          </button>
        </div>
      </Hoja>
    </div>
  );
};

const estilos = {
  selector: { display: 'flex', alignItems: 'center', border: `1px solid ${theme.verde}`, borderRadius: 10, overflow: 'hidden' },
  btnMenos: { width: 38, height: 38, backgroundColor: theme.gris100, border: 'none', fontWeight: 'bold', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnMas: { width: 38, height: 38, backgroundColor: theme.verdeClaro, color: theme.verde, border: 'none', fontWeight: 'bold', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cantidad: { minWidth: 30, textAlign: 'center', fontWeight: 'bold' },
};

export default CartView;
