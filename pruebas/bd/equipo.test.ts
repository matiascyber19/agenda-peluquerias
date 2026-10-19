import { beforeAll, describe, expect, it } from 'vitest'
import { baseNueva, comoCuenta } from './baseDePrueba'

// Equipo con roles (migraciones 006 y 007): invitaciones, permisos de cada rol
// con las políticas de la base (RLS), comisiones y cuentas desactivadas.
// Las pruebas de este archivo comparten la base y van en orden.

const U = {
  duena: '00000000-0000-0000-0000-0000000000d1',
  recep: '00000000-0000-0000-0000-0000000000e1',
  ana: '00000000-0000-0000-0000-0000000000a1',
  pedro: '00000000-0000-0000-0000-0000000000a2',
  otra: '00000000-0000-0000-0000-0000000000b1',
  intruso: '00000000-0000-0000-0000-0000000000f1',
}

let como: ReturnType<typeof comoCuenta>
const uno = async (uid: string | null, sql: string, params?: unknown[]) => (await como(uid, sql, params)).filas[0]

let A: string // peluquería de la dueña
let ana: string // ficha de Ana (creada por la dueña)
let beto: string // ficha de Beto (sin cuenta)
let cliente: string

beforeAll(async () => {
  const db = await baseNueva()
  como = comoCuenta(db)
  for (const [nombre, id] of Object.entries(U)) await db.query('insert into auth.users values ($1, $2)', [id, `${nombre}@prueba.cl`])

  A = (await uno(U.duena, `select registrar_peluqueria('Salón A', 'salon-a', 'Dueña') as id`)).id
  await uno(U.otra, `select registrar_peluqueria('Salón B', 'salon-b', 'Otra') as id`)
  const cat = await uno(
    U.duena,
    `with a as (insert into peluqueros (peluqueria_id, nombre, porcentaje_comision, tipo_contrato, color_agenda)
                values ($1, 'Ana', 40, 'comision', '#3b82f6') returning id),
          b as (insert into peluqueros (peluqueria_id, nombre) values ($1, 'Beto') returning id),
          c as (insert into clientes (peluqueria_id, nombre, telefono) values ($1, 'Cliente', '911111111') returning id)
     select (select id from a) ana, (select id from b) beto, (select id from c) cliente`,
    [A]
  )
  ;({ ana, beto, cliente } = cat)
})

