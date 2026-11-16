import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icono from '../components/Icono';

const ToastContext = createContext({ notificar: () => 0, quitar: () => {} });

const ICONOS = { ok: 'check', error: 'alerta', aviso: 'alerta', info: 'info' };

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const contador = useRef(0);

  const quitar = useCallback((id) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  /**
   * notificar('Texto', 'ok' | 'error' | 'aviso' | 'info', { fijo: true })
   * Los avisos desaparecen solos a los 5 segundos, salvo los "fijo".
   */
  const notificar = useCallback((texto, tipo = 'info', opciones = {}) => {
    contador.current += 1;
    const id = contador.current;
    setAvisos((actuales) => [...actuales.slice(-2), { id, texto, tipo }]);
    if (!opciones.fijo) {
      setTimeout(() => quitar(id), opciones.duracion || 5000);
    }
    return id;
  }, [quitar]);

  const valor = useMemo(() => ({ notificar, quitar }), [notificar, quitar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`aviso aviso-${aviso.tipo}`}>
            <span className="icono-aviso" style={{ display: 'flex', marginTop: 1 }}>
              <Icono nombre={ICONOS[aviso.tipo] || 'info'} tam={20} />
            </span>
            <span className="aviso-texto">{aviso.texto}</span>
            <button type="button" className="aviso-cerrar" onClick={() => quitar(aviso.id)} aria-label="Cerrar aviso">
              <Icono nombre="cerrar" tam={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
