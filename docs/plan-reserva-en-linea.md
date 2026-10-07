# Plan: reserva en línea

> Borrador, 7 de octubre de 2026. Matías se hace cargo del frontend y del backend mientras el compañero está ocupado.
> Los cambios en la base se ejecutan en el SQL Editor de Supabase.

## 1. Objetivo

Que el cliente reserve solo, desde un enlace público de la peluquería, y que el encargado solo tenga que revisar y responder.

Hoy la peluquería crea al cliente a mano y elige los servicios por él: es lento y obliga a revisar varias veces. Los servicios y peluqueros se siguen creando desde el panel. Los clientes, en cambio, **ya no se crean a mano**: se agregan solos al reservar en línea, o desde "Nueva cita" con solo nombre y teléfono (§13).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Servicios | Los crea el encargado desde el panel, como ahora. El cliente solo elige entre los activos |
| Peluquero | El cliente elige uno o "sin preferencia". Con "sin preferencia" se asigna automáticamente uno libre |
| Solicitud pendiente | Bloquea la hora desde que se envía, para que nadie más la tome |
| Agenda | Las solicitudes **no** aparecen hasta confirmarlas. Al confirmarlas pasan a la agenda |
| Dashboard | Tarjeta "Solicitudes por confirmar" que se actualiza sola cada minuto. Al confirmar una solicitud, el dashboard la cuenta como cualquier cita |
| Aviso al encargado | Por correo a una dirección configurable por peluquería (`peluquerias.email`), además de la sección "Solicitudes" |
| Cambiar el día | En la etapa 1, el encargado acepta con otra hora y avisa al cliente por WhatsApp con un mensaje ya escrito |
| Chat | No en la etapa 1. El botón de WhatsApp cubre "no puedo contactar al cliente" |
| Horarios | Por peluquero, con la tabla `horarios`, que ya existe |
| Clientes | Cada peluquería tiene su propia lista. El cliente se identifica por teléfono dentro de cada peluquería |
| Alta de clientes | No hay "+ Nuevo cliente". Un cliente sin reserva se crea dentro de "Nueva cita" con nombre y teléfono; si el teléfono ya existe, se reutiliza esa ficha |
| Lista de Clientes | Historial de atendidos (con al menos una cita completada), por visita más reciente, con el servicio habitual. La ficha muestra los servicios frecuentes y cada cuánto viene |
| Citas del panel | Nacen `confirmada`, porque las agenda la propia peluquería |
| Cierre de citas | Automático: una cita `confirmada` pasa a `completada` una hora después de terminar. El encargado solo marca las excepciones ("No llegó", "Cancelada") |

## 3. Flujo

**Cliente** (sin cuenta, en `/reservar/[slug]`, pensado para celular):

1. Elige uno o más servicios. Ve el precio y la duración total.
2. Elige un peluquero o "sin preferencia".
3. Elige el día y ve solo las horas libres.
4. Deja su nombre y teléfono (y correo, opcional) y envía.
5. Ve un resumen: "Tu solicitud fue enviada; la peluquería te confirmará". Incluye un botón de WhatsApp de la peluquería.

**Peluquería:**

1. Le llega un correo con el enlace a la solicitud, y el contador de "Solicitudes" sube.
2. En "Solicitudes" ve quién, qué servicios, cuándo y con qué peluquero, y puede:
   - **Aceptar.** La cita pasa a la agenda.
   - **Aceptar con otra hora o con otro peluquero.** Se vuelven a revisar los cruces.
   - **Rechazar.** Libera la hora.
3. Después de responder, el botón **"Avisar por WhatsApp"** abre el chat con el cliente con un mensaje ya escrito.

## 4. Estados de una cita

