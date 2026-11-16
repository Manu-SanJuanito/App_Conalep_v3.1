"""Lógica de cuentas: registro, verificación de correo, códigos de docente."""
import hmac
import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .correo import enviar_correo
from .models import Alumno, CodigoDocente

logger = logging.getLogger(__name__)

MINUTOS_VIGENCIA_CODIGO = 15
MAX_INTENTOS_CODIGO = 5


def _hash_codigo(codigo):
    return hmac.new(settings.SECRET_KEY.encode(), codigo.encode(), hashlib.sha256).hexdigest()


def normalizar_codigo_docente(texto):
    return (texto or '').strip().upper()


def generar_codigos_docente(cantidad, nota=''):
    """Crea `cantidad` códigos de un solo uso (sin caracteres confusos como 0/O o 1/I)."""
    alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    creados = []
    while len(creados) < cantidad:
        codigo = 'DOC-' + ''.join(secrets.choice(alfabeto) for _ in range(6))
        if CodigoDocente.objects.filter(codigo=codigo).exists():
            continue
        creados.append(CodigoDocente.objects.create(codigo=codigo, nota=nota))
    return creados


def enviar_codigo_verificacion(usuario, perfil):
    """Genera un código de 6 dígitos, guarda su hash y lo envía al correo. Lanza ErrorDeCorreo si falla."""
    codigo = ''.join(secrets.choice('0123456789') for _ in range(6))
    perfil.codigo_hash = _hash_codigo(codigo)
    perfil.codigo_expira = timezone.now() + timedelta(minutes=MINUTOS_VIGENCIA_CODIGO)
    perfil.codigo_intentos = 0
    perfil.save(update_fields=['codigo_hash', 'codigo_expira', 'codigo_intentos'])

    enviar_correo(
        usuario.email,
        'Tu código de verificación - Cafetería CONALEP',
        (
            f"Hola {usuario.first_name},\n\n"
            f"Tu código de verificación es: {codigo}\n\n"
            f"Vence en {MINUTOS_VIGENCIA_CODIGO} minutos. Si no fuiste tú, ignora este mensaje.\n\n"
            "Cafetería CONALEP"
        ),
    )


def cuenta_pendiente_de_verificar(usuario):
    """True si el usuario se registró pero nunca confirmó su correo."""
    perfil = getattr(usuario, 'alumno_perfil', None)
    return bool(perfil) and not usuario.is_active and not perfil.correo_verificado


def eliminar_cuenta_pendiente(usuario):
    """Borra una cuenta sin verificar y libera su código de docente (si usó uno)."""
    CodigoDocente.objects.filter(usado_por=usuario).update(usado_en=None, usado_por=None)
    usuario.delete()


@transaction.atomic
def registrar(datos):
    """
    Crea la cuenta. Si hay que verificar el correo, la deja inactiva y envía el código.
    Si el correo falla, lanza ErrorDeCorreo y TODO se revierte (no queda cuenta a medias).
    """
    email = datos['email']
    rol = datos['rol']

    previo = User.objects.filter(email__iexact=email).first()
    if previo is not None and cuenta_pendiente_de_verificar(previo):
        eliminar_cuenta_pendiente(previo)

    verificar = settings.REQUIRE_EMAIL_VERIFICATION
    usuario = User.objects.create_user(
        username=email,
        email=email,
        password=datos['password'],
        first_name=datos['nombre'],
        is_active=not verificar,
    )
    ahora = timezone.now()
    perfil = Alumno.objects.create(
        usuario=usuario,
        rol=rol,
        acepto_privacidad_en=ahora,
        acepto_privacidad_version=settings.VERSION_AVISO_PRIVACIDAD,
        acepto_cookies=bool(datos.get('acepto_cookies', False)),
        correo_verificado=not verificar,
    )

    if rol == 'DOCENTE':
        CodigoDocente.objects.filter(pk=datos['_codigo_docente_id']).update(usado_en=ahora, usado_por=usuario)

    if verificar:
        enviar_codigo_verificacion(usuario, perfil)

    return usuario


def verificar_codigo(email, codigo):
    """Devuelve 'ok', 'incorrecto', 'expirado', 'bloqueado' o 'invalido'."""
    usuario = User.objects.filter(email__iexact=(email or '').strip()).first()
    perfil = getattr(usuario, 'alumno_perfil', None) if usuario else None
    if perfil is None or perfil.correo_verificado or not perfil.codigo_hash:
        return 'invalido'
    if perfil.codigo_expira is None or perfil.codigo_expira < timezone.now():
        return 'expirado'
    if perfil.codigo_intentos >= MAX_INTENTOS_CODIGO:
        return 'bloqueado'

    perfil.codigo_intentos += 1
    perfil.save(update_fields=['codigo_intentos'])

    if not hmac.compare_digest(_hash_codigo((codigo or '').strip()), perfil.codigo_hash):
        return 'incorrecto'

    usuario.is_active = True
    usuario.save(update_fields=['is_active'])
    perfil.correo_verificado = True
    perfil.codigo_hash = ''
    perfil.codigo_expira = None
    perfil.codigo_intentos = 0
    perfil.save(update_fields=['correo_verificado', 'codigo_hash', 'codigo_expira', 'codigo_intentos'])
    return 'ok'
