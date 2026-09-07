import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/citas
// Lista citas con filtros opcionales:
//   ?fecha=2026-06-08        (día completo)
//   ?peluquero_id=uuid       (filtrar por peluquero)
//   ?estado=pendiente        (filtrar por estado)
//   ?desde=2026-06-01&hasta=2026-06-30  (rango de fechas)
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

  if (desde) {
    query = query.gte('inicio', `${desde}T00:00:00`)
  }

  if (hasta) {
    query = query.lte('inicio', `${hasta}T23:59:59`)
  }

  if (peluquero_id) {
    query = query.eq('peluquero_id', peluquero_id)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ citas: data })
}

// ============================================
// POST /api/citas
// Crea una cita nueva
// Body esperado:
// {
//   cliente_id: "uuid",
//   peluquero_id: "uuid",
//   inicio: "2026-06-08T15:00:00Z",
//   servicios: [
//     { servicio_id: "uuid", precio: 8000, duracion: 30 },
//     { servicio_id: "uuid", precio: 5000, duracion: 20 }
//   ],
//   notas: "opcional"
// }
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

    // 5. Calcular hora de fin sumando la duración total de servicios
    const duracionTotal = servicios.reduce(
      (total: number, s: any) => total + (s.duracion || 0),
      0
    )
    const fin = new Date(new Date(inicio).getTime() + duracionTotal * 60000).toISOString()

    // 6. Crear la cita
    const { data: cita, error: citaError } = await supabase
      .from('citas')
      .insert({
        peluqueria_id: usuario.peluqueria_id,
        cliente_id,
        peluquero_id,
        inicio,
        fin,
        estado: 'pendiente',
        notas: notas || null,
      })
      .select()
      .single()

    if (citaError) {
      return NextResponse.json({ error: citaError.message }, { status: 500 })
    }

    // 7. Insertar servicios de la cita
    const citaServiciosInsert = servicios.map((s: any) => ({
      cita_id: cita.id,
      servicio_id: s.servicio_id,
      precio_congelado_clp: s.precio,
      duracion_congelada_min: s.duracion,
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