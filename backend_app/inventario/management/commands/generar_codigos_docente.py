from django.core.management.base import BaseCommand

from inventario.cuentas import generar_codigos_docente


class Command(BaseCommand):
    help = "Genera códigos de un solo uso para que los docentes se registren. Uso: generar_codigos_docente 10"

    def add_arguments(self, parser):
        parser.add_argument('cantidad', type=int, nargs='?', default=10)

    def handle(self, *args, **options):
        cantidad = max(1, min(options['cantidad'], 200))
        for codigo in generar_codigos_docente(cantidad, nota='Generado por comando'):
            self.stdout.write(codigo.codigo)
        self.stdout.write(self.style.SUCCESS(f"{cantidad} código(s) creados. Entrega uno por docente."))
