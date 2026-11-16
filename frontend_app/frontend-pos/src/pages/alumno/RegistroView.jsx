import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import { codigoDeError, erroresPorCampo, mensajeDeError } from '../../utils/errores';
import Icono from '../../components/Icono';

const DOMINIO_ALUMNOS = 'hgo.conalep.edu.mx';
const DOMINIOS_DOCENTES = ['hgo.conalep.edu.mx', 'conalep.edu.mx'];

const Campo = ({ id, etiqueta, error, ayuda, children }) => (
  <div className={`campo ${error ? 'campo-error' : ''}`}>
    <label htmlFor={id}>{etiqueta}</label>
    {children}
    {error ? <span className="texto-error" role="alert">{error}</span> : ayuda && <span className="texto-ayuda">{ayuda}</span>}
  </div>
);

export default function RegistroView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notificar } = useToast();

  const [paso, setPaso] = useState(location.state?.verificar ? 'verificar' : 'formulario');
  const [rol, setRol] = useState('ALUMNO');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState(location.state?.email || '');
  const [codigoDocente, setCodigoDocente] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false); // siempre empieza sin marcar
  const [aceptoCookies, setAceptoCookies] = useState(false);       // casilla independiente, sin marcar
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(false);

  // Paso 2: verificación del correo
  const [codigo, setCodigo] = useState('');
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  useEffect(() => {
    if (segundosReenvio <= 0) return undefined;
    const t = setTimeout(() => setSegundosReenvio((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundosReenvio]);

  const validarLocal = () => {
    const nuevos = {};
    const limpio = nombre.trim();
    if (limpio.length < 2) nuevos.nombre = 'Escribe tu nombre o apodo (mínimo 2 letras).';
    const correo = email.trim().toLowerCase();
    const dominio = correo.split('@')[1];
    const permitidos = rol === 'DOCENTE' ? DOMINIOS_DOCENTES : [DOMINIO_ALUMNOS];
    if (!correo.includes('@') || !dominio) nuevos.email = 'Escribe tu correo institucional completo.';
    else if (!permitidos.includes(dominio)) nuevos.email = `Usa tu correo institucional (@${permitidos[0]}).`;
    if (rol === 'DOCENTE' && !codigoDocente.trim()) nuevos.codigo_docente = 'Escribe el código que te dieron para docentes.';
    if (password.length < 8) nuevos.password = 'Mínimo 8 caracteres.';
    else if (/^\d+$/.test(password)) nuevos.password = 'No uses solo números.';
    if (confirmacion !== password) nuevos.password_confirmacion = 'Las contraseñas no coinciden.';
    if (!aceptoPrivacidad) nuevos.acepto_privacidad = 'Debes aceptar el aviso de privacidad para crear tu cuenta.';
    return nuevos;
  };

  const enviarRegistro = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    const locales = validarLocal();
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setCargando(true);
    try {
      const respuesta = await authService.registro({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
        password_confirmacion: confirmacion,
        rol,
        codigo_docente: rol === 'DOCENTE' ? codigoDocente.trim() : '',
        acepto_privacidad: aceptoPrivacidad,
        acepto_cookies: aceptoCookies,
      });
      if (respuesta.requiere_verificacion) {
        setPaso('verificar');
        setSegundosReenvio(60);
        notificar('Te enviamos un código a tu correo.', 'info');
      } else {
        notificar('¡Cuenta creada! Ya puedes iniciar sesión.', 'ok');
        navigate('/login', { state: { email: email.trim().toLowerCase() } });
      }
    } catch (err) {
      const porCampo = erroresPorCampo(err);
      if (Object.keys(porCampo).length > 0 && err.response?.status === 400) setErrores(porCampo);
      else setErrorGeneral(mensajeDeError(err, 'No pudimos crear tu cuenta.'));
    } finally {
      setCargando(false);
    }
  };

  const verificar = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setCargando(true);
    try {
      await authService.verificarCorreo(email.trim().toLowerCase(), codigo.trim());
      notificar('¡Correo verificado! Ya puedes iniciar sesión.', 'ok');
      navigate('/login', { state: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setErrorGeneral(mensajeDeError(err, 'No pudimos verificar el código.'));
      if (['expirado', 'bloqueado'].includes(codigoDeError(err))) setCodigo('');
    } finally {
      setCargando(false);
    }
  };

  const reenviar = async () => {
    try {
      await authService.reenviarCodigo(email.trim().toLowerCase());
      setSegundosReenvio(60);
      notificar('Si tu cuenta está pendiente, te enviamos un código nuevo.', 'info');
    } catch (err) {
      setErrorGeneral(mensajeDeError(err));
    }
  };

  /* ===================== Paso 2: código ===================== */
  if (paso === 'verificar') {
    return (
      <div className="centro-pantalla">
        <div className="tarjeta tarjeta-pad contenedor-angosto" style={{ width: '100%' }}>
          <h1>Verifica tu correo</h1>
          <p style={{ color: 'var(--gris-500)', margin: '6px 0 16px', fontSize: '0.92rem' }}>
            Escribe el código de 6 dígitos que enviamos a <strong>{email}</strong>. Vence en 15 minutos.
          </p>

          {errorGeneral && (
            <div className="alerta alerta-error" role="alert" style={{ marginBottom: 14 }}>
              <Icono nombre="alerta" tam={20} /><span>{errorGeneral}</span>
            </div>
          )}

          <form className="formulario" onSubmit={verificar}>
            <Campo id="codigo" etiqueta="Código de verificación">
              <input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.4rem', fontWeight: 700 }}
              />
            </Campo>
            <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando || codigo.length !== 6}>
              {cargando ? 'Verificando…' : 'Verificar y activar cuenta'}
            </button>
            <button type="button" className="btn btn-gris btn-bloque" onClick={reenviar} disabled={segundosReenvio > 0}>
              {segundosReenvio > 0 ? `Reenviar código en ${segundosReenvio} s` : 'Reenviar código'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.88rem' }}>
            <button type="button" onClick={() => { setPaso('formulario'); setErrorGeneral(''); }} style={{ background: 'none', border: 0, color: 'var(--azul)', fontWeight: 600 }}>
              ¿Te equivocaste de correo? Volver
            </button>
          </p>
        </div>
      </div>
    );
  }

  /* ===================== Paso 1: formulario ===================== */
  return (
    <div className="centro-pantalla" style={{ alignItems: 'flex-start' }}>
      <div className="tarjeta tarjeta-pad contenedor-angosto" style={{ width: '100%' }}>
        <h1>Crear cuenta</h1>
        <p style={{ color: 'var(--gris-500)', margin: '4px 0 16px', fontSize: '0.9rem' }}>
          Solo te pedimos lo necesario: nombre o apodo, correo institucional y contraseña.
        </p>

        {errorGeneral && (
          <div className="alerta alerta-error" role="alert" style={{ marginBottom: 14 }}>
            <Icono nombre="alerta" tam={20} /><span>{errorGeneral}</span>
          </div>
        )}

        <form className="formulario" onSubmit={enviarRegistro} noValidate>
          <div className="segmentado" role="group" aria-label="Tipo de cuenta">
            <button type="button" className={rol === 'ALUMNO' ? 'activo' : ''} onClick={() => setRol('ALUMNO')}>Soy alumno</button>
            <button type="button" className={rol === 'DOCENTE' ? 'activo' : ''} onClick={() => setRol('DOCENTE')}>Soy docente</button>
          </div>

          <Campo id="nombre" etiqueta="Nombre o apodo" error={errores.nombre} ayuda="Así te llamaremos al avisarte de tu pedido.">
            <input id="nombre" autoComplete="nickname" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Pedro" />
          </Campo>

          <Campo id="email" etiqueta="Correo institucional" error={errores.email}>
            <input id="email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={`tucorreo@${DOMINIO_ALUMNOS}`} />
          </Campo>

          {rol === 'DOCENTE' && (
            <Campo id="codigo_docente" etiqueta="Código de docente" error={errores.codigo_docente} ayuda="Te lo entrega la cooperativa para comprobar que eres docente.">
              <input id="codigo_docente" autoCapitalize="characters" value={codigoDocente} onChange={(e) => setCodigoDocente(e.target.value.toUpperCase())} placeholder="DOC-XXXXXX" />
            </Campo>
          )}

          <Campo id="password" etiqueta="Contraseña" error={errores.password} ayuda="Mínimo 8 caracteres; mezcla letras y números.">
            <div className="campo-con-boton">
              <input id="password" type={verPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setVerPassword(!verPassword)} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Icono nombre={verPassword ? 'ojoTachado' : 'ojo'} tam={20} />
              </button>
            </div>
          </Campo>

          <Campo id="password2" etiqueta="Repite la contraseña" error={errores.password_confirmacion}>
            <input id="password2" type={verPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
          </Campo>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="casilla">
                <input type="checkbox" checked={aceptoPrivacidad} onChange={(e) => setAceptoPrivacidad(e.target.checked)} />
                <span>
                  He leído y acepto el <a href="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</a>. (Obligatorio)
                </span>
              </label>
              {errores.acepto_privacidad && <span className="texto-error" role="alert">{errores.acepto_privacidad}</span>}
            </div>

            <label className="casilla">
              <input type="checkbox" checked={aceptoCookies} onChange={(e) => setAceptoCookies(e.target.checked)} />
              <span>
                Acepto que el sitio guarde mi carrito en este dispositivo para no perderlo al recargar. (Opcional; la sesión se
                guarda siempre porque es necesaria para funcionar. Ver <a href="/privacidad#cookies" target="_blank" rel="noopener noreferrer">política de cookies</a>.)
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando}>
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '0.92rem' }}>
          <Link to="/login" style={{ fontWeight: 700 }}>¿Ya tienes cuenta? Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
