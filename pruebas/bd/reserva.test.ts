import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { baseNueva, comoCuenta, type Fila } from './baseDePrueba'

// Reserva en línea (migraciones 003 y 006): lo que ve un cliente sin sesión
// en /reservar/[slug], las horas libres y la creación de la reserva, con las
// reglas por defecto (horas cada 15 min, 2 h de anticipación, 30 días hacia
// adelante, 2 solicitudes pendientes por cliente).

const PA = '00000000-0000-0000-0000-00000000000a'
const PB = '00000000-0000-0000-0000-00000000000b'
const ANA = '00000000-0000-0000-0000-0000000000a1'
const BETO = '00000000-0000-0000-0000-0000000000a2'
const CIRO = '00000000-0000-0000-0000-0000000000a3' // inactivo
const CORTE = '00000000-0000-0000-0000-00000000c001'
const BARBA = '00000000-0000-0000-0000-00000000c002'
const TINTE = '00000000-0000-0000-0000-00000000c003'
const VIEJO = '00000000-0000-0000-0000-00000000c004' // inactivo
const CORTE_B = '00000000-0000-0000-0000-00000000cb01'

let db: PGlite
let como: ReturnType<typeof comoCuenta>
let LUNES: string, MARTES: string, MIERCOLES: string, DOMINGO: string, HOY: string, EN_40_DIAS: string

/** Como un cliente en la página pública: sin sesión. Devuelve el resultado o el mensaje de error. */
async function publico(sql: string, params: unknown[] = []) {
  const r = await como(null, sql, params)
  return { valor: r.filas[0]?.r as Fila | null, error: r.error }
}
const horas = async (fecha: string, servicios: string[], peluquero: string | null = null) =>
  (await publico(`select reserva_disponibilidad('pelu-a', $1, $2, $3) as r`, [fecha, servicios, peluquero])).valor!
const crear = (inicio: string, servicios: string[], peluquero: string | null, nombre: string, telefono: string, email: string | null = null) =>
  publico(`select reserva_crear('pelu-a', $1, $2, $3, $4, $5, $6, null) as r`, [servicios, peluquero, inicio, nombre, telefono, email])
const inicioDe = (disp: Fila, hora: string) => (disp.horas as Fila[]).find((h) => h.hora === hora)!.inicio as string
const listaDe = (disp: Fila) => (disp.horas as Fila[]).map((h) => h.hora as string)

