import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { baseNueva, MIGRACIONES, sqlDeMigracion, verificacionDe } from './baseDePrueba'

describe('esquema y migraciones', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await baseNueva()
  })

  it('el esquema inicial y todas las migraciones se ejecutan en orden', async () => {
    expect(MIGRACIONES[0]).toMatch(/^001_/)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_tables where schemaname = 'public'`
    )
    expect(rows[0].n).toBeGreaterThan(10)
  })

  // Las guías dicen que se pueden volver a ejecutar sin problema (por ejemplo,
  // si alguien no está seguro de haberlas corrido). Desde la 005 se cumple.
  it.each(MIGRACIONES.filter((m) => m >= '005'))('%s se puede ejecutar dos veces', async (archivo) => {
    await expect(db.exec(sqlDeMigracion(archivo))).resolves.toBeDefined()
  })

  // Cada verificación se revisa justo después de su migración: la 006, por
  // ejemplo, reemplaza las políticas que revisaba la 004.
  it('cada migración con consulta de verificación da todo en true al ejecutarla', async () => {
    const revisadas: string[] = []
    await baseNueva(async (archivo, base) => {
      const verificacion = verificacionDe(archivo)
      if (!verificacion) return
      const { rows } = await base.query<Record<string, boolean>>(verificacion)
      const fallidas = Object.entries(rows[0])
        .filter(([, valor]) => valor !== true)
        .map(([columna]) => columna)
      expect({ archivo, fallidas }).toEqual({ archivo, fallidas: [] })
      revisadas.push(archivo)
    })
    expect(revisadas.length).toBeGreaterThanOrEqual(4)
  })
})
