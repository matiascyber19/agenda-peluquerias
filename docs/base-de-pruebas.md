# Base de datos de pruebas

Hoy producción, los previews de Vercel y el desarrollo local usan **la misma base de Supabase**. Una prueba puede dejar datos falsos a la vista de las peluquerías, y una migración se prueba directamente sobre los datos reales.

La solución es un **segundo proyecto de Supabase, solo para pruebas**. Vercel permite usar valores distintos de las variables de entorno según el ambiente: producción sigue con la base real, y los previews y el desarrollo local usan la de pruebas.

## 1. Crear el proyecto de pruebas

1. En Supabase: **New project**. Nombre: `agenda-peluquerias-pruebas`, en la misma región que producción. El plan gratis permite dos proyectos activos.
2. En **SQL Editor**, ejecutar en este orden, cada archivo completo:
   1. `supabase/esquema_inicial.sql`: las tablas, funciones y políticas que tenía la base el 7 de octubre de 2026.
   2. `supabase/migraciones/001_estados_solicitud.sql`
   3. `supabase/migraciones/002_completar_citas_automaticamente.sql`
   4. `supabase/migraciones/003_reserva_publica.sql`
   5. `supabase/migraciones/004_permisos.sql`
   6. `supabase/migraciones/005_proteccion_cruces_y_cobros.sql`
3. En **Authentication → Sign In / Providers → Email**, dejar **Confirm email** igual que en producción. El registro de la app entra directo al panel, así que necesita la confirmación desactivada.
4. En **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/auth/confirmar` y `https://agenda-peluquerias-*.vercel.app/auth/confirmar`. Esta última cubre los previews.

Probé esta secuencia en una base vacía (PGlite, Postgres 18): el esquema y las 5 migraciones se ejecutan sin errores, y funcionan el registro, la creación de servicios y peluqueros, la página pública, la reserva en línea, el rechazo de una hora tomada, los permisos y la tarea programada.

## 2. Conectar los ambientes

Los valores salen de **Project Settings → API Keys** de cada proyecto.

| Variable | Production (Vercel) | Preview (Vercel) y `.env.local` |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | proyecto real | proyecto de pruebas |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | proyecto real | proyecto de pruebas |
| `SUPABASE_SECRET_KEY` | proyecto real | proyecto de pruebas |

1. En Vercel, en **Settings → Environment Variables**, editar cada variable: el valor de **Production** queda como está, y el de **Preview** se cambia por el del proyecto de pruebas.
2. En el computador, `.env.local` con los valores de pruebas.
3. Volver a desplegar los previews. Las variables `NEXT_PUBLIC_` se fijan al compilar.

## 3. Cómo trabajar desde ahora

- **Probar en local o en un preview:** se crea una cuenta con `/registro` y se cargan servicios, peluqueros y horarios de prueba. Nada de eso llega a producción.
- **Migración nueva:** va en `supabase/migraciones/` con el número siguiente. Se ejecuta **primero en pruebas** y, cuando el código esté en producción, en la base real.
- **Revisar si las dos bases siguen iguales:** ejecutar `supabase/consultas/exportar_esquema.sql` en ambas y comparar.