beforeAll(async () => {
  db = await baseNueva()
  como = comoCuenta(db)

  // Fechas: el próximo lunes con al menos 2 días de margen, en hora de Chile
  const { rows } = await db.query<{ hoy: string }>(`select to_char((now() at time zone 'America/Santiago')::date, 'YYYY-MM-DD') as hoy`)
  HOY = rows[0].hoy
  const base = new Date(`${HOY}T12:00:00Z`)
  const lunes = new Date(base)
  do lunes.setUTCDate(lunes.getUTCDate() + 1)
  while (lunes.getUTCDay() !== 1 || (lunes.getTime() - base.getTime()) / 864e5 < 2)
  const dia = (n: number) => new Date(lunes.getTime() + n * 864e5).toISOString().slice(0, 10)
  ;[LUNES, MARTES, MIERCOLES, DOMINGO] = [dia(0), dia(1), dia(2), dia(6)]
  EN_40_DIAS = new Date(base.getTime() + 40 * 864e5).toISOString().slice(0, 10)

  await db.exec(`
    insert into peluquerias (id, nombre, slug, telefono, email) values
      ('${PA}', 'Peluquería A', 'pelu-a', '+56 9 5555 5555', 'privado@a.cl'),
      ('${PB}', 'Peluquería B', 'pelu-b', null, null);
    insert into peluqueros (id, peluqueria_id, nombre, activo) values
      ('${ANA}', '${PA}', 'Ana', true),
      ('${BETO}', '${PA}', 'Beto', true),
      ('${CIRO}', '${PA}', 'Ciro', false),
      ('00000000-0000-0000-0000-0000000000a4', '${PA}', 'Dani', true),
      ('00000000-0000-0000-0000-0000000000b1', '${PB}', 'Zoe', true);
    -- Ana: lun-sáb 10-14 y 15-19 | Beto: lun-vie 12-20 | Ciro (inactivo): lunes | Dani: sin horario
    insert into horarios (peluquero_id, dia_semana, hora_inicio, hora_fin)
      select '${ANA}', d, t.i, t.f from generate_series(1, 6) d, (values ('10:00'::time, '14:00'::time), ('15:00', '19:00')) t(i, f);
    insert into horarios (peluquero_id, dia_semana, hora_inicio, hora_fin)
      select '${BETO}', d, '12:00', '20:00' from generate_series(1, 5) d;
    insert into horarios (peluquero_id, dia_semana, hora_inicio, hora_fin) values
      ('${CIRO}', 1, '10:00', '19:00'), ('00000000-0000-0000-0000-0000000000b1', 1, '10:00', '19:00');
    insert into servicios (id, peluqueria_id, nombre, duracion_minutos, precio_clp, activo) values
      ('${CORTE}', '${PA}', 'Corte', 30, 8000, true),
      ('${BARBA}', '${PA}', 'Barba', 15, 5000, true),
      ('${TINTE}', '${PA}', 'Tinte', 90, 25000, true),
      ('${VIEJO}', '${PA}', 'Viejo', 30, 1000, false),
      ('${CORTE_B}', '${PB}', 'Corte B', 30, 7000, true);
    insert into clientes (id, peluqueria_id, nombre, telefono, bloqueado) values
      ('00000000-0000-0000-0000-0000000000f1', '${PA}', 'Carla', '+56 9 1111 1111', false),
      ('00000000-0000-0000-0000-0000000000f2', '${PA}', 'Bruno', '922222222', true);
  `)
  // Ana ocupada el lunes 10:00-10:30. Beto tiene una cita cancelada a las 13:00 (no bloquea).
  await db.query(
    `insert into citas (peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado) values
      ('${PA}', '00000000-0000-0000-0000-0000000000f1', '${ANA}',
       ($1::date + time '10:00') at time zone 'America/Santiago', ($1::date + time '10:30') at time zone 'America/Santiago', 'confirmada'),
      ('${PA}', '00000000-0000-0000-0000-0000000000f1', '${BETO}',
       ($1::date + time '13:00') at time zone 'America/Santiago', ($1::date + time '14:00') at time zone 'America/Santiago', 'cancelada')`,
    [LUNES]
  )
  // Martes: Beto con día libre. Miércoles: toda la peluquería cerrada.
  await db.query(
    `insert into bloqueos (peluqueria_id, peluquero_id, inicio, fin, motivo) values
      ('${PA}', '${BETO}', $1::date::timestamp at time zone 'America/Santiago', ($1::date + 1)::timestamp at time zone 'America/Santiago', 'Libre'),
      ('${PA}', null, $2::date::timestamp at time zone 'America/Santiago', ($2::date + 1)::timestamp at time zone 'America/Santiago', 'Feriado')`,
    [MARTES, MIERCOLES]
  )
})

describe('datos públicos de la peluquería', () => {
  it('muestra nombre y teléfono, solo servicios activos y solo peluqueros activos con horario', async () => {
    const info = (await publico(`select reserva_peluqueria('pelu-a') as r`)).valor!
    expect(info).toMatchObject({ nombre: 'Peluquería A', telefono: '+56 9 5555 5555' })
    expect((info.servicios as Fila[]).map((s) => s.nombre)).toEqual(['Barba', 'Corte', 'Tinte'])
    expect((info.peluqueros as Fila[]).map((p) => p.nombre)).toEqual(['Ana', 'Beto'])
  })

  it('no expone el correo de la peluquería, y un enlace inexistente no muestra nada', async () => {
    const info = (await publico(`select reserva_peluqueria('pelu-a') as r`)).valor
    expect(JSON.stringify(info)).not.toContain('privado@a.cl')
    expect((await publico(`select reserva_peluqueria('no-existe') as r`)).valor).toBeNull()
  })
})

