import datetime
import hashlib
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.timezone import localdate
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from . import cuentas
from .correo import ErrorDeCorreo
from .horario import CafeteriaAbierta, descripcion_horario, esta_abierto
from .mantenimiento import limpiar_pedidos_antiguos
from .models import Categoria, LoteAlmacen, Pedido, Producto
from .serializers import (
    CambiarEstadoPedidoSerializer,
    CategoriaSerializer,
    ImagenProductoSerializer,
    MenuCategoriaSerializer,
    PedidoSerializer,
    PerfilEdicionSerializer,
    PerfilSerializer,
    ProductoCrearSerializer,
    ProductoMenuSerializer,
    RegistroSerializer,
)

logger = logging.getLogger(__name__)


# =====================================================================
# Límites de intentos por cuenta/correo (anti fuerza bruta)
# =====================================================================
class _LimitePorCuenta(SimpleRateThrottle):
    """Limita por el correo/usuario enviado (no por IP: en la escuela todos comparten IP)."""

    def get_cache_key(self, request, view):
        datos = request.data if isinstance(request.data, dict) else {}
        ident = str(datos.get('email') or datos.get('username') or '').strip().lower()
        if not ident:
            return None
        huella = hashlib.sha256(ident.encode('utf-8')).hexdigest()
        return self.cache_format % {'scope': self.scope, 'ident': huella}


class LimiteLogin(_LimitePorCuenta):
    scope = 'login_cuenta'


class LimiteRegistro(_LimitePorCuenta):
    scope = 'registro_cuenta'


class LimiteCodigo(_LimitePorCuenta):
    scope = 'codigo_cuenta'


def _error(mensaje, codigo=None, http=status.HTTP_400_BAD_REQUEST, **extra):
    cuerpo = {'detail': mensaje}
    if codigo:
        cuerpo['codigo'] = codigo
    cuerpo.update(extra)
    return Response(cuerpo, status=http)


# =====================================================================
# Estado público (¿está abierta la cafetería?)
# =====================================================================
class EstadoCafeteriaView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'abierto': esta_abierto(),
            'horario': descripcion_horario(),
            'apertura': settings.HORA_APERTURA,
            'cierre': settings.HORA_CIERRE,
        })


# =====================================================================
# Cuentas: registro, verificación, login, perfil
# =====================================================================
class RegistroView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LimiteRegistro]

    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            usuario = cuentas.registrar(serializer.validated_data)
        except ErrorDeCorreo:
            logger.exception('No se pudo enviar el correo de verificación')
            return _error(
                'No pudimos enviar el correo de verificación. Intenta de nuevo en unos minutos.',
                'correo_fallo', status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        requiere = not usuario.is_active
        return Response({
            'mensaje': (
                'Te enviamos un código a tu correo. Escríbelo para activar tu cuenta.'
                if requiere else 'Cuenta creada. Ya puedes iniciar sesión.'
            ),
            'requiere_verificacion': requiere,
            'email': usuario.email,
        }, status=status.HTTP_201_CREATED)


class VerificarCorreoView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LimiteCodigo]

    MENSAJES = {
        'incorrecto': 'El código no es correcto. Revísalo e intenta otra vez.',
        'expirado': 'El código venció. Pide uno nuevo.',
        'bloqueado': 'Demasiados intentos. Pide un código nuevo.',
        'invalido': 'No encontramos una cuenta pendiente de verificar con ese correo.',
    }

    def post(self, request):
        resultado = cuentas.verificar_codigo(request.data.get('email'), request.data.get('codigo'))
        if resultado == 'ok':
            return Response({'mensaje': '¡Correo verificado! Ya puedes iniciar sesión.'})
        return _error(self.MENSAJES[resultado], resultado)


