from django.urls import path

from .views import (
    ActualizarEstadoPedidoView,
    AlertasStockCriticoView,
    CierreCajaDiarioView,
    CrearPedidoView,
    CrearProductoView,
    EstadoCafeteriaView,
    GestionPedidosCocinaView,
    HistorialPedidosAlumnoView,
    ListaCategoriasView,
    LoginView,
    LogoutView,
    MenuView,
    PerfilView,
    RegistrarLoteAlmacenView,
    RegistroView,
    ReenviarCodigoView,
    VerificarCorreoView,
)

urlpatterns = [
    # Público
    path('estado/', EstadoCafeteriaView.as_view(), name='estado-cafeteria'),

    # Cuentas
    path('auth/registro/', RegistroView.as_view(), name='registro'),
    path('auth/verificar/', VerificarCorreoView.as_view(), name='verificar-correo'),
    path('auth/reenviar-codigo/', ReenviarCodigoView.as_view(), name='reenviar-codigo'),
    path('auth/login/', LoginView.as_view(), name='login-api'),
    path('auth/logout/', LogoutView.as_view(), name='logout-api'),
    path('auth/perfil/', PerfilView.as_view(), name='perfil'),

    # Alumnos y docentes
    path('menu/', MenuView.as_view(), name='menu'),
    path('pedidos/crear/', CrearPedidoView.as_view(), name='crear-pedido'),
    path('pedidos/historial/', HistorialPedidosAlumnoView.as_view(), name='historial-pedidos'),

    # Cocina
    path('cocina/pedidos/', GestionPedidosCocinaView.as_view(), name='cocina-lista-pedidos'),
    path('cocina/pedidos/<int:pedido_id>/estado/', ActualizarEstadoPedidoView.as_view(), name='cocina-cambiar-estado'),
    path('cocina/alertas-stock/', AlertasStockCriticoView.as_view(), name='cocina-alertas-stock'),
    path('cocina/registrar-lote/', RegistrarLoteAlmacenView.as_view(), name='cocina-registrar-lote'),
    path('cocina/productos/crear/', CrearProductoView.as_view(), name='cocina-crear-producto'),
    path('cocina/categorias/', ListaCategoriasView.as_view(), name='cocina-lista-categorias'),
    path('cocina/cierre-caja/', CierreCajaDiarioView.as_view(), name='cocina-cierre-caja'),
]
