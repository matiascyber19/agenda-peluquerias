# Puesta en marcha

Pasos que dependen de las cuentas de Supabase y Vercel o de los datos reales de la peluquería. El código ya está listo para todos.

## Supabase (proyecto real)

- [x] **Ejecutar la migración 006** (ejecutada el 9 de octubre): equipo con roles, comisiones, reglas de reserva y propuestas.
- [x] **Ejecutar la migración 005** (ejecutada el 8 de octubre) (`supabase/migraciones/005_proteccion_cruces_y_cobros.sql`) en el SQL Editor. La consulta final tiene que dar todo `true`. Con ella, la base impide citas cruzadas y cobros dobles.
- [x] **Authentication → URL Configuration y plantilla del correo** (hecho el 8 de octubre). Es necesario para recuperar la contraseña.
  - **Site URL:** `https://agenda-peluquerias-nine.vercel.app`
  - **Redirect URLs:** `https://agenda-peluquerias-nine.vercel.app/auth/confirmar` y `http://localhost:3000/**`. El comodín `**` hace falta porque la app envía la dirección con `?next=...` y Supabase compara la URL completa. Producción funciona igual sin comodín, porque Supabase acepta cualquier dirección del dominio de la Site URL.
  - **Plantilla del correo:** en Authentication → Emails → Templates → **Reset password**, el enlace tiene que ser `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`, para que funcione desde cualquier navegador o dispositivo.
- [ ] **Authentication → Emails → SMTP Settings.** El correo por defecto de Supabase solo envía a los miembros del proyecto, con un límite bajo por hora. Para que el correo de recuperar la contraseña les llegue a las peluquerías, hay que configurar el SMTP de Resend:
  - host `smtp.resend.com`
  - puerto `465`
  - usuario `resend`
  - contraseña: la API key de Resend
  - remitente: una dirección del dominio verificado

## Resend y Vercel (aviso por correo de solicitudes nuevas)

- [ ] En Resend, **verificar un dominio propio**. Sin dominio, Resend solo envía al correo de la cuenta.
- [ ] En Vercel, en **Settings → Environment Variables**, agregar y después volver a desplegar:
  - `RESEND_API_KEY`
  - `SUPABASE_SECRET_KEY`
  - `AVISOS_REMITENTE`, opcional. Por ejemplo `Agenda Peluquerías <avisos@tudominio.cl>`.

## En la app (cada peluquería)

- [ ] **Configuración → Horarios:** el horario de cada peluquero. Sin horarios, la página de reservas no muestra horas.
- [ ] **Configuración → Contacto:** el WhatsApp de la peluquería, para los enlaces que avisan al cliente, y el correo para los avisos de solicitudes.
- [ ] **Configuración → Días cerrados:** feriados y vacaciones.
- [ ] **Compartir el enlace de reservas** que aparece en Configuración.

## Base de pruebas

- [ ] Crear el proyecto de pruebas y conectar los previews y el desarrollo local, según `docs/base-de-pruebas.md`.
