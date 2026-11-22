import datetime
import re
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from inventario import horario
from inventario.correo import ErrorDeCorreo
from inventario.models import Alumno, Categoria, CodigoDocente, LoteAlmacen, Pedido, Producto

CLAVE = 'Cafeteria#Conalep2026'


def crear_cuenta(email='ana@hgo.conalep.edu.mx', rol='ALUMNO', nombre='Ana', **extra):
    usuario = User.objects.create_user(username=email, email=email, password=CLAVE, first_name=nombre, **extra)
    Alumno.objects.create(usuario=usuario, rol=rol)
    return usuario


def cliente_con_token(usuario):
    token, _ = Token.objects.get_or_create(user=usuario)
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return cliente


def datos_registro(**cambios):
    datos = {
        'nombre': 'Ana',
        'email': 'ana@hgo.conalep.edu.mx',
        'password': CLAVE,
        'password_confirmacion': CLAVE,
        'rol': 'ALUMNO',
        'acepto_privacidad': True,
        'acepto_cookies': False,
    }
    datos.update(cambios)
    return datos


@override_settings(HORARIO_ACTIVO=False, REQUIRE_EMAIL_VERIFICATION=True)
class PruebasBase(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()


class RegistroYVerificacionTests(PruebasBase):
    def registrar(self, **cambios):
        with mock.patch('inventario.cuentas.enviar_correo') as correo:
            respuesta = self.cliente.post('/api/auth/registro/', datos_registro(**cambios), format='json')
        return respuesta, correo

    def test_registro_y_verificacion_completa(self):
        respuesta, correo = self.registrar()
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertTrue(respuesta.data['requiere_verificacion'])

        usuario = User.objects.get(email='ana@hgo.conalep.edu.mx')
        self.assertFalse(usuario.is_active)
        self.assertIsNotNone(usuario.alumno_perfil.acepto_privacidad_en)

        texto = correo.call_args[0][2]
        codigo = re.search(r'\b(\d{6})\b', texto).group(1)

        malo = self.cliente.post('/api/auth/verificar/', {'email': usuario.email, 'codigo': '000000' if codigo != '000000' else '111111'}, format='json')
        self.assertEqual(malo.status_code, 400)

        bueno = self.cliente.post('/api/auth/verificar/', {'email': usuario.email, 'codigo': codigo}, format='json')
        self.assertEqual(bueno.status_code, 200, bueno.data)
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)

        login = self.cliente.post('/api/auth/login/', {'username': usuario.email, 'password': CLAVE}, format='json')
        self.assertEqual(login.status_code, 200, login.data)
        self.assertIn('token', login.data)
        self.assertFalse(login.data['es_admin'])

    def test_login_antes_de_verificar_avisa(self):
        self.registrar()
        login = self.cliente.post('/api/auth/login/', {'username': 'ana@hgo.conalep.edu.mx', 'password': CLAVE}, format='json')
        self.assertEqual(login.status_code, 403)
        self.assertEqual(login.data['codigo'], 'correo_no_verificado')

    def test_codigo_se_bloquea_tras_5_intentos(self):
        _, correo = self.registrar()
        codigo = re.search(r'\b(\d{6})\b', correo.call_args[0][2]).group(1)
        falso = '000000' if codigo != '000000' else '111111'
        for _ in range(5):
            self.cliente.post('/api/auth/verificar/', {'email': 'ana@hgo.conalep.edu.mx', 'codigo': falso}, format='json')
        ultimo = self.cliente.post('/api/auth/verificar/', {'email': 'ana@hgo.conalep.edu.mx', 'codigo': codigo}, format='json')
        self.assertEqual(ultimo.status_code, 400)
        self.assertEqual(ultimo.data['codigo'], 'bloqueado')

    def test_rechaza_dominio_distinto(self):
        respuesta, _ = self.registrar(email='ana@gmail.com')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('email', respuesta.data)

    def test_rechaza_contrasena_debil(self):
        respuesta, _ = self.registrar(password='12345678', password_confirmacion='12345678')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password', respuesta.data)

    def test_rechaza_contrasenas_distintas(self):
        respuesta, _ = self.registrar(password_confirmacion=CLAVE + 'x')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password_confirmacion', respuesta.data)

    def test_exige_aceptar_privacidad(self):
        respuesta, _ = self.registrar(acepto_privacidad=False)
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('acepto_privacidad', respuesta.data)

    def test_rechaza_correo_con_mas_y_nombre_con_simbolos(self):
        r1, _ = self.registrar(email='ana+1@hgo.conalep.edu.mx')
        self.assertEqual(r1.status_code, 400)
        r2, _ = self.registrar(nombre='<script>alert(1)</script>')
        self.assertEqual(r2.status_code, 400)

    def test_correo_duplicado(self):
        crear_cuenta()
        respuesta, _ = self.registrar()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('email', respuesta.data)

    def test_reintentar_registro_sin_verificar_reemplaza_la_cuenta(self):
        self.registrar()
        respuesta, _ = self.registrar(nombre='Ana María')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(User.objects.filter(email='ana@hgo.conalep.edu.mx').count(), 1)
        self.assertEqual(User.objects.get(email='ana@hgo.conalep.edu.mx').first_name, 'Ana María')

    def test_si_falla_el_correo_no_queda_cuenta(self):
        with mock.patch('inventario.cuentas.enviar_correo', side_effect=ErrorDeCorreo('falló')):
            respuesta = self.cliente.post('/api/auth/registro/', datos_registro(), format='json')
        self.assertEqual(respuesta.status_code, 503)
        self.assertFalse(User.objects.filter(email='ana@hgo.conalep.edu.mx').exists())

    @override_settings(REQUIRE_EMAIL_VERIFICATION=False)
    def test_sin_verificacion_la_cuenta_queda_activa(self):
        respuesta, correo = self.registrar()
        self.assertEqual(respuesta.status_code, 201)
        self.assertFalse(respuesta.data['requiere_verificacion'])
        self.assertTrue(User.objects.get(email='ana@hgo.conalep.edu.mx').is_active)
        correo.assert_not_called()


