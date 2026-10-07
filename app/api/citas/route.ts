import { createClient } from '@/app/lib/supabase/server'
import { type Embebido, uno } from '@/app/lib/supabase/embebido'
import { buscarCruce, describirCruce, FILTRO_CITAS_DE_AGENDA, validarParticipantes } from '@/app/lib/citas'
import { NextResponse } from 'next/server'

interface ServicioCatalogo {
  id: string
  nombre: string
  precio_clp: number
  duracion_minutos: number
  activo: boolean
}

interface CitaRow {
  id: string
  inicio: string
  fin: string | null
  estado: string
  notas: string | null
  clientes: Embebido<{ nombre: string; telefono: string | null }>
  peluqueros: Embebido<{ id: string; nombre: string; color_agenda: string | null }>
  cita_servicios:
    | {
        precio_congelado_clp: number
        duracion_congelada_min: number
        servicios: Embebido<{ nombre: string }>
      }[]
    | null
}

// ============================================
// GET /api/citas
// Lista citas con filtros opcionales:
//   ?fecha=2026-06-08        (día completo)
//   ?peluquero_id=uuid       (filtrar por peluquero)
//   ?estado=pendiente        (filtrar por estado)
//   ?desde=2026-06-01&hasta=2026-06-30  (rango; acepta ISO completo)
// Devuelve { citas: [{ id, inicio, fin, estado, notas, cliente, peluquero, servicios }] }
// ============================================
export async function GET(request: Request) {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Leer parámetros de la URL
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const peluquero_id = searchParams.get('peluquero_id')
  const estado = searchParams.get('estado')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // 3. Consulta base con relaciones correctas
  let query = supabase
    .from('citas')
    .select(`
      id,
      inicio,
      fin,
      estado,
      notas,
      clientes ( id, nombre, telefono ),
      peluqueros ( id, nombre, color_agenda ),
      cita_servicios (
        precio_congelado_clp,
        duracion_congelada_min,
        servicios ( id, nombre )
      )
    `)
    .order('inicio', { ascending: true })

  // 4. Filtros opcionales
  if (fecha) {
    query = query
      .gte('inicio', `${fecha}T00:00:00`)
      .lte('inicio', `${fecha}T23:59:59`)
  }

  // Aceptan tanto YYYY-MM-DD como un instante ISO completo (2026-06-08T12:00:00.000Z)
  if (desde) {
    query = query.gte('inicio', desde.includes('T') ? desde : `${desde}T00:00:00`)
  }

  if (hasta) {
    query = query.lte('inicio', hasta.includes('T') ? hasta : `${hasta}T23:59:59`)
  }

  if (peluquero_id) {
    query = query.eq('peluquero_id', peluquero_id)
  }

  // Sin un estado explícito se devuelven solo las citas de la agenda: las
  // solicitudes en línea se consultan con ?estado=solicitada.
  if (estado) {
    query = query.eq('estado', estado)
  } else {
    query = query.or(FILTRO_CITAS_DE_AGENDA)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const citas = ((data ?? []) as unknown as CitaRow[]).map((cita) => {
    const cliente = uno(cita.clientes)
    const peluquero = uno(cita.peluqueros)

    return {
      id: cita.id,
      inicio: cita.inicio,
      fin: cita.fin,
      estado: cita.estado,
      notas: cita.notas,
      cliente: cliente
        ? { nombre: cliente.nombre, telefono: cliente.telefono }
        : null,
      peluquero: peluquero
        ? {
            id: peluquero.id,
            nombre: peluquero.nombre,
            color_agenda: peluquero.color_agenda,
          }
        : null,
      servicios: (cita.cita_servicios ?? []).map((cs) => ({
        nombre: uno(cs.servicios)?.nombre ?? 'Servicio',
        duracion_minutos: cs.duracion_congelada_min,
        precio_clp: cs.precio_congelado_clp,
      })),
    }
  })

  return NextResponse.json({ citas })
}

// ============================================
// POST /api/citas
// Crea una cita desde el panel. Nace 'confirmada': la agenda la crea la propia
// peluquería, y una cita confirmada pasa sola a 'completada' una hora después
// de terminar (supabase/migraciones/002_completar_citas_automaticamente.sql).
// Body esperado:
// {
//   cliente_id: "uuid",
//   peluquero_id: "uuid",
//   inicio: "2026-06-08T15:00:00Z",
//   servicios: [{ servicio_id: "uuid" }, { servicio_id: "uuid" }],
//   notas: "opcional"
// }
// Precio y duración se leen de la tabla servicios: si vienen en el body se
// ignoran, para que nadie pueda agendar a $0 editando el pedido.
// ============================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Obtener peluqueria_id del usuario
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('peluqueria_id')
      .eq('id', user.id)
      .single()

    if (usuarioError || !usuario?.peluqueria_id) {
      return NextResponse.json(
        { error: 'Usuario sin peluquería asociada' },
        { status: 403 }
      )
    }

    // 3. Leer body
    const body = await request.json()
    const { cliente_id, peluquero_id, inicio, servicios, notas } = body

    // 4. Validaciones
    if (!cliente_id || !peluquero_id || !inicio) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: cliente_id, peluquero_id, inicio' },
        { status: 400 }
      )
    }

    if (!servicios || !Array.isArray(servicios) || servicios.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un servicio' },
        { status: 400 }
      )
    }

    const inicioFecha = new Date(inicio)
    if (Number.isNaN(inicioFecha.getTime())) {
      return NextResponse.json({ error: 'La fecha de inicio no es válida' }, { status: 400 })
    }

    const errorParticipantes = await validarParticipantes(supabase, {
      clienteId: cliente_id,
      peluqueroId: peluquero_id,
    })
    if (errorParticipantes) {
      return NextResponse.json({ error: errorParticipantes }, { status: 400 })
    }

    // 5. Precio y duración vigentes de cada servicio, leídos de la base.
    // RLS solo devuelve servicios de esta peluquería.
    const idsPedidos: unknown[] = servicios.map((s: { servicio_id?: unknown }) => s?.servicio_id)
    if (idsPedidos.some((id) => typeof id !== 'string' || !id)) {
      return NextResponse.json({ error: 'Cada servicio debe indicar su servicio_id' }, { status: 400 })
    }
    const ids = idsPedidos as string[]

    const { data: catalogo, error: catalogoError } = await supabase
      .from('servicios')
      .select('id, nombre, precio_clp, duracion_minutos, activo')
      .in('id', [...new Set(ids)])

    if (catalogoError) {
      return NextResponse.json({ error: catalogoError.message }, { status: 500 })
    }

    const porId = new Map(((catalogo ?? []) as ServicioCatalogo[]).map((s) => [s.id, s]))
    const elegidos: ServicioCatalogo[] = []
    for (const id of ids) {
      const servicio = porId.get(id)
      if (!servicio) {
        return NextResponse.json({ error: 'Algún servicio no existe en tu peluquería' }, { status: 400 })
      }
      if (!servicio.activo) {
        return NextResponse.json({ error: `El servicio "${servicio.nombre}" está inactivo` }, { status: 400 })
      }
      elegidos.push(servicio)
    }

    // 6. Calcular hora de fin y comprobar que el peluquero esté libre
    const duracionTotal = elegidos.reduce((total, s) => total + s.duracion_minutos, 0)
    const inicioIso = inicioFecha.toISOString()
    const fin = new Date(inicioFecha.getTime() + duracionTotal * 60000).toISOString()

    const { cruce, error: cruceError } = await buscarCruce(supabase, {
      peluqueroId: peluquero_id,
      inicio: inicioIso,
      fin,
    })
    if (cruceError) {
      return NextResponse.json({ error: cruceError.message }, { status: 500 })
    }
    if (cruce) {
      return NextResponse.json({ error: describirCruce(cruce) }, { status: 409 })
    }

    // 7. Crear la cita
    const { data: cita, error: citaError } = await supabase
      .from('citas')
      .insert({
        peluqueria_id: usuario.peluqueria_id,
        cliente_id,
        peluquero_id,
        inicio: inicioIso,
        fin,
        estado: 'confirmada',
        notas: notas || null,
      })
      .select()
      .single()

    if (citaError) {
      return NextResponse.json({ error: citaError.message }, { status: 500 })
    }

    // 8. Insertar servicios de la cita con el precio y la duración de hoy
    const citaServiciosInsert = elegidos.map((s) => ({
      cita_id: cita.id,
      servicio_id: s.id,
      precio_congelado_clp: s.precio_clp,
      duracion_congelada_min: s.duracion_minutos,
    }))

    const { error: csError } = await supabase
      .from('cita_servicios')
      .insert(citaServiciosInsert)

    if (csError) {
      // Si falla, borramos la cita para no dejar registros huérfanos
      await supabase.from('citas').delete().eq('id', cita.id)
      return NextResponse.json(
        { error: `Error al agregar servicios: ${csError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      cita_id: cita.id,
      message: 'Cita creada correctamente',
    })
  } catch (error) {
    console.error('Error en POST /api/citas:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}