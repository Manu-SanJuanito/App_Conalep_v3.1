import logging
import re
import secrets
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from inventario import cuentas

# Importamos directamente los modelos desde su módulo absoluto para evitar la importación circular:
from inventario.models import Categoria, Producto, Alumno, Pedido, DetallePedido, CodigoDocente

logger = logging.getLogger(__name__)

NOMBRE_VALIDO = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .'\-]{1,39}$")


class RegistroSerializer(serializers.Serializer):
    """Registro con los datos mínimos: nombre o apodo, correo institucional y contraseña."""

    nombre = serializers.CharField(max_length=40)
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    password_confirmacion = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    rol = serializers.ChoiceField(choices=['ALUMNO', 'DOCENTE'], default='ALUMNO')
    codigo_docente = serializers.CharField(required=False, allow_blank=True, max_length=20)
    acepto_privacidad = serializers.BooleanField()
    acepto_cookies = serializers.BooleanField(required=False, default=False)

    def validate_nombre(self, value):
        nombre = ' '.join(value.split())
        if not NOMBRE_VALIDO.match(nombre):
            raise serializers.ValidationError(
                'Escribe tu nombre o apodo (2 a 40 caracteres, solo letras, números, espacios y . \' -).'
            )
        return nombre

    def validate_email(self, value):
        email = value.strip().lower()
        if '+' in email.split('@')[0]:
            raise serializers.ValidationError('El correo no puede contener el símbolo +.')
        return email

    def validate_acepto_privacidad(self, value):
        if value is not True:
            raise serializers.ValidationError('Debes aceptar el aviso de privacidad para crear tu cuenta.')
        return value

    def validate(self, attrs):
        email = attrs['email']
        rol = attrs['rol']

        # Dominio institucional según el rol
        permitidos = settings.DOMINIOS_DOCENTES if rol == 'DOCENTE' else settings.DOMINIOS_ALUMNOS
        dominio = email.rsplit('@', 1)[-1]
        if dominio not in permitidos:
            raise serializers.ValidationError({
                'email': f"Usa tu correo institucional (@{permitidos[0]})."
            })

        # Correo ya registrado (una cuenta sin verificar sí se puede volver a registrar)
        previo = User.objects.filter(email__iexact=email).first()
        if previo is not None and not cuentas.cuenta_pendiente_de_verificar(previo):
            raise serializers.ValidationError({'email': 'Este correo ya tiene una cuenta. Inicia sesión.'})

        # Contraseña
        if attrs['password'] != attrs['password_confirmacion']:
            raise serializers.ValidationError({'password_confirmacion': 'Las contraseñas no coinciden.'})
        try:
            validate_password(attrs['password'], user=User(username=email, email=email, first_name=attrs['nombre']))
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})

        # Código de docente
        if rol == 'DOCENTE':
            texto = cuentas.normalizar_codigo_docente(attrs.get('codigo_docente'))
            if not texto:
                raise serializers.ValidationError({'codigo_docente': 'Escribe el código que te dieron para docentes.'})
            codigo = CodigoDocente.objects.filter(codigo=texto).first()
            if codigo is None:
                raise serializers.ValidationError({'codigo_docente': 'Ese código no es válido.'})
            reutilizable = previo is not None and codigo.usado_por_id == previo.id
            if codigo.usado and not reutilizable:
                raise serializers.ValidationError({'codigo_docente': 'Ese código ya fue utilizado.'})
            attrs['_codigo_docente_id'] = codigo.id

        return attrs


class PerfilSerializer(serializers.Serializer):
    """Datos de la cuenta que el usuario puede ver."""

    nombre = serializers.CharField(source='first_name')
    email = serializers.EmailField()
    rol = serializers.SerializerMethodField()
    matricula = serializers.SerializerMethodField()
    es_admin = serializers.BooleanField(source='is_staff')
    creada = serializers.DateTimeField(source='date_joined')
    acepto_cookies = serializers.SerializerMethodField()

    def get_acepto_cookies(self, usuario):
        perfil = getattr(usuario, 'alumno_perfil', None)
        return bool(perfil.acepto_cookies) if perfil else False

    def get_rol(self, usuario):
        perfil = getattr(usuario, 'alumno_perfil', None)
        if perfil:
            return perfil.rol
        return 'ADMIN' if usuario.is_staff else 'ALUMNO'

    def get_matricula(self, usuario):
        perfil = getattr(usuario, 'alumno_perfil', None)
        return (perfil.matricula or '') if perfil else ''


