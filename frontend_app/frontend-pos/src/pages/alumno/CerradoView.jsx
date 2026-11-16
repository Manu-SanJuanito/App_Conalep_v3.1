import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icono from '../../components/Icono';

export default function CerradoView({ horario }) {
  const { cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const salir = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="centro-pantalla">
      <div className="tarjeta tarjeta-pad contenedor-angosto" style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'var(--verde)' }}>
          <Icono nombre="reloj" tam={52} grosor={1.6} />
        </div>
        <h1>La cafetería está cerrada</h1>
        <p style={{ color: 'var(--gris-500)', margin: '8px 0 20px' }}>
          Vuelve en nuestro horario de servicio:
        </p>
        <p style={{ fontWeight: 800, color: 'var(--verde-oscuro)', fontSize: '1.1rem', marginBottom: 24 }}>
          {horario || 'lunes a viernes de 07:00 a 18:00'}
        </p>
        <button type="button" className="btn btn-borde btn-bloque" onClick={salir}>
          <Icono nombre="salir" tam={18} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
