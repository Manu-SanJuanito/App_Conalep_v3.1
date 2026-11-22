from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0005_cuentas_docentes_tickets'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='imagen_url',
            field=models.URLField(blank=True, default='', max_length=300),
        ),
    ]