class ReenviarCodigoView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LimiteCodigo]

    def post(self, request):
        email = str(request.data.get('email') or '').strip()
        usuario = User.objects.filter(email__iexact=email).first() if email else None
        if usuario is not None and cuentas.cuenta_pendiente_de_verificar(usuario):
            try:
                cuentas.enviar_codigo_verificacion(usuario, usuario.alumno_perfil)
            except ErrorDeCorreo:
                logger.exception('No se pudo reenviar el código de verificación')
                return _error('No pudimos enviar el correo. Intenta más tarde.', 'correo_fallo',
                              status.HTTP_503_SERVICE_UNAVAILABLE)
        # Respuesta igual exista o no la cuenta (no revela qué correos están registrados).
        return Response({'mensaje': 'Si tu cuenta está pendiente, te enviamos un código nuevo.'})


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LimiteLogin]

    def post(self, request):
        ident = str(request.data.get('username') or request.data.get('email') or '').strip()
        password = request.data.get('password') or ''

        usuario = None
        if ident and password:
            candidato = None
            if '@' in ident:
                candidato = User.objects.filter(email__iexact=ident).first()
            if candidato is None:
                candidato = User.objects.filter(username__iexact=ident).first()
            if candidato is not None and candidato.check_password(password):
                usuario = candidato

        if usuario is None:
            return _error('Correo o contraseña incorrectos.', 'credenciales', status.HTTP_401_UNAUTHORIZED)

        if not usuario.is_active:
            if cuentas.cuenta_pendiente_de_verificar(usuario):
                return _error(
                    'Todavía no verificas tu correo. Escribe el código que te enviamos.',
                    'correo_no_verificado', status.HTTP_403_FORBIDDEN, email=usuario.email,
                )
            return _error('Tu cuenta está desactivada. Habla con la cooperativa.', 'desactivada',
                          status.HTTP_403_FORBIDDEN)

        if not usuario.is_staff and not esta_abierto():
            return _error(
                f'La cafetería está cerrada. Horario: {descripcion_horario()}.',
                'cerrado', status.HTTP_403_FORBIDDEN,
            )

        # Una sesión nueva reemplaza a la anterior.
        Token.objects.filter(user=usuario).delete()
        token = Token.objects.create(user=usuario)
        perfil = PerfilSerializer(usuario).data
        return Response({
            'token': token.key,
            'es_admin': usuario.is_staff,
            'nombre': perfil['nombre'] or usuario.username,
            'rol': perfil['rol'],
            'acepto_cookies': perfil['acepto_cookies'],
            'horas_sesion': settings.TOKEN_HORAS,
        })


class LogoutView(APIView):
    def post(self, request):
        if request.auth is not None:
            request.auth.delete()
        return Response({'mensaje': 'Sesión cerrada.'})


class PerfilView(APIView):
    """Ver, editar y borrar la propia cuenta."""

    def get(self, request):
        return Response(PerfilSerializer(request.user).data)

    def patch(self, request):
        serializer = PerfilEdicionSerializer(data=request.data, context={'usuario': request.user})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        datos = serializer.validated_data
        usuario = request.user
        perfil = getattr(usuario, 'alumno_perfil', None)

        with transaction.atomic():
            if 'nombre' in datos:
                usuario.first_name = datos['nombre']
            if 'password_nueva' in datos:
                usuario.set_password(datos['password_nueva'])
            usuario.save()
            if perfil is not None and 'matricula' in datos:
                perfil.matricula = datos['matricula'] or None
                perfil.save(update_fields=['matricula'])
            if perfil is not None and 'acepto_cookies' in datos:
                perfil.acepto_cookies = datos['acepto_cookies']
                perfil.save(update_fields=['acepto_cookies'])

        cambio_password = 'password_nueva' in datos
        if cambio_password:
            # Por seguridad se cierran las sesiones; hay que entrar con la contraseña nueva.
            Token.objects.filter(user=usuario).delete()

        return Response({
            'mensaje': 'Datos actualizados.' if not cambio_password else 'Contraseña actualizada. Inicia sesión de nuevo.',
            'perfil': PerfilSerializer(usuario).data,
            'sesion_cerrada': cambio_password,
        })

    def delete(self, request):
        usuario = request.user
        if usuario.is_staff:
            return _error('Las cuentas de cocina o administración no se pueden borrar desde aquí.',
                          'cuenta_staff', status.HTTP_403_FORBIDDEN)
        if not usuario.check_password(str(request.data.get('password') or '')):
            return _error('Tu contraseña no es correcta.', 'password', status.HTTP_400_BAD_REQUEST)

        perfil = getattr(usuario, 'alumno_perfil', None)
        if perfil is not None and Pedido.objects.filter(
            alumno=perfil, estado__in=['PENDIENTE', 'PREPARANDO', 'LISTO']
        ).exists():
            return _error('Tienes pedidos en curso. Recógelos antes de borrar tu cuenta.', 'pedidos_activos',
                          status.HTTP_409_CONFLICT)

        # Los pedidos pasan a "cuenta eliminada" (sin datos personales) y el usuario se borra por completo.
        usuario.delete()
        return Response({'mensaje': 'Tu cuenta y tus datos personales fueron eliminados.'})


