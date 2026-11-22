import React, { useState, useEffect } from 'react';
import cocinaService from '../../services/cocinaService';
import { subirACloudinary } from '../../utils/imagenes';

export default function CrearProductoView() {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const [esPreparado, setEsPreparado] = useState(false);
  const [stockMinimoAlerta, setStockMinimoAlerta] = useState('5');
  const [foto, setFoto] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState('');

  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

  // Traemos las categorías existentes para sugerirlas (el personal puede igual escribir una nueva)
  useEffect(() => {
    cocinaService.obtenerCategorias()
      .then((data) => setCategorias(data || []))
      .catch((err) => console.error('No se pudieron cargar las categorías existentes:', err));
  }, []);

  const limpiarFormulario = () => {
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setCategoriaNombre('');
    setEsPreparado(false);
    setStockMinimoAlerta('5');
    setFoto(null);
    setVistaPrevia('');
  };

  const elegirFoto = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setFoto(archivo);
    setVistaPrevia(URL.createObjectURL(archivo));
  };

  const handleGuardarProducto = async (e) => {
    e.preventDefault();

    if (!nombre.trim() || !precio || !categoriaNombre.trim()) {
      setMensaje({ texto: 'Completa al menos el nombre, el precio y la categoría.', tipo: 'error' });
      return;
    }

    try {
      setCargando(true);
      setMensaje({ texto: '', tipo: '' });

      let imagenUrl = '';
      if (foto) {
        try {
          imagenUrl = await subirACloudinary(foto);
        } catch (errFoto) {
          setMensaje({ texto: errFoto.message, tipo: 'error' });
          return;
        }
      }

      const respuesta = await cocinaService.crearProducto({
        nombre,
        descripcion,
        precio,
        categoriaNombre,
        esPreparado,
        stockMinimoAlerta: esPreparado ? 0 : (stockMinimoAlerta || 5),
        imagenUrl,
      });

      setMensaje({ texto: respuesta.mensaje || 'Producto agregado con éxito.', tipo: 'exito' });
      limpiarFormulario();
    } catch (err) {
      const datos = err.response?.data;
      const primerError = datos && typeof datos === 'object' ? Object.values(datos)[0] : null;
      const texto = Array.isArray(primerError) ? primerError[0] : (primerError || 'Error de conexión al crear el producto.');
      setMensaje({ texto, tipo: 'error' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.tarjeta}>
        <div style={estilos.cabecera}>
          <h1 style={estilos.titulo}>Nuevo producto</h1>
          <p style={estilos.subtitulo}>
            Para productos que todavía no existen en el catálogo (ej. agregar "Paletas" cuando solo tenías "Galletas").
            Si solo necesitas sumar existencias de algo que ya vendes, usa "Registrar Lotes" en su lugar.
          </p>
        </div>

        {mensaje.texto && (
          <div style={mensaje.tipo === 'exito' ? estilos.alertaExito : estilos.alertaError}>
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleGuardarProducto} style={estilos.formulario}>
          <div style={estilos.grupoInput}>
            <label style={estilos.label}>Nombre del producto</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Paletas de hielo"
              style={estilos.input}
              required
            />
          </div>

          <div style={estilos.grupoInput}>
            <label style={estilos.label}>Descripción (opcional)</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej. Paleta de agua, sabor surtido"
              style={estilos.input}
            />
          </div>

          <div style={estilos.filaDoble}>
            <div style={estilos.grupoInput}>
              <label style={estilos.label}>Precio (MXN)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="ej. 12.00"
                style={estilos.input}
                required
              />
            </div>

            <div style={estilos.grupoInput}>
              <label style={estilos.label}>Categoría</label>
              <input
                type="text"
                list="lista-categorias"
                value={categoriaNombre}
                onChange={(e) => setCategoriaNombre(e.target.value)}
                placeholder="ej. Botanas"
                style={estilos.input}
                required
              />
              <datalist id="lista-categorias">
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={estilos.grupoInput}>
            <label style={estilos.label}>Foto (opcional)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirFoto} />
            {vistaPrevia && (
              <img src={vistaPrevia} alt="Vista previa" width="96" height="96" style={{ marginTop: 8, borderRadius: 12, objectFit: 'cover' }} />
            )}
          </div>

          <div style={estilos.grupoCheckbox}>
            <input
              type="checkbox"
              id="esPreparado"
              checked={esPreparado}
              onChange={(e) => setEsPreparado(e.target.checked)}
              style={estilos.checkbox}
            />
            <label htmlFor="esPreparado" style={estilos.labelCheckbox}>
              Es un producto preparado al momento (no se controla por lotes de almacén, ej. una torta hecha en el momento)
            </label>
          </div>

          {!esPreparado && (
            <div style={estilos.grupoInput}>
              <label style={estilos.label}>Alerta de stock mínimo</label>
              <input
                type="number"
                min="0"
                value={stockMinimoAlerta}
                onChange={(e) => setStockMinimoAlerta(e.target.value)}
                style={estilos.input}
              />
              <small style={estilos.ayuda}>Cuando el stock llegue a este número o menos, se mostrará en Alertas de Stock.</small>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={cargando ? estilos.botonDeshabilitado : estilos.botonEnviar}
          >
            {cargando ? 'Guardando...' : 'Agregar producto al catálogo'}
          </button>
        </form>
      </div>
    </div>
  );
}

const estilos = {
  contenedor: { display: 'flex', justifyContent: 'center', padding: '30px 20px', fontFamily: 'Segoe UI, sans-serif' },
  tarjeta: { backgroundColor: '#fff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '520px', width: '100%' },
  cabecera: { marginBottom: '20px' },
  titulo: { color: '#1f2937', margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' },
  subtitulo: { color: '#666', margin: 0, fontSize: '13px', lineHeight: '1.5' },
  formulario: { display: 'flex', flexDirection: 'column', gap: '15px' },
  filaDoble: { display: 'flex', gap: '15px' },
  grupoInput: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' },
  input: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', backgroundColor: '#f9fafb' },
  ayuda: { fontSize: '12px', color: '#777' },
  grupoCheckbox: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0' },
  checkbox: { marginTop: '3px', width: '16px', height: '16px', flexShrink: 0 },
  labelCheckbox: { fontSize: '13px', color: '#374151', lineHeight: '1.4' },
  botonEnviar: { backgroundColor: '#1b7a3e', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' },
  botonDeshabilitado: { backgroundColor: '#9ca3af', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'not-allowed', marginTop: '5px' },
  alertaExito: { backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px', fontWeight: '600', border: '1px solid #a7f3d0' },
  alertaError: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px', fontWeight: '600', border: '1px solid #fca5a5' },
};
