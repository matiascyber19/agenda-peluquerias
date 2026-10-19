import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { baseNueva } from './baseDePrueba'

// La base impide citas cruzadas y cobros dobles (migración 005). La app
// traduce el error 23P01 a "Esa hora ya no está disponible".

const P = '10000000-0000-0000-0000-000000000001'
const C = '40000000-0000-0000-0000-000000000001'
const UNO = '30000000-0000-0000-0000-000000000001'
const DOS = '30000000-0000-0000-0000-000000000002'

let db: PGlite

const cita = (id: string, peluquero: string, inicio: string, fin: string, estado: string | null) =>
  `insert into citas (id, peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado)
   values ('${id}', '${P}', '${C}', '${peluquero}', '${inicio}', '${fin}', ${estado === null ? 'null' : `'${estado}'`})`

/** Código del error de Postgres, o null si se aceptó. */
async function codigo(sql: string) {
  try {
    await db.exec(sql)
    return null
  } catch (e) {
    return (e as { code?: string }).code ?? 'sin código'
  }
}

beforeAll(async () => {
  db = await baseNueva()
  await db.exec(`
    insert into peluquerias (id, nombre, slug) values ('${P}', 'A', 'a');
    insert into peluqueros (id, peluqueria_id, nombre) values ('${UNO}', '${P}', 'Uno'), ('${DOS}', '${P}', 'Dos');
    insert into clientes (id, peluqueria_id, nombre, telefono) values ('${C}', '${P}', 'Cliente', '912345678');
  `)
  await db.exec(cita('50000000-0000-0000-0000-000000000001', UNO, '2026-10-20 13:00Z', '2026-10-20 14:00Z', 'confirmada'))
  await db.exec(cita('50000000-0000-0000-0000-000000000002', UNO, '2026-10-20 13:30Z', '2026-10-20 14:30Z', 'cancelada'))
})

describe('citas sin cruces', () => {
  // En orden: algunos casos dependen de los anteriores
  it.each([
    ['una cita que se cruza con una confirmada del mismo peluquero', cita('50000000-0000-0000-0000-000000000003', UNO, '2026-10-20 13:45Z', '2026-10-20 14:15Z', 'confirmada'), '23P01'],
    ['una solicitud en línea que se cruza', cita('50000000-0000-0000-0000-000000000004', UNO, '2026-10-20 13:00Z', '2026-10-20 13:30Z', 'solicitada'), '23P01'],
    ['una cita sin estado que se cruza', cita('50000000-0000-0000-0000-000000000005', UNO, '2026-10-20 12:30Z', '2026-10-20 13:30Z', null), '23P01'],
    ['otro peluquero a la misma hora', cita('50000000-0000-0000-0000-000000000006', DOS, '2026-10-20 13:00Z', '2026-10-20 14:00Z', 'confirmada'), null],
    ['una cita pegada (empieza cuando termina la otra)', cita('50000000-0000-0000-0000-000000000007', UNO, '2026-10-20 14:00Z', '2026-10-20 14:30Z', 'confirmada'), null],
    ['una cancelada encima de otra', cita('50000000-0000-0000-0000-000000000008', UNO, '2026-10-20 13:00Z', '2026-10-20 14:00Z', 'cancelada'), null],
    ['un no-show encima de otra', cita('50000000-0000-0000-0000-000000000009', UNO, '2026-10-20 13:00Z', '2026-10-20 14:00Z', 'no_show'), null],
    ['reactivar una cancelada que se cruza', `update citas set estado = 'confirmada' where id = '50000000-0000-0000-0000-000000000002'`, '23P01'],
    ['mover una cita encima de otra', `update citas set inicio = '2026-10-20 13:30Z', fin = '2026-10-20 14:00Z' where id = '50000000-0000-0000-0000-000000000007'`, '23P01'],
    ['el cierre automático (confirmada → completada)', `update citas set estado = 'completada' where id = '50000000-0000-0000-0000-000000000001'`, null],
  ])('%s → %s', async (_caso, sql, esperado) => {
    expect(await codigo(sql)).toBe(esperado)
  })
})

describe('un cobro por cita', () => {
  it('el primer cobro se acepta y el segundo de la misma cita se rechaza', async () => {
    const venta = `insert into ventas (peluqueria_id, cita_id, total_clp, medio_pago) values ('${P}', '50000000-0000-0000-0000-000000000001', 1, 'efectivo')`
    expect(await codigo(venta)).toBeNull()
    expect(await codigo(venta)).toBe('23505')
  })

  it('las ventas sin cita (productos sueltos) pueden ser varias', async () => {
    expect(await codigo(`insert into ventas (peluqueria_id, total_clp, medio_pago) values ('${P}', 1, 'efectivo'), ('${P}', 1, 'efectivo')`)).toBeNull()
  })
})