| Estado | Origen | ¿Se ve en la agenda? | ¿Ocupa la hora? | Pasa a |
|---|---|---|---|---|
| `solicitada` **(nuevo)** | Reserva en línea | No | Sí | `confirmada`, `rechazada` |
| `rechazada` **(nuevo)** | El encargado rechaza una solicitud | No | No | Ninguno (es final) |
| `pendiente` | Solo citas antiguas o cambio manual | Sí | Sí | Como hoy (no se cierra sola) |
| `confirmada` | Cita creada desde el panel, o solicitud aceptada | Sí | Sí | `completada` **automáticamente** 1 hora después del fin, o a mano |
| `completada` | Cierre automático, o a mano | Sí | Sí | `no_show` o `cancelada` si fue una excepción |
| `cancelada`, `no_show` | A mano | Sí (tachadas) | No | Como hoy |

## 5. Lo que ya existe en la base

El esquema se exportó con `supabase/consultas/exportar_esquema.sql`. No hay que crear de nuevo:

- **`horarios`**: por peluquero. Columnas `dia_semana` (0 a 6), `hora_inicio`, `hora_fin` y `activo`; admite varias franjas por día, así que la colación son dos franjas. **Convención: 0 = domingo … 6 = sábado**, igual que `extract(dow)` en Postgres y `getDay()` en JavaScript.
- **`bloqueos`**: cierres con `inicio`, `fin` y `motivo`. Si `peluquero_id` es null, cierra toda la peluquería.
- **`peluquerias.email`** y **`peluquerias.telefono`**: el correo de avisos y el WhatsApp de la peluquería.
- **RLS:** activado en todas las tablas, con el filtro `peluqueria_id = get_my_peluqueria_id()`. Un visitante sin sesión no ve nada.
- **Llaves foráneas compuestas** en `citas`: `(cliente_id, peluqueria_id)` y `(peluquero_id, peluqueria_id)`.

## 6. Cambios en la base

### 6.1 Migración 001: estados nuevos (✅ ejecutada el 7 de octubre)

Archivo: `supabase/migraciones/001_estados_solicitud.sql`. No rompe nada: todas las filas actuales siguen siendo válidas, y la app no usa los estados nuevos hasta la etapa siguiente.

```sql
begin;

alter table public.citas drop constraint estado_valido;

alter table public.citas add constraint estado_valido check (
  estado in (
    'pendiente', 'confirmada', 'completada', 'cancelada', 'no_show',
    'solicitada', 'rechazada'
  )
);

commit;
```

### 6.2 Migración 002: cierre automático de citas (✅ ejecutada el 7 de octubre)

Archivo: `supabase/migraciones/002_completar_citas_automaticamente.sql`.

- Activa `pg_cron`, equivalente a **Integrations → Cron** en el dashboard de Supabase.
- Crea la función `completar_citas_terminadas()`, que pasa a `completada` las citas `confirmada` cuyo fin fue hace más de una hora. Se le quita `execute` a `public`, `anon` y `authenticated`, así que solo la ejecuta la tarea programada.
- Programa el job `completar-citas-terminadas` cada 15 minutos. Si se vuelve a ejecutar el archivo, el job con el mismo nombre se reemplaza.
- Las citas `pendiente` y `solicitada` no se tocan.

### 6.3 Migración 003: funciones públicas (especificación)

El SQL definitivo va en su propio archivo y **se prueba en local antes de ejecutarlo en Supabase**. Todas las funciones son `security definer` con `search_path` fijo. Se les quita `execute` a `public` y se les da solo a `anon` y `authenticated`. Exponen únicamente lo necesario para reservar.

**`normalizar_telefono(text) → text`** (`immutable`): devuelve los últimos 9 dígitos. `+56 9 6666 6666`, `966666666` y `56966666666` dan el mismo resultado. Va con un índice en `clientes (peluqueria_id, normalizar_telefono(telefono))`.

**`reserva_peluqueria(p_slug text) → jsonb`**

