"""Horario de servicio de la cafetería (hora de Tulancingo, Hidalgo)."""
import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import BasePermission

NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']


def _hora(texto):
    horas, minutos = texto.split(':')
    return datetime.time(int(horas), int(minutos))


def esta_abierto(ahora=None):
    """True si la cafetería está dentro de su horario. `ahora` es solo para pruebas."""
    if not settings.HORARIO_ACTIVO:
        return True
    ahora = ahora or timezone.localtime()
    if ahora.weekday() not in settings.DIAS_ABIERTO:
        return False
    return _hora(settings.HORA_APERTURA) <= ahora.time() < _hora(settings.HORA_CIERRE)


def descripcion_horario():
    dias = sorted(settings.DIAS_ABIERTO)
    if not dias:
        return ''
    if len(dias) == 1:
        texto_dias = NOMBRES_DIAS[dias[0]]
    elif dias == list(range(dias[0], dias[-1] + 1)):
        texto_dias = f"{NOMBRES_DIAS[dias[0]]} a {NOMBRES_DIAS[dias[-1]]}"
    else:
        texto_dias = ', '.join(NOMBRES_DIAS[d] for d in dias)
    return f"{texto_dias} de {settings.HORA_APERTURA} a {settings.HORA_CIERRE}"


class CafeteriaAbierta(BasePermission):
    """El personal (cocina/caja) puede operar a cualquier hora; los demás, solo en horario."""

    message = 'La cafetería está cerrada. Vuelve en horario de servicio.'

    def has_permission(self, request, view):
        usuario = request.user
        if usuario and usuario.is_authenticated and usuario.is_staff:
            return True
        return esta_abierto()
