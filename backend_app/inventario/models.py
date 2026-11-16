from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.DecimalField(max_digits=6, decimal_places=2)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name='productos')
    es_preparado = models.BooleanField(default=False) 
    stock_minimo_alerta = models.IntegerField(default=5)  

    def __str__(self):
        return self.nombre

    @property
    def stock_actual(self):
        # Si es un producto preparado, no tiene límite físico de almacén
        if self.es_preparado:
            return 999
        
        # Primero obtenemos el diccionario resultante del aggregate de Django
        hoy = timezone.localdate()
        resultado = self.lotes.filter(
            fecha_caducidad__gte=hoy,
            cantidad__gt=0
        ).aggregate(total_suma=models.Sum('cantidad'))
        
        # Validamos de manera segura: si total_suma es None o no existe, devolvemos 0
        if resultado and resultado.get('total_suma') is not None:
            return resultado['total_suma']
        
        return 0


class LoteAlmacen(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='lotes')
    cantidad = models.IntegerField()
    fecha_ingreso = models.DateField(default=timezone.now)
    fecha_caducidad = models.DateField()

    def __str__(self):
        return f"Lote de {self.producto.nombre} - Caduca: {self.fecha_caducidad}"

class Alumno(models.Model):
    """Perfil de cuenta de la cafetería (alumnos y docentes)."""

    ROLES = [
        ('ALUMNO', 'Alumno'),
        ('DOCENTE', 'Docente'),
    ]

    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='alumno_perfil')
    # La matrícula ya no se pide al registrarse (dato innecesario). Las cuentas
    # anteriores la conservan.
    matricula = models.CharField(max_length=20, unique=True, null=True, blank=True)
    rol = models.CharField(max_length=10, choices=ROLES, default='ALUMNO')

    # Consentimientos
    acepto_privacidad_en = models.DateTimeField(null=True, blank=True)
    acepto_privacidad_version = models.CharField(max_length=20, blank=True, default='')
    acepto_cookies = models.BooleanField(default=False)

    # Verificación de correo (el código se guarda con hash, nunca en claro)
    correo_verificado = models.BooleanField(default=True)
    codigo_hash = models.CharField(max_length=128, blank=True, default='')
    codigo_expira = models.DateTimeField(null=True, blank=True)
    codigo_intentos = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        etiqueta = self.matricula or self.usuario.email
        return f"{self.usuario.first_name} ({etiqueta})"


class CodigoDocente(models.Model):
    """Código de un solo uso que se entrega a cada docente para poder registrarse como tal."""

    codigo = models.CharField(max_length=20, unique=True)
    creado = models.DateTimeField(default=timezone.now)
    nota = models.CharField(max_length=100, blank=True, default='')
    usado_en = models.DateTimeField(null=True, blank=True)
    usado_por = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    @property
    def usado(self):
        return self.usado_en is not None

    def __str__(self):
        return f"{self.codigo} ({'usado' if self.usado else 'disponible'})"

class Pedido(models.Model):
    METODOS_PAGO = [
        ('EFECTIVO', 'Pago Físico / Efectivo'),
        ('LINEA', 'Pago en Línea'),
        ('TARJETA', 'Tarjeta (docentes)'),
    ]
    ESTADOS_PEDIDO = [
        ('PENDIENTE', 'Pendiente'),
        ('PREPARANDO', 'En Preparación'),
        ('LISTO', 'Listo para Entrega'),
        ('ENTREGADO', 'Entregado'),
    ]

    alumno = models.ForeignKey(Alumno, null=True, blank=True, on_delete=models.SET_NULL, related_name='pedidos')
    fecha = models.DateTimeField(default=timezone.now)
    metodo_pago = models.CharField(max_length=10, choices=METODOS_PAGO, default='EFECTIVO')
    estado = models.CharField(max_length=15, choices=ESTADOS_PEDIDO, default='PENDIENTE')
    total = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    descontado_inventario = models.BooleanField(default=False)
    pago_confirmado = models.BooleanField(default=False)
    # El usuario decide al pagar si quiere ticket; solo la cocina lo imprime.
    quiere_ticket = models.BooleanField(default=False)
    ticket_emitido = models.BooleanField(default=False)
    # Código corto para validar la entrega en caja junto con el folio (#id).
    codigo_recogida = models.CharField(max_length=8, blank=True, default='')

    def __str__(self):
        nombre = self.alumno.usuario.first_name if self.alumno else 'Cuenta eliminada'
        return f"Pedido #{self.id} - {nombre} ({self.estado}) - Pagado: {self.pago_confirmado}"

class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=6, decimal_places=2)

    def __str__(self):
        return f"{self.cantidad}x {self.producto.nombre} en Pedido #{self.pedido.id}"

