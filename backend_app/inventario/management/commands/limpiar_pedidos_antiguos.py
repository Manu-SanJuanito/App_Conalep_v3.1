from django.conf import settings
from django.core.management.base import BaseCommand

from inventario.mantenimiento import limpiar_pedidos_antiguos


class Command(BaseCommand):
    help = "Borra los pedidos con más de DIAS_CONSERVAR_PEDIDOS días (por defecto 15)."

    def handle(self, *args, **options):
        borrados = limpiar_pedidos_antiguos()
        self.stdout.write(self.style.SUCCESS(
            f"Se borraron {borrados} pedido(s) con más de {settings.DIAS_CONSERVAR_PEDIDOS} días."
        ))
