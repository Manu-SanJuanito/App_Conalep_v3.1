import API from './api';

const pedidoService = {
  /**
   * Envía el pedido. `quiereTicket` lo decide el usuario al pagar;
   * el ticket solo lo imprime la cocina.
   */
  crearPedido: async (carritoItems, metodoPago = 'EFECTIVO', quiereTicket = false) => {
    const payload = {
      metodo_pago: metodoPago,
      quiere_ticket: quiereTicket,
      detalles: carritoItems.map((item) => ({ producto: item.id, cantidad: item.cantidad })),
    };
    const respuesta = await API.post('/pedidos/crear/', payload);
    // El backend responde { mensaje, pedido }; devolvemos el pedido directo.
    return respuesta.data.pedido;
  },

  misPedidos: async () => (await API.get('/pedidos/historial/')).data,

  pedidosActivos: async () => (await API.get('/pedidos/historial/?activos=1')).data,
};

export default pedidoService;
