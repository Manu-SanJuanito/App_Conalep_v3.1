from django.contrib import admin, messages

from .cuentas import generar_codigos_docente
from .models import (
    Alumno,
    Categoria,
    CodigoDocente,
    DetallePedido,
    LoteAlmacen,
    Pedido,
    Producto,
)

admin.site.register(Categoria)
admin.site.register(Producto)
admin.site.register(LoteAlmacen)
admin.site.register(DetallePedido)


@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'rol', 'correo_verificado', 'acepto_privacidad_en')
    list_filter = ('rol', 'correo_verificado')
    search_fields = ('usuario__email', 'usuario__first_name', 'matricula')
    # El hash del código de verificación no se muestra ni se edita.
    exclude = ('codigo_hash',)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'alumno', 'fecha', 'estado', 'metodo_pago', 'total', 'pago_confirmado', 'quiere_ticket')
    list_filter = ('estado', 'metodo_pago', 'quiere_ticket')


@admin.register(CodigoDocente)
class CodigoDocenteAdmin(admin.ModelAdmin):
    """Aquí generas los códigos que entregas a cada docente (uno por persona)."""

    list_display = ('codigo', 'nota', 'creado', 'estado_codigo', 'usado_por')
    list_filter = ('usado_en',)
    search_fields = ('codigo', 'nota')
    readonly_fields = ('usado_en', 'usado_por')
    actions = ['generar_cinco', 'generar_veinte']

    @admin.display(description='Estado')
    def estado_codigo(self, obj):
        return 'Usado' if obj.usado else 'Disponible'

    def _generar(self, request, cantidad):
        nuevos = generar_codigos_docente(cantidad, nota='Generado desde el panel')
        self.message_user(
            request,
            'Códigos nuevos: ' + ', '.join(c.codigo for c in nuevos),
            level=messages.SUCCESS,
        )

    @admin.action(description='Generar 5 códigos nuevos (selecciona cualquier fila)')
    def generar_cinco(self, request, queryset):
        self._generar(request, 5)

    @admin.action(description='Generar 20 códigos nuevos (selecciona cualquier fila)')
    def generar_veinte(self, request, queryset):
        self._generar(request, 20)
