import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

// IMPORTANTE: este texto es un borrador de buena fe. Pídele a la dirección del plantel que lo revise
// (responsable, contacto y plazos) antes de usarlo oficialmente. Si cambias el texto, cambia también
// VERSION_AVISO_PRIVACIDAD en Railway.
const RESPONSABLE = import.meta.env.VITE_RESPONSABLE || 'la cooperativa de la cafetería del plantel CONALEP';
const CONTACTO = import.meta.env.VITE_CONTACTO_PRIVACIDAD || 'el área administrativa del plantel';

const Seccion = ({ id, titulo, children }) => (
  <section id={id} style={{ marginBottom: 22 }}>
    <h2>{titulo}</h2>
    <div style={{ color: 'var(--gris-700)', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </section>
);

export default function PrivacidadView() {
  // Si llegan con #cookies, bajamos a esa sección.
  useEffect(() => {
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  return (
    <div className="contenedor" style={{ paddingBottom: 40 }}>
      <div className="tarjeta tarjeta-pad">
        <h1>Aviso de privacidad y cookies</h1>
        <p style={{ color: 'var(--gris-500)', marginBottom: 20, fontSize: '0.85rem' }}>Cafetería CONALEP · Última actualización: noviembre de 2026</p>

        <Seccion titulo="¿Quién es responsable de tus datos?">
          <p>{RESPONSABLE} es responsable de los datos personales que se recaban en esta aplicación. Para cualquier duda o solicitud, contacta a {CONTACTO}.</p>
        </Seccion>

        <Seccion titulo="¿Qué datos recabamos?">
          <p>Solo los necesarios para que puedas pedir en la cafetería:</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Tu nombre o apodo.</li>
            <li>Tu correo institucional (para identificar tu cuenta y verificar que es tuyo).</li>
            <li>Tu contraseña, que se guarda cifrada (hash) y nadie puede leerla.</li>
            <li>Tus pedidos (productos, total, método de pago y estado).</li>
            <li>La fecha y versión del aviso que aceptaste.</li>
            <li>Si eres docente: que tu cuenta fue validada con un código. Opcionalmente, tu matrícula si decides agregarla.</li>
          </ul>
          <p>No pedimos domicilio, teléfono, CURP, fotos ni datos bancarios. No guardamos números de tarjeta.</p>
        </Seccion>

        <Seccion titulo="¿Para qué los usamos?">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Crear y proteger tu cuenta.</li>
            <li>Procesar tus pedidos y avisarte cuando estén listos.</li>
            <li>Llevar el control de caja e inventario de la cafetería.</li>
          </ul>
          <p>No vendemos ni compartimos tus datos con terceros para publicidad. Solo los usan los servicios que hacen funcionar la aplicación (alojamiento y envío de correos de verificación) o una autoridad que los requiera por ley.</p>
        </Seccion>

        <Seccion titulo="¿Cuánto tiempo los conservamos?">
          <p>Tus pedidos se borran automáticamente a los 15 días. Tu cuenta se conserva mientras la uses y puedes borrarla cuando quieras.</p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p>Puedes ver y corregir tus datos, y borrar tu cuenta con todos tus datos personales, desde <strong>Mi cuenta</strong> en la aplicación. También puedes oponerte al uso de tus datos o pedir más información escribiendo a {CONTACTO}.</p>
          <p>Si eres menor de edad, tu madre, padre o tutor también puede ejercer estos derechos por ti.</p>
        </Seccion>

        <Seccion id="cookies" titulo="Cookies y almacenamiento en tu dispositivo">
          <p>No usamos cookies de publicidad, rastreo ni analítica. Esta aplicación guarda en tu navegador:</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Sesión (necesario):</strong> un código que mantiene tu sesión iniciada hasta 12 horas. Sin esto la aplicación no puede funcionar, por eso no es opcional.</li>
            <li><strong>Carrito (opcional):</strong> si marcaste esa casilla, tu carrito se recuerda aunque recargues la página. Puedes cambiar esta opción en <strong>Mi cuenta</strong>.</li>
          </ul>
        </Seccion>

        <Link to="/login" className="btn btn-primario" style={{ marginTop: 8 }}>Volver</Link>
      </div>
    </div>
  );
}