- **Devuelve:** el nombre y el teléfono de la peluquería; los servicios activos (`id`, `nombre`, `descripcion`, `duracion_minutos`, `precio_clp`); los peluqueros activos que tienen al menos un horario (solo `id` y `nombre`).
- **No devuelve:** el correo, el plan, datos de clientes ni de citas.
- Si el slug no existe, devuelve null.

**`reserva_disponibilidad(p_slug text, p_fecha date, p_servicio_ids uuid[], p_peluquero_id uuid default null) → jsonb`**

- **Devuelve:** la lista de horas de inicio libres para esa fecha (hora de Chile). No devuelve qué peluquero queda libre ni ninguna información de otras citas.

**`reserva_crear(p_slug, p_servicio_ids, p_peluquero_id, p_inicio timestamptz, p_nombre, p_telefono, p_email, p_notas) → jsonb`**

1. **Bloqueo:** toma un bloqueo transaccional por peluquería (`pg_advisory_xact_lock`), para que dos solicitudes simultáneas no tomen la misma hora.
2. **Validación:** vuelve a revisar todo con las reglas de §6.4:
   - servicios activos de esa peluquería
   - hora libre
   - nombre de 2 a 120 caracteres
   - teléfono de 8 a 15 dígitos
   - notas de hasta 500 caracteres
3. **Peluquero:** con "sin preferencia", asigna el peluquero libre con menos citas ese día (si empatan, el primero por nombre).
4. **Cliente:** lo busca por teléfono normalizado dentro de la peluquería; si no existe, lo crea con `como_llego = 'reserva en línea'`. Si está **bloqueado**, responde con un error genérico ("No pudimos registrar la reserva, contacta a la peluquería"), sin revelar el motivo.
5. **Límite:** como máximo **2 solicitudes pendientes a futuro por teléfono** en cada peluquería.
6. **Inserción:** crea la cita en estado `solicitada` y su `cita_servicios` con el precio y la duración del catálogo.
7. **Devuelve:** el `id` de la cita, el inicio, el fin, el peluquero, los servicios y el total. Nunca datos de la peluquería que no sean públicos.

### 6.4 Reglas de disponibilidad

Para un peluquero `p`, la hora `t` está libre en la fecha `d`, con duración `D` (la suma de los servicios), si se cumple todo esto:

- `p` está activo.
- Existe un `horarios` activo de `p` para `dow(d)` con `hora_inicio ≤ t` y `t + D ≤ hora_fin`.
- `p` no tiene ninguna cita en estado distinto de `cancelada`, `no_show` y `rechazada` que se cruce con `[t, t + D)`.
- No hay ningún `bloqueo` de `p` ni de toda la peluquería que se cruce con `[t, t + D)`.
- `t` es al menos **2 horas** después de ahora, y `d` está a **30 días** o menos de hoy.
- `t` cae en un múltiplo de **15 minutos**.

Con "sin preferencia", la hora está libre si lo está para **algún** peluquero. En la etapa 1 las tres reglas numéricas son constantes dentro de la función; hacerlas configurables por peluquería requiere columnas nuevas.

## 7. Backend (`app/api`, `app/lib`)

### Ajustes a lo existente

| Archivo | Ajuste |
|---|---|
| `app/api/citas/route.ts` (GET) | Sin el parámetro `estado`, no devuelve `solicitada` ni `rechazada`. Así la agenda no cambia |
| `app/api/citas/[id]/route.ts` (PATCH) | Transiciones permitidas: `solicitada → confirmada` (opcionalmente con otra hora u otro peluquero, revisando cruces como hoy) y `solicitada → rechazada`. No se puede poner `solicitada` a mano, y `rechazada` es final |
| `app/lib/citas.ts` | `rechazada` se suma a los estados que liberan la hora |
| `app/api/dashboard/route.ts` | Excluye `solicitada` y `rechazada` de "Citas hoy" y de los conteos |
| `app/api/reportes/route.ts` | Excluye `solicitada` y `rechazada` del total de citas y del % de no-show |
| `app/api/clientes/[id]/route.ts` | Excluye `solicitada` y `rechazada` de "Citas totales" |

