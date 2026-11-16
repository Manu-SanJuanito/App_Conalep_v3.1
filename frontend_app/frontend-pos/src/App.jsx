import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Navbar from './components/Navbar';
import BarraInferior from './components/BarraInferior';
import AvisoPedidoListo from './components/AvisoPedidoListo';
import useEstadoCafeteria from './components/useEstadoCafeteria';
import CerradoView from './pages/alumno/CerradoView';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';

// Estructura de la app: barra superior, contenido, avisos y barra inferior (solo alumnos/docentes).
function Contenido() {
  const { sesion } = useAuth();
  const estado = useEstadoCafeteria();
  const [hayPedidoListo, setHayPedidoListo] = useState(false);

  const esUsuario = Boolean(sesion.token) && !sesion.esAdmin;
  const cerrado = estado && !estado.abierto;

  // Fuera de horario, alumnos y docentes ven la pantalla de "cerrado". El personal sí puede entrar.
  if (esUsuario && cerrado) {
    return (
      <>
        <Navbar />
        <main><CerradoView horario={estado.horario} /></main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      {esUsuario && <AvisoPedidoListo onCambio={setHayPedidoListo} />}
      <main>
        <AppRoutes estado={estado} />
      </main>
      {esUsuario && <BarraInferior hayPedidoListo={hayPedidoListo} />}
    </>
  );
}

function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Contenido />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
