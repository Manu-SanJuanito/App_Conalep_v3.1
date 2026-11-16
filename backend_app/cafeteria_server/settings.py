"""
Configuración de Django para la Cafetería CONALEP.

TODO lo que sea secreto o cambie entre tu compu y producción se lee de
variables de entorno (Railway). Mira .env.example para la lista completa.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # python-dotenv es opcional
    pass

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(nombre, por_defecto=False):
    valor = os.environ.get(nombre)
    if valor is None:
        return por_defecto
    return valor.strip().lower() in ('1', 'true', 'si', 'sí', 'yes', 'on')


def env_lista(nombre, por_defecto=''):
    return [x.strip() for x in os.environ.get(nombre, por_defecto).split(',') if x.strip()]


# ---------------------------------------------------------------------------
# Seguridad básica
# ---------------------------------------------------------------------------
# DEBUG es False a menos que lo enciendas expresamente (solo en tu compu).
DEBUG = env_bool('DEBUG', False)

SECRET_KEY = os.environ.get('SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        # Solo para desarrollo local. NUNCA se usa en producción.
        SECRET_KEY = 'clave-solo-para-desarrollo-local-no-usar-en-produccion'
    else:
        raise ImproperlyConfigured(
            'Falta la variable de entorno SECRET_KEY. Genera una con: '
            'python -c "from django.core.management.utils import get_random_secret_key; '
            'print(get_random_secret_key())"'
        )

ALLOWED_HOSTS = env_lista('ALLOWED_HOSTS', 'localhost,127.0.0.1')

# Ruta del panel de Django. Cámbiala en Railway (ADMIN_URL=algo-dificil-de-adivinar/)
ADMIN_URL = os.environ.get('ADMIN_URL', 'admin/').strip('/') + '/'


# ---------------------------------------------------------------------------
# Aplicaciones
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'inventario',
    'rest_framework.authtoken',
    'rest_framework',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'cafeteria_server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'cafeteria_server.wsgi.application'


# ---------------------------------------------------------------------------
# Base de datos (SQLite en tu compu, PostgreSQL en Railway vía DATABASE_URL)
# ---------------------------------------------------------------------------
import dj_database_url  # noqa: E402

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}


# ---------------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
# Las contraseñas se guardan con hash PBKDF2 (el default de Django). No se
# pueden recuperar: si alguien la olvida, hay que restablecerla.


# ---------------------------------------------------------------------------
# Idioma y zona horaria (Tulancingo, Hidalgo)
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------------------
# Archivos estáticos
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------
_cors_extra = env_lista('CORS_ALLOWED_ORIGINS')
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
] + _cors_extra
CSRF_TRUSTED_ORIGINS = [o for o in _cors_extra if o.startswith('https://')]


# ---------------------------------------------------------------------------
# Seguridad HTTPS (solo cuando DEBUG=False, o sea en Railway)
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 2592000))  # 30 días
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'


# ---------------------------------------------------------------------------
# API (Django REST Framework)
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'inventario.autenticacion.TokenConExpiracion',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Límites por cuenta/correo (anti fuerza bruta). No se limita por IP
        # porque en la escuela muchos alumnos comparten la misma IP pública.
        'login_cuenta': '10/hour',
        'registro_cuenta': '6/hour',
        'codigo_cuenta': '10/hour',
    },
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
}


# ---------------------------------------------------------------------------
# Reglas de la cafetería (todas configurables desde Railway)
# ---------------------------------------------------------------------------
# Horario: lunes a viernes de 7:00 a 18:00 (hora de Tulancingo).
# Para desactivar el horario mientras pruebas: HORARIO_ACTIVO=False
HORARIO_ACTIVO = env_bool('HORARIO_ACTIVO', True)
HORA_APERTURA = os.environ.get('HORA_APERTURA', '07:00')
HORA_CIERRE = os.environ.get('HORA_CIERRE', '18:00')
DIAS_ABIERTO = [int(d) for d in env_lista('DIAS_ABIERTO', '0,1,2,3,4')]  # 0 = lunes

# Dominios de correo permitidos para registrarse.
DOMINIOS_ALUMNOS = env_lista('DOMINIOS_ALUMNOS', 'hgo.conalep.edu.mx')
DOMINIOS_DOCENTES = env_lista('DOMINIOS_DOCENTES', 'hgo.conalep.edu.mx,conalep.edu.mx')

# Horas de vigencia de una sesión (después hay que volver a iniciar sesión).
TOKEN_HORAS = int(os.environ.get('TOKEN_HORAS', 12))

# Días que se conservan los pedidos antes de borrarse automáticamente.
DIAS_CONSERVAR_PEDIDOS = int(os.environ.get('DIAS_CONSERVAR_PEDIDOS', 15))

# Versión del aviso de privacidad que aceptan los usuarios (súbela si cambias el texto).
VERSION_AVISO_PRIVACIDAD = os.environ.get('VERSION_AVISO_PRIVACIDAD', '2026-11')


# ---------------------------------------------------------------------------
# Correo (verificación de cuentas)
# ---------------------------------------------------------------------------
# Railway suele bloquear SMTP, por eso se envía por API HTTP.
#   EMAIL_PROVIDER = brevo | resend | consola
#   EMAIL_API_KEY  = la llave del proveedor
#   EMAIL_FROM     = correo remitente verificado en el proveedor
# Si EMAIL_PROVIDER no está definido, el código solo se imprime en los logs.
EMAIL_PROVIDER = os.environ.get('EMAIL_PROVIDER', 'consola').strip().lower()
EMAIL_API_KEY = os.environ.get('EMAIL_API_KEY', '')
EMAIL_FROM = os.environ.get('EMAIL_FROM', '')
EMAIL_FROM_NOMBRE = os.environ.get('EMAIL_FROM_NOMBRE', 'Cafetería CONALEP')

# Si es False, las cuentas quedan activas al registrarse (sin verificar el
# correo). Úsalo solo mientras configuras el servicio de correo.
REQUIRE_EMAIL_VERIFICATION = env_bool('REQUIRE_EMAIL_VERIFICATION', True)
