import React, { useCallback, useEffect, useState } from 'react';
import cocinaService from '../../services/cocinaService';
import { subirACloudinary } from '../../utils/imagenes';
import { mensajeDeError } from '../../utils/errores';
import { useToast } from '../../contexts/ToastContext';
import FotoProducto from '../../components/FotoProducto';
import Icono from '../../components/Icono';

// Fotos de los productos: subir, cambiar o quitar.
export default function ImagenesProductosView() {
  const { notificar } = useToast();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null); // id del producto que se está subiendo

  const cargar = useCallback(async () => {
    try {
      const categorias = await cocinaService.obtenerMenuConFotos();
      setProductos(categorias.flatMap((cat) => (cat.productos || []).map((p) => ({ ...p, categoria: cat.nombre }))));
      setError('');
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cargar los productos.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (producto, nuevaUrl) => {
    await cocinaService.actualizarImagenProducto(producto.id, nuevaUrl);
    setProductos((lista) => lista.map((p) => (p.id === producto.id ? { ...p, imagen_url: nuevaUrl } : p)));
  };

  const elegirArchivo = async (producto, e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;
    setOcupado(producto.id);
    try {
      const url = await subirACloudinary(archivo);
      await guardar(producto, url);
      notificar(`Foto de ${producto.nombre} guardada.`, 'ok');
    } catch (err) {
      notificar(err.response ? mensajeDeError(err) : err.message, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const quitar = async (producto) => {
    setOcupado(producto.id);
    try {
      await guardar(producto, '');
      notificar(`Se quitó la foto de ${producto.nombre}.`, 'ok');
    } catch (err) {
      notificar(mensajeDeError(err), 'error');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="contenedor">
      <header style={{ marginBottom: 16 }}>
        <h1>Fotos de productos</h1>
        <p style={{ color: 'var(--gris-500)', fontSize: '0.9rem' }}>
          Toca "Subir foto" en un producto. Desde el celular puedes tomarla o elegirla de tu galería.
        </p>
      </header>

      {error && <div className="alerta alerta-error" role="alert" style={{ marginBottom: 12 }}><Icono nombre="alerta" tam={20} /><span>{error}</span></div>}
      {cargando && <p style={{ textAlign: 'center', color: 'var(--gris-500)' }}>Cargando…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {productos.map((p) => (
          <div key={p.id} className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
            <FotoProducto producto={p} tam={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--gris-500)' }}>{p.categoria}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
              <label className="btn btn-borde" style={{ minHeight: 38, fontSize: '0.82rem', opacity: ocupado === p.id ? 0.6 : 1 }}>
                {ocupado === p.id ? 'Subiendo…' : p.imagen_url ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={ocupado !== null} onChange={(e) => elegirArchivo(p, e)} />
              </label>
              {p.imagen_url && (
                <button type="button" className="btn btn-gris" style={{ minHeight: 34, fontSize: '0.78rem' }} disabled={ocupado !== null} onClick={() => quitar(p)}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
