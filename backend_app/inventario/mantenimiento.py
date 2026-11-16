from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import Pedido


def limpiar_pedidos_antiguos():
    """Borra los pedidos con más de DIAS_CONSERVAR_PEDIDOS días. Devuelve cuántos pedidos se borraron."""
    limite = timezone.now() - timedelta(days=settings.DIAS_CONSERVAR_PEDIDOS)
    _, por_modelo = Pedido.objects.filter(fecha__lt=limite).delete()
    return por_modelo.get('inventario.Pedido', 0)