describe('invitaciones', () => {
  it('la dueña invita a una recepcionista y a una ficha existente (token de 64 caracteres)', async () => {
    const r = await uno(U.duena, `insert into invitaciones (peluqueria_id, rol) values ($1, 'recepcionista') returning token`, [A])
    expect(r.token).toHaveLength(64)
    const conFicha = await como(U.duena, `insert into invitaciones (peluqueria_id, rol, peluquero_id) values ($1, 'peluquero', $2)`, [A, ana])
    expect(conFicha.error).toBeNull()
  })

  it('alguien sin peluquería no puede crear invitaciones', async () => {
    const r = await como(U.recep, `insert into invitaciones (peluqueria_id, rol) values ($1, 'recepcionista')`, [A])
    expect(r.error).not.toBeNull()
  })

  it('sin sesión se ve la invitación, y un token falso no muestra nada', async () => {
    const { token } = await uno(U.duena, `select token from invitaciones where rol = 'recepcionista'`)
    const r = await uno(null, `select invitacion_ver($1) as d`, [token])
    expect(r.d).toMatchObject({ vigente: true, peluqueria: 'Salón A', rol: 'recepcionista' })
    expect((await uno(null, `select invitacion_ver('corto') as d`)).d).toBeNull()
  })

  it('aceptar exige sesión, y una invitación no sirve dos veces', async () => {
    const { token } = await uno(U.duena, `select token from invitaciones where rol = 'recepcionista'`)
    expect((await como(null, `select invitacion_aceptar($1, 'Rita')`, [token])).error).not.toBeNull()
    const r = await uno(U.recep, `select invitacion_aceptar($1, 'Rita') as d`, [token])
    expect(r.d.rol).toBe('recepcionista')
    expect((await como(U.intruso, `select invitacion_aceptar($1, 'Otro')`, [token])).error).toMatch(/no es válida/)
  })

  it('con ficha: Ana queda vinculada a su ficha, sin crear otra', async () => {
    const { token } = await uno(U.duena, `select token from invitaciones where peluquero_id = $1`, [ana])
    expect((await como(U.ana, `select invitacion_aceptar($1, 'Ana María')`, [token])).error).toBeNull()
    expect(await uno(U.ana, `select mi_rol() as rol, mi_peluquero_id() as p`)).toEqual({ rol: 'peluquero', p: ana })
    expect((await uno(U.duena, `select count(*)::int as n from peluqueros where peluqueria_id = $1`, [A])).n).toBe(2)
  })

  it('sin ficha (007): al aceptar se crea la ficha con su nombre y el color menos usado', async () => {
    const { token } = await uno(U.duena, `insert into invitaciones (peluqueria_id, rol) values ($1, 'peluquero') returning token`, [A])
    expect((await uno(null, `select invitacion_ver($1) as d`, [token])).d).toMatchObject({ rol: 'peluquero', peluquero: null })
    expect((await como(U.pedro, `select invitacion_aceptar($1, '  Pedro Pérez ')`, [token])).error).toBeNull()

    const { p } = await uno(U.pedro, `select mi_peluquero_id() as p`)
    const ficha = await uno(U.duena, `select nombre, usuario_id, color_agenda from peluqueros where id = $1`, [p])
    // Ana tiene azul; Beto, el azul por defecto en mayúsculas: el siguiente libre es el rojo
    expect(ficha).toEqual({ nombre: 'Pedro Pérez', usuario_id: U.pedro, color_agenda: '#ef4444' })
  })

  it('una invitación de recepcionista no puede llevar ficha', async () => {
    const r = await como(U.duena, `insert into invitaciones (peluqueria_id, rol, peluquero_id) values ($1, 'recepcionista', $2)`, [A, beto])
    expect(r.error).toMatch(/invitacion_ficha_solo_peluquero/)
  })

  it('una cuenta que ya está en una peluquería no puede aceptar otra invitación ni crear otra peluquería', async () => {
    const { token } = await uno(U.duena, `insert into invitaciones (peluqueria_id, rol) values ($1, 'peluquero') returning token`, [A])
    expect((await como(U.duena, `select invitacion_aceptar($1, 'X')`, [token])).error).toMatch(/ya pertenece/)
    expect((await como(U.ana, `select registrar_peluqueria('Otra', 'otra-mas', 'Ana')`)).error).toMatch(/ya tiene una peluquería/)
  })
})

describe('permisos por rol', () => {
  const nuevaCita = (peluquero: string, horas: number) =>
    `insert into citas (peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado)
     values ('${A}', '${cliente}', '${peluquero}', now() + interval '${horas} hours', now() + interval '${horas} hours 30 minutes', 'confirmada')
     returning id`
  let citaAna: string
  let citaBeto: string

  beforeAll(async () => {
    citaAna = (await uno(U.duena, nuevaCita(ana, 30))).id
    citaBeto = (await uno(U.duena, nuevaCita(beto, 30))).id
  })

  it('recepcionista: ve y agenda todas las citas', async () => {
    expect((await como(U.recep, `select id from citas`)).filas).toHaveLength(2)
    expect((await como(U.recep, nuevaCita(beto, 40))).error).toBeNull()
  })

  it('recepcionista: no toca el catálogo, la configuración ni los gastos, y solo ve su cuenta', async () => {
    expect((await como(U.recep, `insert into servicios (peluqueria_id, nombre, duracion_minutos, precio_clp) values ($1, 'X', 10, 1)`, [A])).error).not.toBeNull()
    expect((await como(U.recep, `update peluquerias set reserva_activa = false`)).n).toBe(0)
    expect((await como(U.recep, `insert into gastos (peluqueria_id, descripcion, monto_clp, fecha) values ($1, 'x', 1, current_date)`, [A])).error).not.toBeNull()
    expect((await como(U.recep, `select * from usuarios`)).filas).toHaveLength(1)
  })

  it('peluquero: solo ve, agenda y modifica sus propias citas', async () => {
    const r = await como(U.ana, `select id from citas`)
    expect(r.filas.map((f) => f.id)).toEqual([citaAna])
    expect((await como(U.ana, nuevaCita(beto, 50))).error).not.toBeNull()
    expect((await como(U.ana, nuevaCita(ana, 50))).error).toBeNull()
    expect((await como(U.ana, `update citas set estado = 'no_show' where id = $1`, [citaBeto])).n).toBe(0)
    expect((await como(U.ana, `update citas set peluquero_id = $1 where id = $2`, [beto, citaAna])).error).not.toBeNull()
  })

  it('peluquero: puede marcar el recordatorio de su cita, no el de otra', async () => {
    expect((await como(U.ana, `update citas set recordatorio_24h_enviado = true where id = $1`, [citaAna])).n).toBe(1)
    expect((await como(U.ana, `update citas set recordatorio_24h_enviado = true where id = $1`, [citaBeto])).n).toBe(0)
  })

  it('peluquero: ve los clientes pero no los edita, y no ve gastos', async () => {
    expect((await como(U.ana, `select id from clientes`)).filas).toHaveLength(1)
    expect((await como(U.ana, `update clientes set nombre = 'x'`)).n).toBe(0)
    expect((await como(U.ana, `select * from gastos`)).filas).toHaveLength(0)
  })

  it('otra peluquería no ve nada de la A', async () => {
    expect((await como(U.otra, `select id from citas`)).filas).toHaveLength(0)
    expect((await como(U.otra, `select id from clientes`)).filas).toHaveLength(0)
  })

  it('sin sesión no se ve nada', async () => {
    expect((await como(null, `select id from citas`)).filas).toHaveLength(0)
  })
})

