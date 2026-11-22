import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import menuService from '../../services/menuService';
import { useCart } from '../../contexts/CartContext';
import { mensajeDeError } from '../../utils/errores';
import Hoja from '../../components/Hoja';
import Icono from '../../components/Icono';
import FotoProducto from '../../components/FotoProducto';
import theme from '../../theme';

// Un set de colores para rotar el "ícono" de cada producto ya que no usamos fotos
const coloresIcono = ['#1b7a3e', '#f5b014', '#3f37c9', '#d90429', '#0ea5a3', '#6d28d9'];
const colorParaProducto = (nombre) => {
  const codigo = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return coloresIcono[codigo % coloresIcono.length];
};

const MenuView = () => {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [hojaCategorias, setHojaCategorias] = useState(false);
  const [params, setParams] = useSearchParams();
  const inputBusqueda = useRef(null);
  const categoriaActiva = params.get('cat');

  const { carrito, agregarAlCarrito, restarCantidad } = useCart();

  // La barra inferior nos manda aquí con ?buscar=1 (enfocar búsqueda) o ?categorias=1 (abrir categorías).
  useEffect(() => {
    if (params.get('buscar')) {
      inputBusqueda.current?.focus();
      inputBusqueda.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const nuevos = new URLSearchParams(params);
      nuevos.delete('buscar');
      setParams(nuevos, { replace: true });
    }
    if (params.get('categorias')) {
      setHojaCategorias(true);
      const nuevos = new URLSearchParams(params);
      nuevos.delete('categorias');
      setParams(nuevos, { replace: true });
    }
  }, [params, setParams]);

  const elegirCategoria = (id) => {
    const nuevos = new URLSearchParams(params);
    if (id) nuevos.set('cat', String(id)); else nuevos.delete('cat');
    setParams(nuevos, { replace: true });
    setHojaCategorias(false);
  };

  useEffect(() => {
    const cargarDatosMenu = async () => {
      try {
        const datos = await menuService.obtenerMenu();
        setCategorias(datos);
      } catch (err) {
        setError(mensajeDeError(err, 'No se pudo cargar el menú.'));
      } finally {
        setCargando(false);
      }
    };

    cargarDatosMenu();
  }, []);

  const obtenerCantidadEnCarrito = (id) => {
    const item = carrito.find((prod) => prod.id === id);
    return item ? item.cantidad : 0;
  };

  if (cargando) {
    return <div style={estilos.centrado}><h3>Cargando el menú…</h3></div>;
  }

  if (error) {
    return <div style={estilos.centrado}><h3 style={{ color: theme.rojo }}>{error}</h3></div>;
  }

  const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const terminoBusqueda = normalizar(busqueda.trim());
  const categoriasVisibles = categoriaActiva
    ? categorias.filter((cat) => String(cat.id) === categoriaActiva)
    : categorias;
  const categoriasFiltradas = terminoBusqueda
    ? categoriasVisibles
        .map((cat) => ({
          ...cat,
          productos: (cat.productos || []).filter((p) => normalizar(p.nombre).includes(terminoBusqueda)),
        }))
        .filter((cat) => cat.productos.length > 0)
    : categoriasVisibles;
  const nombreCategoriaActiva = categorias.find((c) => String(c.id) === categoriaActiva)?.nombre;

  return (
    <div style={estilos.contenedor} className="con-barra-inferior">
      <header style={estilos.header}>
        <h1 style={estilos.titulo}>Menú del día</h1>
        <p style={estilos.subtitulo}>Arma tu pedido y recógelo en caja cuando esté listo</p>
      </header>

      <div style={estilos.buscadorContenedor}>
        <span style={estilos.buscadorIcono}><Icono nombre="buscar" tam={18} /></span>
        <input
          ref={inputBusqueda}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar comida, bebida, antojitos..."
          aria-label="Buscar productos"
          autoComplete="off"
          style={estilos.buscadorInput}
        />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda('')} style={estilos.buscadorLimpiar} aria-label="Borrar búsqueda">
            <Icono nombre="cerrar" tam={18} />
          </button>
        )}
      </div>

      {categorias.length > 1 && (
        <div style={estilos.chips} role="group" aria-label="Filtrar por categoría">
          <button type="button" onClick={() => elegirCategoria(null)} style={!categoriaActiva ? estilos.chipActivo : estilos.chip}>Todo</button>
          {categorias.map((cat) => (
            <button key={cat.id} type="button" onClick={() => elegirCategoria(cat.id)} style={String(cat.id) === categoriaActiva ? estilos.chipActivo : estilos.chip}>
              {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {categorias.length === 0 ? (
        <p style={estilos.sinDatos}>No hay categorías o productos registrados en este momento.</p>
      ) : categoriasFiltradas.length === 0 ? (
        <p style={estilos.sinDatos}>No encontramos productos{busqueda ? ` que coincidan con "${busqueda}"` : ''}{nombreCategoriaActiva ? ` en ${nombreCategoriaActiva}` : ''}.</p>
      ) : (
        categoriasFiltradas.map((cat) => (
          <section key={cat.id} style={estilos.seccionCategoria}>
            <h2 style={estilos.tituloCategoria}>{cat.nombre}</h2>
            <div style={estilos.listaProductos}>
              {cat.productos && cat.productos.map((prod) => {
                const cantidadCarrito = obtenerCantidadEnCarrito(prod.id);
                const stockDisponibleReal = prod.stock_disponible;
                const agotado = !prod.es_preparado && stockDisponibleReal <= 0;

                return (
                  <div key={prod.id} style={estilos.tarjetaProducto}>
                    <FotoProducto producto={prod} color={colorParaProducto(prod.nombre)} tam={64} />

                    <div style={estilos.infoProducto}>
                      <h3 style={estilos.nombreProd}>{prod.nombre}</h3>
                      <p style={estilos.descripcion}>{prod.descripcion || 'Sin descripción disponible.'}</p>
                      <div style={estilos.filaPrecioBadge}>
                        <span style={estilos.precio}>${prod.precio}</span>
                        {prod.es_preparado ? (
                          <span style={estilos.badgePreparado}>Al momento</span>
                        ) : stockDisponibleReal > 0 ? (
                          <span style={estilos.badgeDisponible}>{stockDisponibleReal} disp.</span>
                        ) : (
                          <span style={estilos.badgeAgotado}>Agotado</span>
                        )}
                      </div>
                    </div>

                    <div style={estilos.contenedorAcciones}>
                      {cantidadCarrito > 0 ? (
                        <div style={estilos.selectorCantidad}>
                          <button onClick={() => restarCantidad(prod.id)} style={estilos.btnMenos}>-</button>
                          <span style={estilos.cantidadTexto}>{cantidadCarrito}</span>
                          <button
                            onClick={() => agregarAlCarrito(prod)}
                            disabled={!prod.es_preparado && cantidadCarrito >= stockDisponibleReal}
                            style={estilos.btnMas}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => agregarAlCarrito(prod)}
                          disabled={agotado}
                          style={agotado ? estilos.btnAgregarDeshabilitado : estilos.btnAgregar}
                        >
                          {agotado ? 'Agotado' : '+ Agregar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Hoja abierta={hojaCategorias} onCerrar={() => setHojaCategorias(false)} titulo="Categorías">
        <div className="hoja-lista">
          <button type="button" className={!categoriaActiva ? 'activo' : ''} onClick={() => elegirCategoria(null)}>Todo el menú</button>
          {categorias.map((cat) => (
            <button key={cat.id} type="button" className={String(cat.id) === categoriaActiva ? 'activo' : ''} onClick={() => elegirCategoria(cat.id)}>
              {cat.nombre}
              <span style={{ color: theme.gris500, fontSize: '0.85rem' }}>{(cat.productos || []).length}</span>
            </button>
          ))}
        </div>
      </Hoja>
    </div>
  );
};

const estilos = {
  contenedor: { padding: '20px 16px', maxWidth: '720px', margin: '0 auto', fontFamily: theme.fuente },
  header: { marginBottom: '18px' },
  titulo: { color: theme.gris900, margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800' },
  subtitulo: { color: theme.gris500, margin: 0, fontSize: '14px' },
  centrado: { textAlign: 'center', marginTop: '100px', fontFamily: theme.fuente },

  buscadorContenedor: { position: 'relative', marginBottom: '14px' },
  buscadorIcono: { position: 'absolute', left: '14px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: theme.gris500, pointerEvents: 'none' },
  buscadorInput: { width: '100%', boxSizing: 'border-box', minHeight: '48px', padding: '0 44px', borderRadius: '12px', border: `1px solid ${theme.gris300}`, fontSize: '16px', outline: 'none', backgroundColor: '#fff', color: '#111827' },
  buscadorLimpiar: { position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: theme.gris500, cursor: 'pointer' },
  chips: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', scrollbarWidth: 'none' },
  chip: { flexShrink: 0, minHeight: '38px', padding: '0 16px', borderRadius: '999px', border: `1px solid ${theme.gris300}`, backgroundColor: '#fff', color: theme.gris700, fontWeight: 600, fontSize: '14px' },
  chipActivo: { flexShrink: 0, minHeight: '38px', padding: '0 16px', borderRadius: '999px', border: `1px solid ${theme.verde}`, backgroundColor: theme.verde, color: '#fff', fontWeight: 700, fontSize: '14px' },

  seccionCategoria: { marginBottom: '28px' },
  tituloCategoria: { color: theme.gris900, fontSize: '17px', fontWeight: '800', borderLeft: `4px solid ${theme.verde}`, paddingLeft: '10px', marginBottom: '14px' },

  listaProductos: { display: 'flex', flexDirection: 'column', gap: '12px' },
  tarjetaProducto: { display: 'flex', alignItems: 'center', gap: '14px', border: `1px solid ${theme.gris300}`, borderRadius: '14px', padding: '14px', backgroundColor: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' },
  iconoProducto: { width: '52px', height: '52px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, color: '#fff', fontSize: '22px', fontWeight: '800', flexShrink: 0 },

  infoProducto: { flex: 1, minWidth: 0 },
  nombreProd: { margin: '0 0 2px 0', color: theme.gris900, fontSize: '15px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  descripcion: { fontSize: '12px', color: theme.gris500, margin: '0 0 8px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  filaPrecioBadge: { display: 'flex', alignItems: 'center', gap: '10px' },
  precio: { fontSize: '16px', fontWeight: '800', color: theme.verde },

  badgePreparado: { backgroundColor: theme.verdeClaro, color: theme.verde, padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold' },
  badgeDisponible: { backgroundColor: theme.azulClaro, color: theme.azul, padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold' },
  badgeAgotado: { backgroundColor: theme.rojoClaro, color: theme.rojo, padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold' },
  sinDatos: { textAlign: 'center', color: theme.gris500, fontStyle: 'italic' },

  contenedorAcciones: { flexShrink: 0 },
  btnAgregar: { minHeight: '40px', padding: '0 14px', backgroundColor: theme.amarillo, color: '#4a3400', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAgregarDeshabilitado: { minHeight: '40px', padding: '0 14px', backgroundColor: theme.gris300, color: theme.gris500, border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '12.5px', cursor: 'not-allowed', whiteSpace: 'nowrap' },
  selectorCantidad: { display: 'flex', alignItems: 'center', border: `1px solid ${theme.verde}`, borderRadius: '8px', overflow: 'hidden' },
  btnMenos: { width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.gris100, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' },
  btnMas: { width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.verdeClaro, color: theme.verde, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' },
  cantidadTexto: { fontWeight: 'bold', fontSize: '14px', color: theme.gris900, padding: '0 8px' },
};

export default MenuView;
