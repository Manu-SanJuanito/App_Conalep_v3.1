import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { erroresPorCampo, mensajeDeError } from '../../utils/errores';
import Hoja from '../../components/Hoja';
import Icono from '../../components/Icono';

const ETIQUETA_ROL = { ALUMNO: 'Alumno', DOCENTE: 'Docente', ADMIN: 'Personal de cocina' };

const Campo = ({ id, etiqueta, error, ayuda, children }) => (
  <div className={`campo ${error ? 'campo-error' : ''}`}>
    <label htmlFor={id}>{etiqueta}</label>
    {children}
    {error ? <span className="texto-error" role="alert">{error}</span> : ayuda && <span className="texto-ayuda">{ayuda}</span>}
  </div>
);

export default function PerfilView() {
  const navigate = useNavigate();
  const { sesion, cerrarSesion, actualizarDatos } = useAuth();
  const { notificar } = useToast();

  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // Datos editables
  const [nombre, setNombre] = useState('');
  const [matricula, setMatricula] = useState('');
  const [guardarCarrito, setGuardarCarrito] = useState(false);
  const [erroresDatos, setErroresDatos] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Contraseña
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirmar, setPassConfirmar] = useState('');
  const [erroresPass, setErroresPass] = useState({});
  const [cambiandoPass, setCambiandoPass] = useState(false);

  // Borrar cuenta
  const [borrarAbierto, setBorrarAbierto] = useState(false);
  const [passBorrar, setPassBorrar] = useState('');
  const [errorBorrar, setErrorBorrar] = useState('');
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let activo = true;
    authService.obtenerPerfil()
      .then((datos) => {
        if (!activo) return;
        setPerfil(datos);
        setNombre(datos.nombre);
        setMatricula(datos.matricula || '');
        setGuardarCarrito(Boolean(datos.acepto_cookies));
      })
      .catch((err) => { if (activo) setErrorCarga(mensajeDeError(err, 'No pudimos cargar tus datos.')); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const guardarDatos = async (e) => {
    e.preventDefault();
    setErroresDatos({});
    setGuardando(true);
    try {
      const cambios = { nombre: nombre.trim(), acepto_cookies: guardarCarrito };
      if (!perfil.es_admin) cambios.matricula = matricula.trim();
      const respuesta = await authService.actualizarPerfil(cambios);
      setPerfil(respuesta.perfil);
      actualizarDatos({ nombre: respuesta.perfil.nombre, cookies: respuesta.perfil.acepto_cookies });
      notificar('Tus datos se guardaron.', 'ok');
    } catch (err) {
      const porCampo = erroresPorCampo(err);
      if (Object.keys(porCampo).length > 0) setErroresDatos(porCampo);
      else notificar(mensajeDeError(err), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    const nuevos = {};
    if (passNueva.length < 8) nuevos.password_nueva = 'Mínimo 8 caracteres.';
    if (passNueva !== passConfirmar) nuevos.confirmar = 'Las contraseñas no coinciden.';
    setErroresPass(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setCambiandoPass(true);
    try {
      await authService.actualizarPerfil({ password_actual: passActual, password_nueva: passNueva });
      await cerrarSesion();
      notificar('Contraseña actualizada. Inicia sesión con la nueva.', 'ok');
      navigate('/login');
    } catch (err) {
      const porCampo = erroresPorCampo(err);
      if (Object.keys(porCampo).length > 0) setErroresPass(porCampo);
      else notificar(mensajeDeError(err), 'error');
    } finally {
      setCambiandoPass(false);
    }
  };

  const borrarCuenta = async (e) => {
    e.preventDefault();
    setErrorBorrar('');
    setBorrando(true);
    try {
      await authService.borrarCuenta(passBorrar);
      await cerrarSesion();
      notificar('Tu cuenta y tus datos personales fueron eliminados.', 'ok');
      navigate('/login');
    } catch (err) {
      setErrorBorrar(mensajeDeError(err, 'No pudimos borrar tu cuenta.'));
    } finally {
      setBorrando(false);
    }
  };

  if (cargando) return <div className="contenedor" style={{ textAlign: 'center', paddingTop: 60 }}>Cargando tus datos…</div>;
  if (errorCarga) {
    return (
      <div className="contenedor">
        <div className="alerta alerta-error" role="alert"><Icono nombre="alerta" tam={20} /><span>{errorCarga}</span></div>
      </div>
    );
  }

  const esUsuario = !perfil.es_admin;

  return (
    <div className={`contenedor ${esUsuario ? 'con-barra-inferior' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1>Mi cuenta</h1>
        <p style={{ color: 'var(--gris-500)', fontSize: '0.9rem' }}>{ETIQUETA_ROL[perfil.rol] || perfil.rol} · {perfil.email}</p>
      </header>

      <form className="tarjeta tarjeta-pad formulario" onSubmit={guardarDatos}>
        <h2>Mis datos</h2>
        <Campo id="p-nombre" etiqueta="Nombre o apodo" error={erroresDatos.nombre}>
          <input id="p-nombre" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo id="p-email" etiqueta="Correo institucional" ayuda="El correo no se puede cambiar porque identifica tu cuenta.">
          <input id="p-email" value={perfil.email} readOnly disabled />
        </Campo>
        {esUsuario && (
          <Campo id="p-matricula" etiqueta="Matrícula (opcional)" error={erroresDatos.matricula}>
            <input id="p-matricula" maxLength={20} value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Déjala vacía si no quieres darla" />
          </Campo>
        )}
        <label className="casilla">
          <input type="checkbox" checked={guardarCarrito} onChange={(e) => setGuardarCarrito(e.target.checked)} />
          <span>Recordar mi carrito en este dispositivo (opcional).</span>
        </label>
        <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>

      <form className="tarjeta tarjeta-pad formulario" onSubmit={cambiarPassword}>
        <h2>Cambiar contraseña</h2>
        <Campo id="p-actual" etiqueta="Contraseña actual" error={erroresPass.password_actual}>
          <input id="p-actual" type="password" autoComplete="current-password" value={passActual} onChange={(e) => setPassActual(e.target.value)} />
        </Campo>
        <Campo id="p-nueva" etiqueta="Contraseña nueva" error={erroresPass.password_nueva}>
          <input id="p-nueva" type="password" autoComplete="new-password" value={passNueva} onChange={(e) => setPassNueva(e.target.value)} />
        </Campo>
        <Campo id="p-confirmar" etiqueta="Repite la contraseña nueva" error={erroresPass.confirmar}>
          <input id="p-confirmar" type="password" autoComplete="new-password" value={passConfirmar} onChange={(e) => setPassConfirmar(e.target.value)} />
        </Campo>
        <button type="submit" className="btn btn-borde" disabled={cambiandoPass || !passActual || !passNueva}>
          {cambiandoPass ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>

      <div className="tarjeta tarjeta-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>Privacidad</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--gris-700)' }}>
          Revisa cómo cuidamos tus datos en el <Link to="/privacidad">aviso de privacidad</Link>.
        </p>
      </div>

      {esUsuario && (
        <div className="tarjeta tarjeta-pad" style={{ borderColor: '#f3b6bf', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ color: 'var(--rojo)' }}>Borrar mi cuenta</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--gris-700)' }}>
            Se eliminan tu cuenta y tus datos personales. No se puede deshacer. Si tienes pedidos en curso, primero recógelos.
          </p>
          <button type="button" className="btn btn-peligro-borde" onClick={() => { setBorrarAbierto(true); setPassBorrar(''); setErrorBorrar(''); }}>
            <Icono nombre="basura" tam={18} /> Borrar mi cuenta
          </button>
        </div>
      )}

      <Hoja abierta={borrarAbierto} onCerrar={() => setBorrarAbierto(false)} titulo="¿Borrar tu cuenta?" centrada>
        <form className="formulario" onSubmit={borrarCuenta}>
          <p style={{ fontSize: '0.92rem', color: 'var(--gris-700)' }}>
            Para confirmar, escribe tu contraseña. Después de esto no podrás recuperar tu cuenta.
          </p>
          {errorBorrar && <div className="alerta alerta-error" role="alert"><Icono nombre="alerta" tam={20} /><span>{errorBorrar}</span></div>}
          <div className="campo">
            <label htmlFor="p-borrar">Tu contraseña</label>
            <input id="p-borrar" type="password" autoComplete="current-password" value={passBorrar} onChange={(e) => setPassBorrar(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-peligro btn-bloque" disabled={borrando || !passBorrar}>
            {borrando ? 'Borrando…' : 'Sí, borrar mi cuenta'}
          </button>
          <button type="button" className="btn btn-gris btn-bloque" onClick={() => setBorrarAbierto(false)}>Cancelar</button>
        </form>
      </Hoja>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--gris-500)' }}>Sesión iniciada como {sesion.nombre}</p>
    </div>
  );
}