describe('horas disponibles', () => {
  it('descuenta las citas tomadas, no las canceladas, y el servicio termina dentro del horario', async () => {
    const lunes = await horas(LUNES, [CORTE])
    const hs = listaDe(lunes)
    expect(lunes.duracion_minutos).toBe(30)
    expect(hs).not.toContain('10:00') // Ana ocupada; Beto entra a las 12:00
    expect(hs).toContain('10:30')
    expect(hs).toContain('13:00') // la cancelada de Beto no bloquea
    expect(hs).toContain('19:30') // Beto hasta las 20:00
    expect(hs).not.toContain('19:45')
    expect(hs.every((h) => ['00', '15', '30', '45'].includes(h.slice(3)))).toBe(true)
  })

  it('un servicio largo no cruza la colación', async () => {
    const tinte = listaDe(await horas(LUNES, [TINTE], ANA))
    expect(tinte).toContain('12:30')
    expect(tinte).not.toContain('12:45')
    expect(tinte).not.toContain('14:00')
  })

  it('"inicio" corresponde a la hora de Chile', async () => {
    const inicio = inicioDe(await horas(LUNES, [CORTE]), '12:00')
    const { rows } = await db.query<{ l: string }>(`select to_char($1::timestamptz at time zone 'America/Santiago', 'YYYY-MM-DD HH24:MI') as l`, [inicio])
    expect(rows[0].l).toBe(`${LUNES} 12:00`)
  })

  it('respeta días libres, días cerrados, días sin horario y los límites de anticipación', async () => {
    const martes = listaDe(await horas(MARTES, [CORTE]))
    expect(martes.length).toBeGreaterThan(0)
    expect(martes.some((h) => h >= '19:00')).toBe(false) // Beto libre: solo Ana, hasta las 19:00
    expect(listaDe(await horas(MIERCOLES, [CORTE]))).toEqual([])
    expect(listaDe(await horas(DOMINGO, [CORTE]))).toEqual([])
    const hoy = (await horas(HOY, [CORTE])).horas as Fila[]
    expect(hoy.every((h) => new Date(h.inicio).getTime() - Date.now() >= 2 * 3600e3)).toBe(true)
    expect(listaDe(await horas(EN_40_DIAS, [CORTE]))).toEqual([])
  })

  it.each([
    ['un servicio de otra peluquería', [CORTE_B], null, 'Algún servicio ya no está disponible'],
    ['un servicio inactivo', [VIEJO], null, 'Algún servicio ya no está disponible'],
    ['un servicio repetido', [CORTE, CORTE], null, 'Elegiste un servicio más de una vez'],
    ['ningún servicio', [], null, 'Elige entre 1 y 5 servicios'],
    ['un peluquero inactivo', [CORTE], CIRO, 'Ese peluquero no está disponible'],
  ])('rechaza %s', async (_caso, servicios, peluquero, mensaje) => {
    const r = await publico(`select reserva_disponibilidad('pelu-a', $1, $2, $3) as r`, [LUNES, servicios, peluquero])
    expect(r.error).toBe(mensaje)
  })
})