class PerfilEdicionSerializer(serializers.Serializer):
    """Edición de datos propios: nombre, matrícula (opcional) y, si quiere, contraseña."""

    nombre = serializers.CharField(max_length=40, required=False)
    matricula = serializers.CharField(max_length=20, required=False, allow_blank=True)
    acepto_cookies = serializers.BooleanField(required=False)
    password_actual = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    password_nueva = serializers.CharField(write_only=True, required=False, max_length=128, trim_whitespace=False)

    def validate_nombre(self, value):
        nombre = ' '.join(value.split())
        if not NOMBRE_VALIDO.match(nombre):
            raise serializers.ValidationError(
                'Escribe un nombre o apodo válido (2 a 40 caracteres, solo letras, números, espacios y . \' -).'
            )
        return nombre

    def validate_matricula(self, value):
        matricula = value.strip()
        if not matricula:
            return ''
        perfil = getattr(self.context['usuario'], 'alumno_perfil', None)
        otros = Alumno.objects.filter(matricula=matricula)
        if perfil is not None:
            otros = otros.exclude(pk=perfil.pk)
        if otros.exists():
            raise serializers.ValidationError('Esa matrícula ya está registrada en otra cuenta.')
        return matricula

    def validate(self, attrs):
        usuario = self.context['usuario']
        if 'password_nueva' in attrs:
            if not attrs.get('password_actual') or not usuario.check_password(attrs['password_actual']):
                raise serializers.ValidationError({'password_actual': 'Tu contraseña actual no es correcta.'})
            try:
                validate_password(attrs['password_nueva'], user=usuario)
            except DjangoValidationError as error:
                raise serializers.ValidationError({'password_nueva': list(error.messages)})
        return attrs


class ProductoMenuSerializer(serializers.ModelSerializer):
    stock_disponible = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'descripcion', 'precio', 'es_preparado', 'stock_disponible']

    def get_stock_disponible(self, obj):
        if obj.es_preparado:
            return 999  

        hoy = timezone.localdate()
        
        # 1. Obtener el stock físico en lotes vigentes
        total_stock = obj.lotes.filter(
            fecha_caducidad__gte=hoy,
            cantidad__gt=0
        ).aggregate(total_suma=models.Sum('cantidad'))['total_suma'] or 0

        # 2. FIX 1: APARTADO VIRTUAL con LISTO incluido
        # Si no pones LISTO, al pasar a LISTO se libera y otros piden lo mismo
        cantidad_apartada = obj.detallepedido_set.filter(
            pedido__estado__in=['PENDIENTE', 'PREPARANDO', 'LISTO']
        ).aggregate(total_suma=models.Sum('cantidad'))['total_suma'] or 0

        # 3. Stock neto disponible
        stock_neto = total_stock - cantidad_apartada
        return max(0, stock_neto)

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre']


class ProductoCrearSerializer(serializers.ModelSerializer):
    # En vez de pedir el ID de una categoría ya existente, dejamos que el personal
    # escriba el nombre: si ya existe la reusamos, si no, la creamos al vuelo.
    # Así "Paletas" puede darse de alta sin tener que entrar antes al admin de Django.
    categoria_nombre = serializers.CharField(write_only=True, max_length=100)
    categoria = CategoriaSerializer(read_only=True)

    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'descripcion', 'precio', 'categoria', 'categoria_nombre', 'es_preparado', 'stock_minimo_alerta']

    def validate_nombre(self, value):
        nombre_limpio = value.strip()
        if not nombre_limpio:
            raise serializers.ValidationError("El nombre del producto no puede estar vacío.")
        if Producto.objects.filter(nombre__iexact=nombre_limpio).exists():
            raise serializers.ValidationError(f"Ya existe un producto llamado '{nombre_limpio}'.")
        return nombre_limpio

    def validate_precio(self, value):
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a cero.")
        return value

    def create(self, validated_data):
        nombre_categoria = validated_data.pop('categoria_nombre').strip()
        categoria = Categoria.objects.filter(nombre__iexact=nombre_categoria).first()
        if categoria is None:
            categoria = Categoria.objects.create(nombre=nombre_categoria)
        return Producto.objects.create(categoria=categoria, **validated_data)


