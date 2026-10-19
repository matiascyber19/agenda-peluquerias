import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

// Base de datos de prueba: un Postgres en memoria (PGlite) con el esquema
// inicial y todas las migraciones de supabase/migraciones, en orden. No toca
// Supabase. Cada archivo de prueba arma la suya.

const SUPABASE = fileURLToPath(new URL('../../supabase/', import.meta.url))

export function leer(archivo: string) {
  return readFileSync(`${SUPABASE}${archivo}`, 'utf8')
}

export const MIGRACIONES = readdirSync(`${SUPABASE}migraciones`)
  .filter((f) => f.endsWith('.sql'))
  .sort()

/**
 * Lo que Supabase trae y el esquema da por hecho: los roles anon y
 * authenticated, auth.users, auth.uid() (aquí se lee de la variable
 * prueba.uid) y pg_cron, que se reemplaza por una tabla. No se dan permisos
 * automáticos a las tablas nuevas: así se detecta una migración sin `grant`.
 */
const ENTORNO_SUPABASE = `
  set timezone to 'UTC';
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema cron;
  create table cron.job (jobname text primary key, schedule text, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as
    $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = s, command = c; select 1::bigint $$;
  grant usage on schema cron to anon, authenticated;
`

/** El SQL de una migración tal como se ejecuta aquí (sin activar pg_cron, que no existe en PGlite). */
export function sqlDeMigracion(archivo: string) {
  const sql = leer(`migraciones/${archivo}`)
  return sql
    .split('\n')
    .filter((linea) => !/pg_cron|schema cron|in schema cron/.test(linea))
    .join('\n')
}

/** La consulta "Verificación: todo en true" del final de una migración, si la tiene. */
export function verificacionDe(archivo: string) {
  const sql = leer(`migraciones/${archivo}`)
  const desde = sql.indexOf('-- Verificación: todo en true')
  if (desde < 0) return null
  const hasta = sql.indexOf('-- Para deshacer', desde)
  return sql.slice(desde, hasta < 0 ? undefined : hasta)
}

/**
 * Base con el esquema inicial y todas las migraciones. `despuesDe` se llama
 * justo después de cada migración (para revisar su verificación en ese punto:
 * una migración posterior puede cambiar lo que la anterior revisaba).
 */
export async function baseNueva(despuesDe?: (archivo: string, db: PGlite) => Promise<void>) {
  const db = new PGlite({ extensions: { btree_gist, uuid_ossp } })
  await db.exec(ENTORNO_SUPABASE)
  await db.exec('set search_path to public, extensions')
  await db.exec(leer('esquema_inicial.sql'))
  for (const archivo of MIGRACIONES) {
    await db.exec(sqlDeMigracion(archivo))
    await despuesDe?.(archivo, db)
  }
  return db
}

// Las filas de la base llegan sin tipo: cada prueba sabe qué columnas pidió.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fila = Record<string, any>

export interface Resultado {
  filas: Fila[]
  /** Filas afectadas (en un update o delete) o devueltas. */
  n: number
  error: string | null
}

/**
 * Ejecuta SQL como una cuenta, con las políticas de seguridad (RLS) activas:
 * `uid` con sesión (rol authenticated) o null sin sesión (rol anon). Cada
 * llamada es su propia transacción; un error no detiene la prueba, se devuelve.
 */
export function comoCuenta(db: PGlite) {
  return async function como(uid: string | null, sql: string, params: unknown[] = []): Promise<Resultado> {
    try {
      return await db.transaction(async (tx) => {
        await tx.exec(
          `set local role ${uid ? 'authenticated' : 'anon'};
           select set_config('prueba.uid', '${uid ?? ''}', true);
           set local search_path to public, extensions;`
        )
        const r = await tx.query<Fila>(sql, params)
        return { filas: r.rows, n: r.affectedRows ?? r.rows.length, error: null }
      })
    } catch (e) {
      return { filas: [], n: 0, error: (e as Error).message }
    }
  }
}
