import React, { useEffect, useState } from 'react';
import { optimizarImagen } from '../utils/imagenes';

// Foto del producto; si no hay foto (o no carga) muestra la inicial con color.
export default function FotoProducto({ producto, color = '#1b7a3e', tam = 64, radio = 12 }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [producto.imagen_url]);

  const caja = { width: tam, height: tam, borderRadius: radio, flexShrink: 0, overflow: 'hidden' };

  if (producto.imagen_url && !fallo) {
    return (
      <img
        src={optimizarImagen(producto.imagen_url, tam * 2)}
        alt={producto.nombre}
        width={tam}
        height={tam}
        loading="lazy"
        onError={() => setFallo(true)}
        style={{ ...caja, objectFit: 'cover', display: 'block', backgroundColor: '#eceff1' }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        color: '#fff', fontWeight: 800, fontSize: Math.round(tam * 0.42), backgroundColor: color }}
    >
      {producto.nombre.charAt(0).toUpperCase()}
    </div>
  );
}
