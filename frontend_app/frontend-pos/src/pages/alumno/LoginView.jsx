import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { codigoDeError, mensajeDeError } from '../../utils/errores';
import EscudoLogo from '../../components/EscudoLogo';
import Icono from '../../components/Icono';

export default function LoginView({ estado }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { iniciarSesion } = useAuth();
  const { notificar } = useToast();

  const [usuario, setUsuario] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState(null); // { tipo, texto }
  const [cargando, setCargando] = useState(false);

  const cerrado = estado && !estado.abierto;

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const datos = await authService.login(usuario.trim(), password);
      iniciarSesion(datos);
      notificar(datos.es_admin ? 'Bienvenido al panel de la cooperativa.' : `¡Hola, ${datos.nombre}!`, 'ok');
      navigate(datos.es_admin ? '/cocina/pedidos' : '/menu', { replace: true });
    } catch (err) {
      const codigo = codigoDeError(err);
      if (codigo === 'correo_no_verificado') {
        notificar('Primero verifica tu correo con el código que te enviamos.', 'aviso');
        navigate('/registro', { state: { verificar: true, email: err.response.data.email || usuario.trim() } });
      } else if (codigo === 'cerrado') {
        setError({ tipo: 'aviso', texto: mensajeDeError(err) });
      } else if (codigo === 'credenciales') {
        setError({ tipo: 'error', texto: 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.' });
      } else {
        setError({ tipo: 'error', texto: mensajeDeError(err, 'No pudimos iniciar sesión.') });
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centro-pantalla">
      <div className="tarjeta tarjeta-pad contenedor-angosto" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ background: 'var(--verde)', borderRadius: 16, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <EscudoLogo color="#fff" size={38} />
          </div>
          <h1 style={{ textAlign: 'center', marginBottom: 2 }}>Cafetería CONALEP</h1>
          <p style={{ color: 'var(--gris-500)', fontSize: '0.9rem', textAlign: 'center' }}>Inicia sesión para ver el menú</p>
        </div>

        {cerrado && (
          <div className="alerta alerta-aviso" style={{ marginBottom: 14 }}>
            <Icono nombre="reloj" tam={20} />
            <span>La cafetería está cerrada. Horario: {estado.horario}.</span>
          </div>
        )}

        {error && (
          <div className={`alerta alerta-${error.tipo}`} role="alert" style={{ marginBottom: 14 }}>
            <Icono nombre="alerta" tam={20} />
            <span>{error.texto}</span>
          </div>
        )}

        <form className="formulario" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="usuario">Correo institucional</label>
            <input
              id="usuario"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="tucorreo@hgo.conalep.edu.mx"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <div className="campo-con-boton">
              <input
                id="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                required
              />
              <button type="button" onClick={() => setVerPassword(!verPassword)} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Icono nombre={verPassword ? 'ojoTachado' : 'ojo'} tam={20} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando || !usuario.trim() || !password}>
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link to="/registro" style={{ fontWeight: 700 }}>¿No tienes cuenta? Regístrate</Link>
          <Link to="/privacidad" style={{ fontSize: '0.85rem', color: 'var(--gris-500)' }}>Aviso de privacidad</Link>
        </div>
      </div>
    </div>
  );
}