class DocentesTests(PruebasBase):
    def test_docente_necesita_codigo_valido_y_de_un_solo_uso(self):
        codigo = CodigoDocente.objects.create(codigo='DOC-ABC234')
        datos = datos_registro(email='maestro@hgo.conalep.edu.mx', nombre='Maestro', rol='DOCENTE')

        sin_codigo = self.cliente.post('/api/auth/registro/', datos, format='json')
        self.assertEqual(sin_codigo.status_code, 400)

        malo = self.cliente.post('/api/auth/registro/', {**datos, 'codigo_docente': 'DOC-NOEXISTE'}, format='json')
        self.assertEqual(malo.status_code, 400)

        with mock.patch('inventario.cuentas.enviar_correo'):
            bueno = self.cliente.post('/api/auth/registro/', {**datos, 'codigo_docente': ' doc-abc234 '}, format='json')
        self.assertEqual(bueno.status_code, 201, bueno.data)
        codigo.refresh_from_db()
        self.assertTrue(codigo.usado)

        otro = self.cliente.post(
            '/api/auth/registro/',
            {**datos, 'email': 'otro@hgo.conalep.edu.mx', 'codigo_docente': 'DOC-ABC234'},
            format='json',
        )
        self.assertEqual(otro.status_code, 400)
        self.assertIn('codigo_docente', otro.data)

    def test_cuenta_sin_verificar_libera_su_codigo_al_reintentar(self):
        CodigoDocente.objects.create(codigo='DOC-ABC234')
        datos = datos_registro(email='maestro@hgo.conalep.edu.mx', rol='DOCENTE', codigo_docente='DOC-ABC234')
        with mock.patch('inventario.cuentas.enviar_correo'):
            self.assertEqual(self.cliente.post('/api/auth/registro/', datos, format='json').status_code, 201)
            self.assertEqual(self.cliente.post('/api/auth/registro/', datos, format='json').status_code, 201)

    def test_comando_genera_codigos(self):
        salida = StringIO()
        call_command('generar_codigos_docente', '3', stdout=salida)
        self.assertEqual(CodigoDocente.objects.count(), 3)


