import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext();

const MAX_POR_PRODUCTO = 20;

const leerCarritoGuardado = () => {
  try {
    const guardado = localStorage.getItem('conalep_cart');
    const datos = guardado ? JSON.parse(guardado) : [];
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const { sesion } = useAuth();
  const { notificar } = useToast();

  // El carrito solo se recuerda entre visitas si la persona aceptó el almacenamiento opcional.
  const puedeGuardar = sesion.cookies;
  const [carrito, setCarrito] = useState(() => (puedeGuardar ? leerCarritoGuardado() : []));

  useEffect(() => {
    if (puedeGuardar) {
      localStorage.setItem('conalep_cart', JSON.stringify(carrito));
    } else {
      localStorage.removeItem('conalep_cart');
    }
  }, [carrito, puedeGuardar]);

  // Al cerrar sesión se vacía el carrito.
  useEffect(() => {
    if (!sesion.token) setCarrito([]);
  }, [sesion.token]);

  const agregarAlCarrito = (producto) => {
    const existe = carrito.find((item) => item.id === producto.id);

    if (existe) {
      if (existe.cantidad >= MAX_POR_PRODUCTO) {
        notificar(`Máximo ${MAX_POR_PRODUCTO} piezas por producto en un pedido.`, 'aviso');
        return;
      }
      if (!producto.es_preparado && existe.cantidad >= producto.stock_disponible) {
        notificar(`Solo hay ${producto.stock_disponible} disponibles de ${producto.nombre}.`, 'aviso');
        return;
      }
      setCarrito((previo) => previo.map((item) => (item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)));
      return;
    }

    if (!producto.es_preparado && producto.stock_disponible <= 0) {
      notificar(`${producto.nombre} está agotado por ahora.`, 'aviso');
      return;
    }
    setCarrito((previo) => [...previo, { ...producto, cantidad: 1 }]);
  };

  const restarCantidad = (productoId) => {
    setCarrito((previo) => {
      const existe = previo.find((item) => item.id === productoId);
      if (!existe) return previo;
      if (existe.cantidad === 1) return previo.filter((item) => item.id !== productoId);
      return previo.map((item) => (item.id === productoId ? { ...item, cantidad: item.cantidad - 1 } : item));
    });
  };

  const eliminarDelCarrito = (productoId) => setCarrito((previo) => previo.filter((item) => item.id !== productoId));
  const limpiarCarrito = () => setCarrito([]);

  const totalArticulos = carrito.reduce((suma, item) => suma + item.cantidad, 0);
  const montoTotal = carrito.reduce((suma, item) => suma + Number(item.precio) * item.cantidad, 0);

  return (
    <CartContext.Provider
      value={{ carrito, agregarAlCarrito, restarCantidad, eliminarDelCarrito, limpiarCarrito, totalArticulos, montoTotal }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
