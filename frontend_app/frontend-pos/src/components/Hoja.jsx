import React, { useEffect } from 'react';

// Hoja inferior (móvil) / ventana centrada. Se cierra con Escape o tocando afuera.
export default function Hoja({ abierta, onCerrar, titulo, centrada = false, children }) {
  useEffect(() => {
    if (!abierta) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar?.(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className={`hoja-fondo ${centrada ? 'hoja-centrada' : ''}`} onClick={onCerrar} role="presentation">
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        {titulo && <h2 style={{ marginBottom: 6 }}>{titulo}</h2>}
        {children}
      </div>
    </div>
  );
}
