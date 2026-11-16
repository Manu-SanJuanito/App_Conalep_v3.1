# Cafetería CONALEP · Guía de puesta en marcha (versión 2)

## 1. Subir a GitHub (repo NUEVO, sin historial viejo)
1. Descomprime esta carpeta en tu laptop nueva.
2. Crea un repositorio nuevo en GitHub (vacío) y, dentro de la carpeta:
   ```
   git init
   git add .
   git commit -m "Cafetería CONALEP v2"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO_NUEVO.git
   git push -u origin main
   ```
3. Revisa que NO se haya subido `db.sqlite3` ni ningún `.env` (el `.gitignore` ya los bloquea).
4. Cuando todo funcione en producción, **borra el repo viejo** de GitHub (tenía la base de datos y la SECRET_KEY antigua).

## 2. Probar en tu compu
Backend:
```
cd backend_app
python -m venv venv
venv\Scripts\activate          (Windows)   |   source venv/bin/activate  (Mac/Linux)
pip install -r requirements.txt
set DEBUG=True                 (Windows)   |   export DEBUG=True
python manage.py makemigrations --check   # debe decir "No changes detected"
python manage.py test                     # corre las pruebas automáticas
python manage.py migrate
python manage.py createsuperuser          # tu cuenta de cocina/admin
python manage.py runserver
```
Frontend (otra terminal):
```
cd frontend_app/frontend-pos
npm install
npm run dev
```
Para probar fuera de horario pon `HORARIO_ACTIVO=False` en el backend.

## 3. Railway (backend)
Variables mínimas (ver `backend_app/.env.example`):
- `SECRET_KEY` (NUEVA; genera una con el comando que trae el ejemplo)
- `ALLOWED_HOSTS` = tu dominio de Railway, sin https://
- `CORS_ALLOWED_ORIGINS` = la URL de Vercel, con https://
- `ADMIN_URL` = una ruta difícil de adivinar, ej. `panel-coop-x7k2/`
- `REQUIRE_EMAIL_VERIFICATION=False` mientras no configures el correo
- NO pongas `DEBUG` (o ponlo en False). Railway agrega `DATABASE_URL` al conectar PostgreSQL.

Después de desplegar, en el shell de Railway:
```
python manage.py createsuperuser
python manage.py generar_codigos_docente 10   # códigos para docentes (uno por persona)
```
También puedes crear/ver códigos en `/<ADMIN_URL>/` → "Códigos docentes".
**Cambia las contraseñas de las cuentas admin y cocina antes de abrir al público.**

## 4. Vercel (frontend)
- Variable `VITE_API_URL` = `https://TU-APP.up.railway.app/api`
- El archivo `vercel.json` ya incluye la regla que evita el error 404 al recargar.

## 5. Verificación de correo (cuando quieras activarla)
Railway suele bloquear SMTP, por eso se usa API HTTP. Opciones:
- **Brevo** (gratis ~300 correos/día): crea cuenta, verifica un remitente, copia la API key.
  `EMAIL_PROVIDER=brevo`, `EMAIL_API_KEY=...`, `EMAIL_FROM=remitente@verificado`
- **Resend**: necesita un dominio propio verificado para enviar a cualquier correo.
Luego quita `REQUIRE_EMAIL_VERIFICATION=False`. Prueba registrándote con un correo real.

## 6. Reglas configurables (Railway)
`HORA_APERTURA`, `HORA_CIERRE`, `DIAS_ABIERTO` (0=lunes), `TOKEN_HORAS`, `DIAS_CONSERVAR_PEDIDOS`,
`DOMINIOS_ALUMNOS`, `DOMINIOS_DOCENTES`. Por defecto: lunes a viernes 7:00–18:00 (hora de México).

## 7. Revisión manual después del deploy (desde tu celular)
- [ ] Abrir el link → aparece el inicio de sesión. Recargar en cualquier página → no hay 404.
- [ ] Registro alumno con correo real → llega el código → activa la cuenta → inicia sesión.
- [ ] Registro docente con un código → solo ese código sirve una vez.
- [ ] Pedido: aparece la pregunta de ticket; el pedido llega a cocina con código de recogida.
- [ ] Cocina marca "Listo" → al alumno le sale el aviso en máximo ~20 s.
- [ ] Cobrar → Entregar; el stock baja. Cierre de caja cuadra.
- [ ] Fuera de horario: el alumno ve "cafetería cerrada"; cocina sí entra.
- [ ] Borrar cuenta de prueba desde "Mi cuenta".
- [ ] Revisar `https://TU-BACKEND/api/menu/` sin sesión → debe dar 401.
