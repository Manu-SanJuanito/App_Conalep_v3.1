"""Envío de correos por API HTTP (Railway suele bloquear SMTP)."""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


class ErrorDeCorreo(Exception):
    pass


def _post_json(url, cabeceras, datos):
    peticion = urllib.request.Request(
        url,
        data=json.dumps(datos).encode('utf-8'),
        headers={'Content-Type': 'application/json', **cabeceras},
        method='POST',
    )
    try:
        with urllib.request.urlopen(peticion, timeout=15) as respuesta:
            return respuesta.status
    except (urllib.error.URLError, TimeoutError) as error:
        raise ErrorDeCorreo(str(error)) from error


def enviar_correo(destino, asunto, texto):
    proveedor = settings.EMAIL_PROVIDER

    if proveedor == 'consola':
        # Solo desarrollo: el correo se imprime en los logs.
        logger.warning('CORREO (modo consola) a %s | %s | %s', destino, asunto, texto)
        return

    if not settings.EMAIL_API_KEY or not settings.EMAIL_FROM:
        raise ErrorDeCorreo('Falta EMAIL_API_KEY o EMAIL_FROM.')

    if proveedor == 'brevo':
        _post_json(
            'https://api.brevo.com/v3/smtp/email',
            {'api-key': settings.EMAIL_API_KEY, 'accept': 'application/json'},
            {
                'sender': {'name': settings.EMAIL_FROM_NOMBRE, 'email': settings.EMAIL_FROM},
                'to': [{'email': destino}],
                'subject': asunto,
                'textContent': texto,
            },
        )
    elif proveedor == 'resend':
        _post_json(
            'https://api.resend.com/emails',
            {'Authorization': f'Bearer {settings.EMAIL_API_KEY}'},
            {
                'from': f'{settings.EMAIL_FROM_NOMBRE} <{settings.EMAIL_FROM}>',
                'to': [destino],
                'subject': asunto,
                'text': texto,
            },
        )
    else:
        raise ErrorDeCorreo(f'EMAIL_PROVIDER desconocido: {proveedor}')