### Nuevo

| Ruta | Acceso | Uso |
|---|---|---|
| `GET /api/reservar/[slug]` | Pública | Llama a `reserva_peluqueria` |
| `GET /api/reservar/[slug]/disponibilidad` | Pública | Llama a `reserva_disponibilidad` con `?fecha=&servicios=&peluquero=` |
| `POST /api/reservar/[slug]` | Pública | Llama a `reserva_crear` y luego envía el aviso por correo |
| `GET`, `PATCH /api/configuracion` | Con sesión | Lee y edita `email` y `telefono` de la peluquería |
| `GET`, `PUT /api/horarios` | Con sesión | Lee y reemplaza las franjas de cada peluquero |
| `GET`, `POST /api/bloqueos` y `DELETE /api/bloqueos/[id]` | Con sesión | Días cerrados y vacaciones |
| `app/lib/avisos.ts` | Solo servidor | Envía el correo de la nueva solicitud |
| `app/lib/supabase/admin.ts` | Solo servidor (`import 'server-only'`) | Cliente con la clave `service_role`. **Solo** lo usa `avisos.ts` para leer `peluquerias.email`, porque el correo no debe quedar expuesto en una función pública |

Las solicitudes se listan con la ruta que ya existe: `GET /api/citas?estado=solicitada&desde=<ahora>`.

## 8. Frontend (`app/`)

### Ajustes

| Archivo | Ajuste |
|---|---|
| `proxy.ts` | Proteger `/solicitudes` y `/configuracion`. `/reservar` queda pública |
| `app/components/Navbar.tsx` | Enlaces "Solicitudes" (con contador) y "Configuración" |
| `app/dashboard/page.tsx` | Tarjeta "Solicitudes por confirmar" que se actualiza cada 60 segundos y lleva a `/solicitudes` |
| `app/clientes/[id]/page.tsx` | Etiquetas de los estados `solicitada` y `rechazada` en el historial |

### Nuevo

- **`/reservar/[slug]` (pública):** los pasos del §3. Pensada para celular.
- **`/solicitudes`:** tarjetas ordenadas por fecha, con aceptar, aceptar con otra hora o peluquero, rechazar y "Avisar por WhatsApp" (`https://wa.me/56XXXXXXXXX?text=...`).
- **`/configuracion`:**
  - correo de avisos y WhatsApp de la peluquería
  - enlace público con botón para copiarlo
  - horarios por peluquero, con "copiar a todos"
  - días cerrados

## 9. Aviso por correo

- **Proveedor:** Resend (u otro servicio de correo transaccional).
- **Variables de entorno**, en Vercel para Production, Preview y Development, y en `.env.local`: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y el remitente.
- **Contenido:** cliente, servicios, fecha, hora, peluquero y el enlace a `/solicitudes`.
- **Si el correo falla, la solicitud igual queda creada** y aparece en "Solicitudes".
- **Por verificar:** para enviar a cualquier dirección, Resend exige un **dominio verificado**. Sin dominio propio, solo se puede probar enviando al correo de la cuenta de Resend. Esto depende de tener un dominio.

## 10. Orden de trabajo

Cada paso es un PR a `dev` que se puede desplegar sin romper lo anterior.

1. **Estados nuevos.** Ejecutar la migración 001 y hacer los ajustes de backend del §7 y la etiqueta de la ficha. Es seguro desplegarlo: nada crea solicitudes todavía.
   - En paralelo, **clientes y cierre automático** (§13), en su propio PR, más la migración 002.
2. **Configuración.** Las APIs de horarios, bloqueos y configuración, la página `/configuracion`, el enlace en el Navbar y `proxy.ts`.
3. **Reserva pública.**
   - Probar la migración 003 en local con el esquema exportado y ejecutarla en Supabase.
   - Hacer las rutas públicas y la página `/reservar/[slug]`.