class MenuView(APIView):
    # El menú ya NO es público: hay que iniciar sesión, y solo se ve en horario.
    permission_classes = [IsAuthenticated, CafeteriaAbierta]

    def get(self, request, *args, **kwargs):
        # Buscamos todas las categorías y traemos de golpe sus productos (optimizado)
        categorias = Categoria.objects.prefetch_related('productos').all()
        serializer = MenuCategoriaSerializer(categorias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



class CrearPedidoView(APIView):
    permission_classes = [IsAuthenticated, CafeteriaAbierta]

    def post(self, request):
        # Toda la lógica de apartado + candado ya está en PedidoSerializer.create
        # Aquí NO filtres por producto, porque Pedido no tiene ese campo
        serializer = PedidoSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"mensaje": "Pedido registrado correctamente en la cocina.", "pedido": serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HistorialPedidosAlumnoView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        alumno = getattr(request.user, 'alumno_perfil', None)
        if alumno is None:
            return Response({"error": "Perfil de alumno no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        pedidos = Pedido.objects.filter(alumno=alumno).prefetch_related('detalles__producto').order_by('-fecha')
        if request.query_params.get('activos'):
            pedidos = pedidos.filter(estado__in=['PENDIENTE', 'PREPARANDO', 'LISTO'])
        serializer = PedidoSerializer(pedidos[:50], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GestionPedidosCocinaView(APIView):
   
    permission_classes = [IsAdminUser]

    def get(self, request):
        # Una vez por hora (por proceso) se borran los pedidos de más de 15 días.
        if cache.add('limpieza_pedidos_antiguos', True, 3600):
            borrados = limpiar_pedidos_antiguos()
            if borrados:
                logger.info('Se borraron %s pedidos antiguos', borrados)

        limite = timezone.now() - timedelta(days=settings.DIAS_CONSERVAR_PEDIDOS)
        pedidos = (
            Pedido.objects.filter(fecha__gte=limite)
            .select_related('alumno__usuario')
            .prefetch_related('detalles__producto')
            .order_by('-fecha')
        )
        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActualizarEstadoPedidoView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, pedido_id):
        try:
            # ✅ FIX: Bloqueamos el pedido desde la vista, nadie más lo puede leer hasta que terminemos
            # Esto mata el doble PUT pegado de tu log
            with transaction.atomic():
                pedido = Pedido.objects.select_for_update().get(id=pedido_id)
                estado_anterior = pedido.estado

                serializer = CambiarEstadoPedidoSerializer(pedido, data=request.data, partial=True)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

                serializer.save()
                pedido.refresh_from_db()

                mensajes = {
                    'PREPARANDO': f"¡Pedido #{pedido.id} ahora está en preparación en la cocina!",
                    'LISTO': f"¡Pedido #{pedido.id} está listo! El alumno verá el aviso en su pantalla.",
                    'ENTREGADO': f"¡Pedido #{pedido.id} entregado con éxito! Se descontó el inventario (PEPS)."
                }
                msg = mensajes.get(pedido.estado, f"Pedido #{pedido.id} actualizado a {pedido.estado}.")

                return Response({
                    "mensaje": msg,
                    "pedido_id": pedido.id,
                    "estado_anterior": estado_anterior,
                    "nuevo_estado": pedido.estado,
                    "pago_confirmado": pedido.pago_confirmado,
                    "pedido": CambiarEstadoPedidoSerializer(pedido).data
                }, status=status.HTTP_200_OK)
        except Pedido.DoesNotExist:
            return Response({"error": "El pedido solicitado no existe."}, status=status.HTTP_404_NOT_FOUND)


class AlertasStockCriticoView(APIView):
   
    permission_classes = [IsAdminUser]

    def get(self, request):
        # Al usar localdate directamente, Python ya no se confunde con ninguna otra librería
        hoy = localdate()
        productos = Producto.objects.filter(es_preparado=False)
        productos_en_alerta = []
        
        for producto in productos:
            if producto.stock_actual <= producto.stock_minimo_alerta:
                serializer = ProductoMenuSerializer(producto)
                datos_producto = serializer.data
                datos_producto['stock_minimo_alerta'] = producto.stock_minimo_alerta
                productos_en_alerta.append(datos_producto)
                
        return Response({
            "conteo_alertas": len(productos_en_alerta),
            "productos_criticos": productos_en_alerta
        }, status=status.HTTP_200_OK)

# Asegúrate de importar Sum al inicio de tu archivo views.py si no lo tienes:
# 

# =====================================================================
# 🆕 ALTA DE PRODUCTOS NUEVOS (no requiere entrar al admin de Django)
# =====================================================================
class ActualizarImagenProductoView(APIView):
    """La cocina cambia (o quita, con texto vacío) la foto de un producto."""

    permission_classes = [IsAdminUser]

    def patch(self, request, producto_id):
        producto = Producto.objects.filter(pk=producto_id).first()
        if producto is None:
            return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ImagenProductoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        producto.imagen_url = serializer.validated_data['imagen_url']
        producto.save(update_fields=['imagen_url'])
        return Response({"mensaje": "Foto actualizada.", "imagen_url": producto.imagen_url})


class CrearProductoView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = ProductoCrearSerializer(data=request.data)
        if serializer.is_valid():
            producto = serializer.save()
            return Response(
                {
                    "mensaje": f"¡'{producto.nombre}' se agregó al catálogo con éxito!",
                    "producto": ProductoCrearSerializer(producto).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListaCategoriasView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        categorias = Categoria.objects.all().order_by('nombre')
        serializer = CategoriaSerializer(categorias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# =====================================================================
# 📦 REGISTRO DE LOTES DE ALMACÉN (PEPS)
# =====================================================================
class RegistrarLoteAlmacenView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        producto_id = request.data.get('producto_id')
        cantidad = request.data.get('cantidad')
        fecha_caducidad_str = request.data.get('fecha_caducidad')

        if not all([producto_id, cantidad, fecha_caducidad_str]):
            return Response({"error": "Todos los campos (producto, cantidad, fecha_caducidad) son obligatorios."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            producto = Producto.objects.get(id=producto_id)
            if producto.es_preparado:
                return Response({"error": "Los productos preparados no manejan lotes físicos en almacén."}, status=status.HTTP_400_BAD_REQUEST)
            
            if int(cantidad) <= 0:
                return Response({"error": "La cantidad ingresada debe ser mayor a cero."}, status=status.HTTP_400_BAD_REQUEST)

            # Valida el formato de la fecha (AAAA-MM-DD) antes de guardar
            fecha_caducidad = datetime.date.fromisoformat(str(fecha_caducidad_str))

            nuevo_lote = LoteAlmacen.objects.create(
                producto=producto,
                cantidad=int(cantidad),
                fecha_caducidad=fecha_caducidad
            )

            return Response({
                "mensaje": f"¡Lote registrado con éxito! Se añadieron {cantidad} unidades a '{producto.nombre}'.",
                "lote_id": nuevo_lote.id
            }, status=status.HTTP_201_CREATED)

        except Producto.DoesNotExist:
            return Response({"error": "El producto seleccionado no existe."}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, TypeError):
            return Response({"error": "Revisa la cantidad y la fecha de caducidad (AAAA-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)


# =====================================================================
# 💵 AUDITORÍA FINANCIERA: CIERRE DE CAJA DIARIO
# =====================================================================

class CierreCajaDiarioView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        hoy = localdate()
        
        pedidos_hoy = Pedido.objects.filter(fecha__date=hoy, pago_confirmado=True)
        
        # FIX: Todo en Decimal, no en float. Si no hay ventas, Decimal('0.00')
        efectivo_real = pedidos_hoy.filter(metodo_pago='EFECTIVO').aggregate(total_suma=Sum('total'))['total_suma'] or Decimal('0.00')
        
        linea_real = pedidos_hoy.filter(metodo_pago='LINEA').aggregate(total_suma=Sum('total'))['total_suma'] or Decimal('0.00')
        tarjeta_real = pedidos_hoy.filter(metodo_pago='TARJETA').aggregate(total_suma=Sum('total'))['total_suma'] or Decimal('0.00')

        conteo_transacciones = pedidos_hoy.count()

        total_ingresos = efectivo_real + linea_real + tarjeta_real

        return Response({
            "fecha": hoy,
            "conteo_transacciones": conteo_transacciones,
            "auditoria": {
                "efectivo_en_caja_fisica": float(efectivo_real),
                "pagos_en_linea_banco": float(linea_real),
                "pagos_con_tarjeta": float(tarjeta_real),
                "total_ingresos_del_dia": float(total_ingresos)
            }
        }, status=status.HTTP_200_OK)