describe('crear la reserva', () => {
  let inicio12: string
  let citaBeto: string

  beforeAll(async () => {
    inicio12 = inicioDe(await horas(LUNES, [CORTE]), '12:00')
  })

  it('"sin preferencia" asigna al que tiene menos citas ese día y congela los precios', async () => {
    const r = await crear(inicio12, [CORTE, BARBA], null, 'Nuevo Cliente', '+56 9 3333 3333', 'nuevo@correo.cl')
    expect(r.error).toBeNull()
    expect(r.valor).toMatchObject({ peluquero: 'Beto', total_clp: 13000 })
    citaBeto = r.valor!.cita_id
    const { rows } = await db.query<Fila>(
      `select estado, round(extract(epoch from fin - inicio) / 60)::int as min,
              (select sum(precio_congelado_clp)::int from cita_servicios where cita_id = $1) as total
         from citas where id = $1`, [citaBeto])
    expect(rows[0]).toEqual({ estado: 'solicitada', min: 45, total: 13000 })
  })

  it('el cliente nuevo queda registrado como "reserva en línea" (lo usa la guía para empezar)', async () => {
    const { rows } = await db.query<Fila>(`select como_llego, email from clientes where telefono = '+56 9 3333 3333'`)
    expect(rows[0]).toEqual({ como_llego: 'reserva en línea', email: 'nuevo@correo.cl' })
  })

  it('la misma hora ya no está disponible con ese peluquero, pero "sin preferencia" pasa a otro', async () => {
    expect((await crear(inicio12, [CORTE], BETO, 'Otro', '944444444')).error).toBe('Esa hora ya no está disponible. Elige otra.')
    expect((await crear(inicio12, [CORTE], null, 'Carla de nuevo', '911111111')).valor).toMatchObject({ peluquero: 'Ana' })
  })

  it('un teléfono escrito distinto reutiliza al cliente, sin duplicarlo', async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from clientes where peluqueria_id = '${PA}' and normalizar_telefono(telefono) = '911111111'`)
    expect(rows[0].n).toBe(1)
  })

  it('un cliente bloqueado recibe un mensaje genérico', async () => {
    const inicio16 = inicioDe(await horas(LUNES, [CORTE]), '16:00')
    expect((await crear(inicio16, [CORTE], null, 'Bruno', '+56 9 2222 2222')).error)
      .toBe('No pudimos registrar la reserva. Contacta a la peluquería.')
  })

  it('una hora fuera de la grilla de 15 minutos se rechaza', async () => {
    const { rows } = await db.query<{ t: string }>(`select (($1::date + time '12:05') at time zone 'America/Santiago') as t`, [LUNES])
    expect((await crear(rows[0].t, [CORTE], null, 'Alguien', '955555555')).error).toBe('Esa hora ya no está disponible. Elige otra.')
  })

  it('un cliente tiene como máximo 2 solicitudes esperando confirmación', async () => {
    const disp = await horas(LUNES, [CORTE])
    await crear(inicioDe(disp, '16:00'), [CORTE], null, 'Carla', '911111111')
    expect((await crear(inicioDe(disp, '17:00'), [CORTE], null, 'Carla', '911111111')).error)
      .toBe('Ya tienes 2 reservas pendientes en esta peluquería. Espera su respuesta o contáctala.')
  })

  it.each([
    ['nombre muy corto', 'X', '966666666', null, 'Escribe tu nombre (entre 2 y 120 letras)'],
    ['teléfono corto', 'Alguien', '123', null, 'El teléfono debe tener entre 8 y 15 dígitos'],
    ['correo inválido', 'Alguien', '966666666', 'no-es-correo', 'El correo no es válido'],
  ])('rechaza un %s', async (_caso, nombre, telefono, email, mensaje) => {
    expect((await crear(inicio12, [CORTE], null, nombre, telefono, email)).error).toBe(mensaje)
  })

  it('la solicitud bloquea la hora, y al rechazarla se libera', async () => {
    expect(listaDe(await horas(LUNES, [CORTE], BETO))).not.toContain('12:00')
    await db.query(`update citas set estado = 'rechazada' where id = $1`, [citaBeto])
    expect(listaDe(await horas(LUNES, [CORTE], BETO))).toContain('12:00')
  })
})

describe('permisos de las funciones públicas', () => {
  const puede = async (funcion: string) =>
    (await db.query<{ p: boolean }>(`select has_function_privilege('anon', $1, 'execute') as p`, [funcion])).rows[0].p

  it('sin sesión se pueden usar las tres funciones de la página de reservas', async () => {
    expect(await puede('public.reserva_peluqueria(text)')).toBe(true)
    expect(await puede('public.reserva_disponibilidad(text, date, uuid[], uuid)')).toBe(true)
    expect(await puede('public.reserva_crear(text, uuid[], uuid, timestamptz, text, text, text, text)')).toBe(true)
  })

  it('sin sesión no se pueden usar las funciones auxiliares', async () => {
    expect(await puede('public.reserva_duracion(uuid, uuid[])')).toBe(false)
  })
})