4. **Solicitudes y avisos.** La página `/solicitudes`, el contador del Navbar, la tarjeta del dashboard y el correo.
5. **Prueba completa** en el preview de Vercel con una peluquería de prueba. Después, `dev` → `main`.

## 11. Fuera de alcance (etapa 2)

- Proponer otra hora con un enlace para que el cliente acepte.
- Vencimiento automático de solicitudes sin respuesta.
- Avisos al cliente: confirmación y recordatorios. Ya existen las columnas `recordatorio_24h_enviado` y `recordatorio_1h_enviado`.
- WhatsApp automático (API de Meta) y chat.
- Acceso propio para peluqueros y recepcionistas. `usuarios.rol` ya los admite, pero las políticas RLS tienen que distinguir roles.
- Reglas de reserva configurables por peluquería.
- Registrar la venta al completar una cita. Las tablas `ventas`, `venta_items` y `comisiones` existen pero la app no las usa; por eso los ingresos aparecen en $0. El cierre automático no registra cobros. Es un trabajo aparte de este plan.

## 12. Pendiente de decidir o verificar

1. **Reglas fijas de la etapa 1:** anticipación de 2 horas, hasta 30 días, intervalos de 15 minutos y máximo 2 solicitudes pendientes por teléfono.
2. **Dominio propio:** lo necesitan el correo de avisos y el enlace que se comparte con los clientes.
3. **Clave `service_role`:** solo en variables de entorno del servidor, nunca con prefijo `NEXT_PUBLIC_` ni en el repo.

## 13. Clientes y cierre automático (implementado)

Decidido durante el paso 1 e implementado en la rama `feature/clientes-historial`:

| Archivo | Cambio |
|---|---|
| `app/clientes/page.tsx` | Sin "+ Nuevo cliente". Parte en "Atendidos" (por visita más reciente), con la columna "Servicio habitual". Filtros: Atendidos, Sin visitar 60+ días, Aún no atendidos, Bloqueados y Todos |
| `app/clientes/[id]/page.tsx` | Tarjeta "Lo que suele pedir": los 3 servicios más pedidos y cada cuánto viene |
| `app/components/ModalNuevaCita.tsx` | Opción "+ Cliente nuevo" con solo nombre y teléfono |
| `app/components/ModalCliente.tsx` | Queda solo para editar |
| `app/dashboard/page.tsx` | El acceso rápido "Nuevo cliente" pasa a "Clientes" |
| `app/api/clientes/route.ts` | `?vista=atendidos` y `?vista=sin-atender`, `servicioHabitual`, y `POST` reutiliza el cliente si el teléfono ya existe |
| `app/api/clientes/[id]/route.ts` | `serviciosFrecuentes` y `cadaCuantosDias`, a partir de las citas completadas |
| `app/api/citas/route.ts` (POST) | Las citas del panel nacen `confirmada` |
| `app/lib/clientes.ts` | `normalizarTelefono` (últimos 9 dígitos), `serviciosFrecuentes` y `diasEntreVisitas` |

Para que la lista de atendidos se llene sola hay que ejecutar la migración 002. Sin ella, las citas solo pasan a `completada` cuando alguien las marca a mano.

## Anexo: observaciones de seguridad del esquema

No bloquean este plan, pero conviene resolverlas antes de cobrar o de dar acceso a los peluqueros:

- **Plan editable por el dueño:** la política de `peluquerias` es `ALL`, así que un dueño, usando su sesión directamente contra la API de Supabase, puede cambiar su `plan` y su `fecha_vencimiento_plan`, o borrar la peluquería (con borrado en cascada).
- **Sin distinción de roles:** las políticas no distinguen roles. Cuando existan usuarios `peluquero` o `recepcionista`, podrán hacer todo lo que hace el dueño, incluido cambiar su propio `rol`.
