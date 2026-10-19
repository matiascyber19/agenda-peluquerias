# Agenda Peluquerías

Panel de gestión para peluquerías y barberías de Chile: agenda por peluquero, reserva en línea (`/reservar/[slug]`), clientes, cobros, comisiones, gastos, reportes, equipo con roles y recordatorios por WhatsApp.

Producción: [agenda-peluquerias-nine.vercel.app](https://agenda-peluquerias-nine.vercel.app)

**Tecnología:** Next.js 16 (App Router), React 19, Tailwind CSS 4 y Supabase (Auth y Postgres, con seguridad por fila para separar las peluquerías y los roles). Se despliega en Vercel.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Necesita un `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

> Esta versión de Next.js tiene cambios respecto de las anteriores (por ejemplo, `proxy.ts` en vez de `middleware.ts`). Ante la duda, la documentación está en `node_modules/next/dist/docs/`.

## Pruebas

```bash
npm test
```

Corren sin conexión, sin Supabase y sin claves, en unos 20 segundos:

- **`pruebas/bd/`**: el esquema inicial y todas las migraciones en un Postgres en memoria (PGlite). Cubre la reserva en línea, los cruces de horario, los cobros dobles, los permisos de cada rol, las comisiones y las invitaciones. Una migración nueva en `supabase/migraciones/` se prueba sola.
- **`pruebas/api/`**: las rutas de login, registro e invitación con un Supabase simulado.
- **`pruebas/*.test.ts`**: fechas en hora de Chile (con los cambios de horario), el mensaje de los recordatorios, los enlaces de WhatsApp y las páginas que ve cada rol.

`npm run test:watch` las repite al guardar. En cada PR y en cada cambio en `dev` y `main`, GitHub Actions corre el estilo (`eslint`), los tipos (`tsc`) y las pruebas.

## Flujo de trabajo

Rama → PR a `dev` → PR de `dev` a `main`. Vercel despliega `main` en producción.

Las migraciones de la base se ejecutan a mano en el SQL Editor de Supabase. El paso a paso está en cada archivo de `supabase/migraciones/`.

## Documentación

- [`docs/puesta-en-marcha.md`](docs/puesta-en-marcha.md): lo que falta configurar en Supabase, Vercel y cada peluquería.
- [`docs/base-de-pruebas.md`](docs/base-de-pruebas.md): cómo crear una base de Supabase separada para pruebas.
- [`docs/plan-reserva-en-linea.md`](docs/plan-reserva-en-linea.md): diseño de la reserva en línea.
