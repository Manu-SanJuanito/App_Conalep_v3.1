import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import Icono from './Icono';

// Barra de navegación inferior para alumnos y docentes.
// Menú · Categorías · Buscar · Mi pedido · Mis pedidos
const BarraInferior = ({ hayPedidoListo }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalArticulos } = useCart();

  const enMenu = location.pathname === '/menu';
  const params = new URLSearchParams(location.search);
  const filtrando = enMenu && params.has('cat');

  const ir = (consulta) => navigate(`/menu${consulta}`);

  return (
    <nav className="barra-inferior" aria-label="Navegación principal">
      <div className="barra-inferior-fila">
        <button type="button" className={`bi-item ${enMenu && !filtrando ? 'activo' : ''}`} onClick={() => ir('')}>
          <Icono nombre="inicio" tam={24} />
          Menú
        </button>

        <button type="button" className={`bi-item ${filtrando ? 'activo' : ''}`} onClick={() => ir('?categorias=1')}>
          <Icono nombre="categorias" tam={24} />
          Categorías
        </button>

        <button type="button" className="bi-item" onClick={() => ir('?buscar=1')}>
          <Icono nombre="buscar" tam={24} />
          Buscar
        </button>

        <NavLink to="/carrito" className={({ isActive }) => `bi-item ${isActive ? 'activo' : ''}`}>
          <Icono nombre="bolsa" tam={24} />
          Mi pedido
          {totalArticulos > 0 && <span className="bi-insignia">{totalArticulos}</span>}
        </NavLink>

        <NavLink to="/mis-pedidos" className={({ isActive }) => `bi-item ${isActive ? 'activo' : ''}`}>
          <Icono nombre="pedidos" tam={24} />
          Pedidos
          {hayPedidoListo && <span className="bi-punto" aria-label="Tienes un pedido listo" />}
        </NavLink>
      </div>
    </nav>
  );
};

export default BarraInferior;