class MenuCategoriaSerializer(serializers.ModelSerializer):
    productos = ProductoMenuSerializer(many=True, read_only=True)

    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'productos']

class DetallePedidoSerializer(serializers.ModelSerializer):
    precio_unitario = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['producto', 'producto_nombre', 'cantidad', 'precio_unitario']

class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, allow_empty=False)
    total = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    alumno = serializers.PrimaryKeyRelatedField(read_only=True)
    alumno_nombre = serializers.SerializerMethodField()
    matricula = serializers.SerializerMethodField()
    rol = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id', 'alumno', 'alumno_nombre', 'matricula', 'rol', 'fecha', 'metodo_pago', 'estado', 'total',
            'pago_confirmado', 'quiere_ticket', 'ticket_emitido', 'codigo_recogida', 'detalles',
        ]
        read_only_fields = ['estado', 'fecha', 'pago_confirmado', 'ticket_emitido', 'codigo_recogida']

    def get_alumno_nombre(self, obj):
        if obj.alumno is None:
            return 'Cuenta eliminada'
        return (obj.alumno.usuario.first_name or obj.alumno.usuario.username).strip()

    def get_matricula(self, obj):
        return (obj.alumno.matricula or '') if obj.alumno else ''

    def get_rol(self, obj):
        return obj.alumno.rol if obj.alumno else ''

    def validate_metodo_pago(self, value):
        request = self.context.get('request')
        perfil = getattr(request.user, 'alumno_perfil', None) if request else None
        rol = perfil.rol if perfil else 'ALUMNO'
        permitidos = ['EFECTIVO', 'TARJETA'] if rol == 'DOCENTE' else ['EFECTIVO']
        if value not in permitidos:
            if rol == 'DOCENTE':
                raise serializers.ValidationError('Ese método de pago no está disponible.')
            raise serializers.ValidationError('Por ahora los alumnos solo pueden pagar en efectivo en caja.')
        return value

    def validate_detalles(self, value):
        if len(value) > 30:
            raise serializers.ValidationError('Un pedido no puede tener más de 30 productos distintos.')
        for item in value:
            if item['cantidad'] <= 0:
                raise serializers.ValidationError('La cantidad de cada producto debe ser mayor a cero.')
            if item['cantidad'] > 20:
                raise serializers.ValidationError('No puedes pedir más de 20 piezas del mismo producto.')
        return value

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        request = self.context.get('request')

        try:
            alumno = request.user.alumno_perfil
        except AttributeError:
            raise serializers.ValidationError({'error': 'Tu cuenta no puede hacer pedidos.'})

        # Se procesan en orden de producto para que dos pedidos simultáneos bloqueen en el mismo orden.
        detalles_data = sorted(detalles_data, key=lambda d: d['producto'].pk)

        with transaction.atomic():
            pedido = Pedido.objects.create(
                alumno=alumno,
                total=0,
                codigo_recogida=secrets.token_hex(3).upper(),
                **validated_data,
            )
            total_pedido = Decimal('0.00')
            hoy = timezone.localdate()

            for detalle in detalles_data:
                # Bloquea la fila del producto mientras se verifica el stock (evita vender de más).
                producto = Producto.objects.select_for_update().get(pk=detalle['producto'].pk)
                cantidad_solicitada = detalle['cantidad']

                if not producto.es_preparado:
                    total_stock = producto.lotes.filter(
                        fecha_caducidad__gte=hoy,
                        cantidad__gt=0,
                    ).aggregate(total_suma=models.Sum('cantidad'))['total_suma'] or 0

                    # El apartado incluye LISTO: un pedido listo aún no se ha entregado.
                    cantidad_apartada = producto.detallepedido_set.filter(
                        pedido__estado__in=['PENDIENTE', 'PREPARANDO', 'LISTO']
                    ).aggregate(total_suma=models.Sum('cantidad'))['total_suma'] or 0

                    disponible_real = total_stock - cantidad_apartada
                    if disponible_real < cantidad_solicitada:
                        raise serializers.ValidationError({
                            'stock': (
                                f"Ya no hay suficiente '{producto.nombre}'. "
                                f"Disponibles ahora: {max(0, disponible_real)}."
                            )
                        })

                precio_fijo = producto.precio
                total_pedido += precio_fijo * cantidad_solicitada

                DetallePedido.objects.create(
                    pedido=pedido,
                    producto=producto,
                    cantidad=cantidad_solicitada,
                    precio_unitario=precio_fijo,
                )

            pedido.total = total_pedido
            pedido.save()

        return pedido


class CambiarEstadoPedidoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pedido
        fields = ['id', 'alumno', 'fecha', 'metodo_pago', 'estado', 'total', 'pago_confirmado', 'ticket_emitido', 'codigo_recogida']
        read_only_fields = ['id', 'alumno', 'fecha', 'metodo_pago', 'total', 'codigo_recogida']

    def validate(self, attrs):
        # Obtenemos el estado actual de la base de datos y el nuevo que viene del frontend
        instance = self.instance
        if instance is None:
            return attrs
        nuevo_estado = attrs.get('estado', instance.estado)
        pago_confirmado = attrs.get('pago_confirmado', instance.pago_confirmado)

        # CANDADO FINANCIERO: no se entrega un pedido que no se ha cobrado.
        if nuevo_estado == 'ENTREGADO' and not pago_confirmado:
            raise serializers.ValidationError({
                "pago_confirmado": "Primero confirma el cobro en caja; después puedes entregar el pedido."
            })
        return attrs

    def update(self, instance, validated_data):
        nuevo_estado = validated_data.get('estado', instance.estado)

        with transaction.atomic():
            # Volvemos a bloquear por si la vista no lo hizo
            pedido = Pedido.objects.select_for_update().get(pk=instance.pk)
            estado_anterior = pedido.estado
            ya_descontado = pedido.descontado_inventario

            pedido.pago_confirmado = validated_data.get('pago_confirmado', pedido.pago_confirmado)
            pedido.ticket_emitido = validated_data.get('ticket_emitido', pedido.ticket_emitido)
            pedido.estado = nuevo_estado

            # ✅ SOLO descuenta si es ENTREGADO, NO estaba entregado Y NO se había descontado antes
            # Aunque te lleguen 5 PUTs de ENTREGADO como en tu log, solo el primero descuenta
            if nuevo_estado == 'ENTREGADO' and estado_anterior != 'ENTREGADO' and not ya_descontado:
                logger.info("Descontando inventario del pedido %s (primera vez)", pedido.id)
                for detalle in pedido.detalles.all():
                    producto = detalle.producto
                    if producto.es_preparado:
                        continue
                    cantidad_a_descontar = detalle.cantidad
                    lotes = producto.lotes.filter(
                        fecha_caducidad__gte=timezone.localdate(),
                        cantidad__gt=0
                    ).order_by('fecha_caducidad', 'id')
                    for lote in lotes:
                        if cantidad_a_descontar <= 0:
                            break
                        if lote.cantidad >= cantidad_a_descontar:
                            lote.cantidad -= cantidad_a_descontar
                            lote.save()
                            cantidad_a_descontar = 0
                        else:
                            cantidad_a_descontar -= lote.cantidad
                            lote.cantidad = 0
                            lote.save()
                    if cantidad_a_descontar > 0:
                        raise serializers.ValidationError({
                            "error": f"El inventario no alcanza para entregar '{producto.nombre}'. Revisa los lotes."
                        })
                pedido.descontado_inventario = True

            pedido.save()
            return pedido