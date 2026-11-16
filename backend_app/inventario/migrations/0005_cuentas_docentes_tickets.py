import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0004_pedido_descontado_inventario'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # --- Alumno / cuentas ---
        migrations.AlterField(
            model_name='alumno',
            name='matricula',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='alumno',
            name='rol',
            field=models.CharField(choices=[('ALUMNO', 'Alumno'), ('DOCENTE', 'Docente')], default='ALUMNO', max_length=10),
        ),
        migrations.AddField(
            model_name='alumno',
            name='acepto_privacidad_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='alumno',
            name='acepto_privacidad_version',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='alumno',
            name='acepto_cookies',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='alumno',
            name='correo_verificado',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='alumno',
            name='codigo_hash',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
        migrations.AddField(
            model_name='alumno',
            name='codigo_expira',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='alumno',
            name='codigo_intentos',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        # --- Pedido ---
        migrations.AlterField(
            model_name='pedido',
            name='alumno',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pedidos', to='inventario.alumno'),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='metodo_pago',
            field=models.CharField(choices=[('EFECTIVO', 'Pago Físico / Efectivo'), ('LINEA', 'Pago en Línea'), ('TARJETA', 'Tarjeta (docentes)')], default='EFECTIVO', max_length=10),
        ),
        migrations.AddField(
            model_name='pedido',
            name='quiere_ticket',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='pedido',
            name='ticket_emitido',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='pedido',
            name='codigo_recogida',
            field=models.CharField(blank=True, default='', max_length=8),
        ),
        # --- Códigos de docentes ---
        migrations.CreateModel(
            name='CodigoDocente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=20, unique=True)),
                ('creado', models.DateTimeField(default=django.utils.timezone.now)),
                ('nota', models.CharField(blank=True, default='', max_length=100)),
                ('usado_en', models.DateTimeField(blank=True, null=True)),
                ('usado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