class LoginYSesionTests(PruebasBase):
    def test_login_con_correo_o_con_usuario_antiguo(self):
        usuario = User.objects.create_user(username='Manolo', email='alumno@hgo.conalep.edu.mx', password=CLAVE, first_name='Manolo')
        Alumno.objects.create(usuario=usuario, matricula='172080011-5')
        por_correo = self.cliente.post('/api/auth/login/', {'username': 'ALUMNO@hgo.conalep.edu.mx', 'password': CLAVE}, format='json')
        por_usuario = self.cliente.post('/api/auth/login/', {'username': 'Manolo', 'password': CLAVE}, format='json')
        self.assertEqual(por_correo.status_code, 200)
        self.assertEqual(por_usuario.status_code, 200)

    def test_contrasena_incorrecta(self):
        crear_cuenta()
        r = self.cliente.post('/api/auth/login/', {'username': 'ana@hgo.conalep.edu.mx', 'password': 'mala'}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_es_admin_viene_del_servidor(self):
        # Un usuario con "admin" en el nombre pero SIN permisos de staff no es admin.
        User.objects.create_user(username='administrador_1', email='a1@hgo.conalep.edu.mx', password=CLAVE)
        personal = User.objects.create_user(username='cocina', password=CLAVE, is_staff=True)
        r1 = self.cliente.post('/api/auth/login/', {'username': 'administrador_1', 'password': CLAVE}, format='json')
        r2 = self.cliente.post('/api/auth/login/', {'username': personal.username, 'password': CLAVE}, format='json')
        self.assertFalse(r1.data['es_admin'])
        self.assertTrue(r2.data['es_admin'])

    def test_limite_de_intentos_por_cuenta(self):
        crear_cuenta()
        codigos = []
        for _ in range(12):
            r = self.cliente.post('/api/auth/login/', {'username': 'ana@hgo.conalep.edu.mx', 'password': 'mala'}, format='json')
            codigos.append(r.status_code)
        self.assertIn(429, codigos)

    def test_token_expira(self):
        usuario = crear_cuenta()
        cliente = cliente_con_token(usuario)
        self.assertEqual(cliente.get('/api/auth/perfil/').status_code, 200)
        Token.objects.filter(user=usuario).update(created=timezone.now() - datetime.timedelta(hours=13))
        self.assertEqual(cliente.get('/api/auth/perfil/').status_code, 401)

    def test_logout_borra_el_token(self):
        usuario = crear_cuenta()
        cliente = cliente_con_token(usuario)
        self.assertEqual(cliente.post('/api/auth/logout/').status_code, 200)
        self.assertFalse(Token.objects.filter(user=usuario).exists())


class HorarioTests(TestCase):
    def setUp(self):
        cache.clear()

    def momento(self, dia, hora, minuto=0):
        # 2026-11-16 es lunes
        return timezone.make_aware(datetime.datetime(2026, 11, dia, hora, minuto))

    @override_settings(HORARIO_ACTIVO=True)
    def test_horario_lunes_a_viernes_7_a_18(self):
        self.assertTrue(horario.esta_abierto(self.momento(16, 7, 0)))
        self.assertTrue(horario.esta_abierto(self.momento(16, 17, 59)))
        self.assertFalse(horario.esta_abierto(self.momento(16, 6, 59)))
        self.assertFalse(horario.esta_abierto(self.momento(16, 18, 0)))
        self.assertTrue(horario.esta_abierto(self.momento(20, 12)))   # viernes
        self.assertFalse(horario.esta_abierto(self.momento(21, 12)))  # sábado
        self.assertFalse(horario.esta_abierto(self.momento(22, 12)))  # domingo

    @override_settings(HORARIO_ACTIVO=True)
    def test_cerrado_bloquea_a_alumnos_pero_no_al_personal(self):
        alumno = crear_cuenta()
        personal = User.objects.create_user(username='cocina', password=CLAVE, is_staff=True)
        with mock.patch('inventario.horario.esta_abierto', return_value=False), \
                mock.patch('inventario.views.esta_abierto', return_value=False):
            login = APIClient().post('/api/auth/login/', {'username': alumno.email, 'password': CLAVE}, format='json')
            self.assertEqual(login.status_code, 403)
            self.assertEqual(login.data['codigo'], 'cerrado')

            login_staff = APIClient().post('/api/auth/login/', {'username': 'cocina', 'password': CLAVE}, format='json')
            self.assertEqual(login_staff.status_code, 200)

            # Con token de antes del cierre, el alumno tampoco puede ver el menú ni pedir
            self.assertEqual(cliente_con_token(alumno).get('/api/menu/').status_code, 403)
            self.assertEqual(cliente_con_token(personal).get('/api/menu/').status_code, 200)

    @override_settings(HORARIO_ACTIVO=True)
    def test_endpoint_estado_es_publico(self):
        r = APIClient().get('/api/estado/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('abierto', r.data)
        self.assertIn('lunes a viernes', r.data['horario'])


@override_settings(HORARIO_ACTIVO=False)
class MenuYPedidosTests(PruebasBase):
    def setUp(self):
        super().setUp()
        self.alumno = crear_cuenta()
        self.docente = crear_cuenta(email='maestro@hgo.conalep.edu.mx', rol='DOCENTE', nombre='Maestro')
        self.personal = User.objects.create_user(username='cocina', password=CLAVE, is_staff=True)
        categoria = Categoria.objects.create(nombre='Snacks')
        self.producto = Producto.objects.create(nombre='Galletas', precio=Decimal('15.00'), categoria=categoria)
        self.lote = LoteAlmacen.objects.create(
            producto=self.producto, cantidad=10,
            fecha_caducidad=timezone.localdate() + datetime.timedelta(days=10),
        )

    def pedido(self, usuario, cantidad=2, metodo='EFECTIVO', ticket=False):
        return cliente_con_token(usuario).post('/api/pedidos/crear/', {
            'metodo_pago': metodo,
            'quiere_ticket': ticket,
            'detalles': [{'producto': self.producto.id, 'cantidad': cantidad}],
        }, format='json')

    def test_menu_ya_no_es_publico(self):
        self.assertEqual(APIClient().get('/api/menu/').status_code, 401)
        self.assertEqual(cliente_con_token(self.alumno).get('/api/menu/').status_code, 200)

    def test_pedido_basico_con_ticket_y_codigo(self):
        r = self.pedido(self.alumno, ticket=True)
        self.assertEqual(r.status_code, 201, r.data)
        pedido = Pedido.objects.get()
        self.assertTrue(pedido.quiere_ticket)
        self.assertFalse(pedido.ticket_emitido)
        self.assertEqual(len(pedido.codigo_recogida), 6)
        self.assertEqual(pedido.total, Decimal('30.00'))

    def test_alumno_no_puede_pagar_con_tarjeta_pero_docente_si(self):
        self.assertEqual(self.pedido(self.alumno, metodo='TARJETA').status_code, 400)
        self.assertEqual(self.pedido(self.alumno, metodo='LINEA').status_code, 400)
        self.assertEqual(self.pedido(self.docente, metodo='TARJETA').status_code, 201)

    def test_no_se_puede_pedir_mas_del_stock(self):
        self.assertEqual(self.pedido(self.alumno, cantidad=8).status_code, 201)
        r = self.pedido(self.docente, cantidad=5)  # solo quedan 2 sin apartar
        self.assertEqual(r.status_code, 400)
        self.assertIn('stock', r.data)

    def test_cantidad_maxima_por_producto(self):
        self.assertEqual(self.pedido(self.alumno, cantidad=21).status_code, 400)

    def test_el_alumno_no_puede_marcar_su_pedido_como_pagado_ni_ticket_emitido(self):
        r = cliente_con_token(self.alumno).post('/api/pedidos/crear/', {
            'metodo_pago': 'EFECTIVO', 'pago_confirmado': True, 'ticket_emitido': True, 'estado': 'ENTREGADO',
            'detalles': [{'producto': self.producto.id, 'cantidad': 1}],
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        pedido = Pedido.objects.get()
        self.assertFalse(pedido.pago_confirmado)
        self.assertFalse(pedido.ticket_emitido)
        self.assertEqual(pedido.estado, 'PENDIENTE')

    def test_solo_personal_cambia_estados_y_hay_candado_de_cobro(self):
        self.pedido(self.alumno)
        pedido = Pedido.objects.get()
        url = f'/api/cocina/pedidos/{pedido.id}/estado/'

        self.assertEqual(cliente_con_token(self.alumno).put(url, {'estado': 'LISTO'}, format='json').status_code, 403)

        cocina = cliente_con_token(self.personal)
        self.assertEqual(cocina.put(url, {'estado': 'ENTREGADO'}, format='json').status_code, 400)
        self.assertEqual(cocina.put(url, {'estado': 'LISTO'}, format='json').status_code, 200)
        ok = cocina.put(url, {'estado': 'ENTREGADO', 'pago_confirmado': True, 'ticket_emitido': True}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)

        self.lote.refresh_from_db()
        self.assertEqual(self.lote.cantidad, 8)
        pedido.refresh_from_db()
        self.assertTrue(pedido.ticket_emitido)

    def test_historial_y_activos(self):
        self.pedido(self.alumno)
        cliente = cliente_con_token(self.alumno)
        self.assertEqual(len(cliente.get('/api/pedidos/historial/').data), 1)
        self.assertEqual(len(cliente.get('/api/pedidos/historial/?activos=1').data), 1)
        Pedido.objects.update(estado='ENTREGADO')
        self.assertEqual(len(cliente.get('/api/pedidos/historial/?activos=1').data), 0)

    def test_cierre_de_caja_incluye_tarjeta(self):
        self.pedido(self.docente, metodo='TARJETA')
        Pedido.objects.update(pago_confirmado=True)
        r = cliente_con_token(self.personal).get('/api/cocina/cierre-caja/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['auditoria']['pagos_con_tarjeta'], 30.0)
        self.assertEqual(r.data['auditoria']['total_ingresos_del_dia'], 30.0)

    def test_pedidos_de_mas_de_15_dias_se_borran(self):
        self.pedido(self.alumno)
        viejo = Pedido.objects.get()
        Pedido.objects.filter(pk=viejo.pk).update(fecha=timezone.now() - datetime.timedelta(days=16))
        self.pedido(self.docente)
        self.assertEqual(Pedido.objects.count(), 2)

        r = cliente_con_token(self.personal).get('/api/cocina/pedidos/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_comando_de_limpieza(self):
        self.pedido(self.alumno)
        Pedido.objects.update(fecha=timezone.now() - datetime.timedelta(days=20))
        call_command('limpiar_pedidos_antiguos', stdout=StringIO())
        self.assertEqual(Pedido.objects.count(), 0)


@override_settings(HORARIO_ACTIVO=False)
class PerfilTests(PruebasBase):
    def setUp(self):
        super().setUp()
        self.usuario = crear_cuenta()
        self.cliente = cliente_con_token(self.usuario)

    def test_ver_y_editar_datos(self):
        r = self.cliente.get('/api/auth/perfil/')
        self.assertEqual(r.data['nombre'], 'Ana')
        self.assertEqual(r.data['rol'], 'ALUMNO')

        r = self.cliente.patch('/api/auth/perfil/', {'nombre': 'Ana Lu', 'matricula': '12345', 'acepto_cookies': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.alumno_perfil.acepto_cookies)
        self.assertEqual(self.usuario.first_name, 'Ana Lu')
        self.assertEqual(self.usuario.alumno_perfil.matricula, '12345')

    def test_matricula_duplicada(self):
        otro = crear_cuenta(email='otro@hgo.conalep.edu.mx', nombre='Otro')
        otro.alumno_perfil.matricula = '999'
        otro.alumno_perfil.save()
        r = self.cliente.patch('/api/auth/perfil/', {'matricula': '999'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cambiar_contrasena_exige_la_actual_y_cierra_sesiones(self):
        malo = self.cliente.patch('/api/auth/perfil/', {'password_actual': 'x', 'password_nueva': 'OtraClave#2027'}, format='json')
        self.assertEqual(malo.status_code, 400)
        debil = self.cliente.patch('/api/auth/perfil/', {'password_actual': CLAVE, 'password_nueva': '12345678'}, format='json')
        self.assertEqual(debil.status_code, 400)
        bueno = self.cliente.patch('/api/auth/perfil/', {'password_actual': CLAVE, 'password_nueva': 'OtraClave#2027'}, format='json')
        self.assertEqual(bueno.status_code, 200, bueno.data)
        self.assertFalse(Token.objects.filter(user=self.usuario).exists())
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password('OtraClave#2027'))

    def test_borrar_cuenta_pide_contrasena(self):
        r = self.cliente.delete('/api/auth/perfil/', {'password': 'mala'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.usuario.pk).exists())

    def test_borrar_cuenta_conserva_pedidos_sin_datos_personales(self):
        categoria = Categoria.objects.create(nombre='Snacks')
        producto = Producto.objects.create(nombre='Torta', precio=Decimal('30.00'), categoria=categoria, es_preparado=True)
        self.cliente.post('/api/pedidos/crear/', {'metodo_pago': 'EFECTIVO', 'detalles': [{'producto': producto.id, 'cantidad': 1}]}, format='json')

        con_pedido = self.cliente.delete('/api/auth/perfil/', {'password': CLAVE}, format='json')
        self.assertEqual(con_pedido.status_code, 409)

        Pedido.objects.update(estado='ENTREGADO')
        r = self.cliente.delete('/api/auth/perfil/', {'password': CLAVE}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(User.objects.filter(pk=self.usuario.pk).exists())
        self.assertFalse(Alumno.objects.exists())
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertIsNone(Pedido.objects.get().alumno)

    def test_personal_no_puede_borrarse_desde_la_api(self):
        personal = User.objects.create_user(username='cocina', password=CLAVE, is_staff=True)
        r = cliente_con_token(personal).delete('/api/auth/perfil/', {'password': CLAVE}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(User.objects.filter(pk=personal.pk).exists())


@override_settings(HORARIO_ACTIVO=False)
class ImagenesProductoTests(PruebasBase):
    URL_OK = 'https://res.cloudinary.com/demo/image/upload/v1/cafeteria/galletas.jpg'

    def setUp(self):
        super().setUp()
        self.personal = User.objects.create_user(username='cocina', password=CLAVE, is_staff=True)
        self.alumno = crear_cuenta()
        self.categoria = Categoria.objects.create(nombre='Snacks')
        self.producto = Producto.objects.create(nombre='Galletas', precio=Decimal('15.00'), categoria=self.categoria)

    def test_cocina_pone_y_quita_la_foto(self):
        cocina = cliente_con_token(self.personal)
        url = f'/api/cocina/productos/{self.producto.id}/imagen/'
        r = cocina.patch(url, {'imagen_url': self.URL_OK}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.imagen_url, self.URL_OK)

        quitar = cocina.patch(url, {'imagen_url': ''}, format='json')
        self.assertEqual(quitar.status_code, 200)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.imagen_url, '')

    def test_rechaza_direcciones_de_otros_sitios_o_sin_https(self):
        cocina = cliente_con_token(self.personal)
        url = f'/api/cocina/productos/{self.producto.id}/imagen/'
        for malo in ['https://sitio-malo.com/a.jpg', 'http://res.cloudinary.com/a.jpg', 'javascript:alert(1)']:
            self.assertEqual(cocina.patch(url, {'imagen_url': malo}, format='json').status_code, 400, malo)

    def test_un_alumno_no_puede_cambiar_fotos(self):
        r = cliente_con_token(self.alumno).patch(
            f'/api/cocina/productos/{self.producto.id}/imagen/', {'imagen_url': self.URL_OK}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_el_menu_incluye_la_imagen(self):
        Producto.objects.filter(pk=self.producto.pk).update(imagen_url=self.URL_OK)
        r = cliente_con_token(self.alumno).get('/api/menu/')
        self.assertEqual(r.status_code, 200)
        productos = [p for cat in r.data for p in cat['productos']]
        self.assertEqual(productos[0]['imagen_url'], self.URL_OK)

    def test_crear_producto_con_imagen(self):
        cocina = cliente_con_token(self.personal)
        r = cocina.post('/api/cocina/productos/crear/', {
            'nombre': 'Jugo', 'precio': '20.00', 'categoria_nombre': 'Bebidas', 'es_preparado': True,
            'stock_minimo_alerta': 5, 'imagen_url': self.URL_OK,
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Producto.objects.get(nombre='Jugo').imagen_url, self.URL_OK)