describe('comisiones', () => {
  let citaComision: string

  beforeAll(async () => {
    citaComision = (await uno(U.duena,
      `insert into citas (peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado)
       values ($1, $2, $3, now() + interval '60 hours', now() + interval '60 hours 30 minutes', 'confirmada') returning id`,
      [A, cliente, ana])).id
  })

  it('al cobrar se calcula la comisión con el porcentaje del peluquero, y al anular se borra', async () => {
    const venta = await uno(U.recep,
      `insert into ventas (peluqueria_id, cita_id, cliente_id, peluquero_id, total_clp, medio_pago)
       values ($1, $2, $3, $4, 15000, 'efectivo') returning id`, [A, citaComision, cliente, ana])
    expect(await uno(U.duena, `select monto_clp, pagado from comisiones where venta_id = $1`, [venta.id]))
      .toEqual({ monto_clp: 6000, pagado: false }) // 40 % de $15.000
    expect((await como(U.recep, `select * from comisiones`)).filas).toHaveLength(0)
    expect((await como(U.ana, `select monto_clp from comisiones`)).filas).toEqual([{ monto_clp: 6000 }])
    expect((await como(U.ana, `update comisiones set pagado = true`)).n).toBe(0)
    expect((await como(U.recep, `delete from ventas where id = $1`, [venta.id])).n).toBe(1)
    expect((await uno(U.duena, `select count(*)::int as n from comisiones`)).n).toBe(0)
  })

  it('un cobro con la comisión ya pagada no se puede anular', async () => {
    const venta = await uno(U.duena,
      `insert into ventas (peluqueria_id, cita_id, peluquero_id, total_clp, medio_pago)
       values ($1, $2, $3, 10000, 'debito') returning id`, [A, citaComision, ana])
    await como(U.duena, `update comisiones set pagado = true, fecha_pago = current_date`)
    expect((await como(U.duena, `delete from ventas where id = $1`, [venta.id])).error).toMatch(/ya se pagó/)
  })

  it('un peluquero con 0 % no genera comisión', async () => {
    await como(U.duena, `insert into ventas (peluqueria_id, peluquero_id, total_clp, medio_pago) values ($1, $2, 10000, 'efectivo')`, [A, beto])
    expect((await uno(U.duena, `select count(*)::int as n from comisiones where peluquero_id = $1`, [beto])).n).toBe(0)
  })
})

describe('cuentas del equipo', () => {
  it('solo la dueña desactiva cuentas, nunca la suya ni las de otra peluquería', async () => {
    expect((await como(U.recep, `select equipo_cambiar_estado($1, false)`, [U.ana])).error).toMatch(/Solo el dueño/)
    expect((await como(U.duena, `select equipo_cambiar_estado($1, false)`, [U.duena])).error).toMatch(/propia cuenta/)
    expect((await como(U.otra, `select equipo_cambiar_estado($1, false)`, [U.ana])).error).toMatch(/no es de tu peluquería/)
  })

  it('una cuenta desactivada pierde el acceso y lo recupera al reactivarla', async () => {
    expect((await como(U.duena, `select equipo_cambiar_estado($1, false)`, [U.ana])).error).toBeNull()
    expect((await como(U.ana, `select id from citas`)).filas).toHaveLength(0)
    expect((await uno(U.ana, `select mi_rol() as rol`)).rol).toBeNull()
    await como(U.duena, `select equipo_cambiar_estado($1, true)`, [U.ana])
    expect((await como(U.ana, `select id from citas`)).filas.length).toBeGreaterThan(0)
  })
})
