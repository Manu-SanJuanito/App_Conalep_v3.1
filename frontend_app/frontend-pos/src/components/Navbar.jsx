import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import EscudoLogo from './EscudoLogo';
import Icono from './Icono';

const ENLACES_COCINA = [
  { a: '/cocina/pedidos', texto: 'Pedidos' },
  { a: '/cocina/productos/nuevo', texto: 'Nuevo producto' },
  { a: '/cocina/fotos', texto: 'Fotos' },
  { a: '/cocina/almacen', texto: 'Lotes' },
  { a: '/cocina/alertas', texto: 'Alertas de stock' },
  { a: '/cocina/cierre', texto: 'Cierre de caja' },
];

const Navbar = () => {
  const { sesion, cerrarSesion } = useAuth();
  const { notificar } = useToast();
  const navigate = useNavigate();
  const { token, esAdmin } = sesion;

  const salir = async () => {
    await cerrarSesion();
    notificar('Sesión cerrada. ¡Vuelve pronto!', 'ok');
    navigate('/login');
  };

  return (
    <nav className={`nav ${esAdmin ? 'nav-admin' : ''}`}>
      <div className="nav-fila">
        <Link to={token ? (esAdmin ? '/cocina/pedidos' : '/menu') : '/login'} className="nav-marca">
          <EscudoLogo color="#ffffff" size={30} />
          <span>{esAdmin ? 'Panel Administrativo' : 'Cafetería CONALEP'}</span>
        </Link>

        {token && (
          <div className="nav-acciones">
            <Link to="/perfil" className="nav-icono" aria-label="Mi cuenta" title="Mi cuenta">
              <Icono nombre="usuario" tam={20} />
            </Link>
            <button type="button" className="nav-icono" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icono nombre="salir" tam={20} />
            </button>
          </div>
        )}
      </div>

      {token && esAdmin && (
        <div className="nav-enlaces">
          {ENLACES_COCINA.map((enlace) => (
            <NavLink key={enlace.a} to={enlace.a} className={({ isActive }) => (isActive ? 'activo' : '')}>
              {enlace.texto}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
