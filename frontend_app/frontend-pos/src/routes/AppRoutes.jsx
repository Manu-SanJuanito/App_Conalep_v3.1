import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import LoginView from '../pages/alumno/LoginView';
import RegistroView from '../pages/alumno/RegistroView';
import PrivacidadView from '../pages/public/PrivacidadView';
import MenuView from '../pages/public/MenuView';
import CartView from '../pages/alumno/CartView';
import PedidoEnviadoView from '../pages/alumno/PedidoEnviadoView';
import MisPedidosView from '../pages/alumno/MisPedidosView';
import PerfilView from '../pages/alumno/PerfilView';
import TicketCocinaView from '../pages/cocina/TicketCocinaView';
import GestionPedidosView from '../pages/cocina/GestionPedidosView';
import CrearProductoView from '../pages/cocina/CrearProductoView';
import RegistrarLoteView from '../pages/cocina/RegistrarLoteView';
import AlertasStockView from '../pages/cocina/AlertasStockView';
import CierreCajaView from '../pages/cocina/CierreCajaView';
import ImagenesProductosView from '../pages/cocina/ImagenesProductosView';

const inicioSegunRol = (sesion) => (sesion.esAdmin ? '/cocina/pedidos' : '/menu');

// Pantallas para quien NO ha iniciado sesión (login y registro).
function SoloVisitantes({ children }) {
  const { sesion } = useAuth();
  if (sesion.token) return <Navigate to={inicioSegunRol(sesion)} replace />;
  return children;
}

// Cualquier cuenta con sesión.
function ConSesion({ children }) {
  const { sesion } = useAuth();
  const location = useLocation();
  if (!sesion.token) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  return children;
}

// Solo alumnos y docentes (el personal va a su panel).
function SoloUsuarios({ children }) {
  const { sesion } = useAuth();
  if (!sesion.token) return <Navigate to="/login" replace />;
  if (sesion.esAdmin) return <Navigate to="/cocina/pedidos" replace />;
  return children;
}

// Solo personal de cocina / caja.
function SoloPersonal({ children }) {
  const { sesion } = useAuth();
  if (!sesion.token) return <Navigate to="/login" replace />;
  if (!sesion.esAdmin) return <Navigate to="/menu" replace />;
  return children;
}

function Inicio() {
  const { sesion } = useAuth();
  return <Navigate to={sesion.token ? inicioSegunRol(sesion) : '/login'} replace />;
}

const AppRoutes = ({ estado }) => (
  <Routes>
    {/* Lo primero que se ve al abrir el link es el inicio de sesión */}
    <Route path="/" element={<Inicio />} />
    <Route path="/login" element={<SoloVisitantes><LoginView estado={estado} /></SoloVisitantes>} />
    <Route path="/registro" element={<SoloVisitantes><RegistroView /></SoloVisitantes>} />
    <Route path="/privacidad" element={<PrivacidadView />} />

    {/* Alumnos y docentes */}
    <Route path="/menu" element={<SoloUsuarios><MenuView /></SoloUsuarios>} />
    <Route path="/carrito" element={<SoloUsuarios><CartView /></SoloUsuarios>} />
    <Route path="/pedido-enviado" element={<SoloUsuarios><PedidoEnviadoView /></SoloUsuarios>} />
    <Route path="/mis-pedidos" element={<SoloUsuarios><MisPedidosView /></SoloUsuarios>} />
    <Route path="/perfil" element={<ConSesion><PerfilView /></ConSesion>} />

    {/* Cocina / caja: el ticket solo lo emite el personal */}
    <Route path="/cocina/pedidos" element={<SoloPersonal><GestionPedidosView /></SoloPersonal>} />
    <Route path="/cocina/ticket" element={<SoloPersonal><TicketCocinaView /></SoloPersonal>} />
    <Route path="/cocina/productos/nuevo" element={<SoloPersonal><CrearProductoView /></SoloPersonal>} />
    <Route path="/cocina/fotos" element={<SoloPersonal><ImagenesProductosView /></SoloPersonal>} />
    <Route path="/cocina/almacen" element={<SoloPersonal><RegistrarLoteView /></SoloPersonal>} />
    <Route path="/cocina/alertas" element={<SoloPersonal><AlertasStockView /></SoloPersonal>} />
    <Route path="/cocina/cierre" element={<SoloPersonal><CierreCajaView /></SoloPersonal>} />

    <Route path="*" element={<Inicio />} />
  </Routes>
);

export default AppRoutes;
