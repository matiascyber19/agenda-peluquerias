import { createClient } from '@/app/lib/supabase/server'
import { normalizarTelefono, serviciosFrecuentes } from '@/app/lib/clientes'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Leer parámetros de la URL
  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')
  const bloqueado = searchParams.get('bloqueado')
  // ?vista=atendidos: solo quienes tienen una cita completada, por visita más reciente.
  // ?vista=sin-atender: quienes todavía no completan ninguna (p. ej. solo reservaron).
  const vista = searchParams.get('vista')
  // Un ?limit inválido o desmedido no debe llegar a la consulta.
  const limitPedido = Number(searchParams.get('limit'))
  const limit =
    Number.isInteger(limitPedido) && limitPedido > 0 ? Math.min(limitPedido, 500) : 100

  // 3. Consulta base
  let query = supabase
    .from('clientes')
    .select(`
      id,
      nombre,
      telefono,
      email,
      cumpleanos,
      como_llego,
      notas,
      bloqueado,
      creado_en,
      citas(
      inicio,
      estado,
      cita_servicios(id, servicios(nombre))
      ),
      ventas(
      total_clp
      )
    `)
    .order('nombre', { ascending: true })
    .limit(limit)

  // 4. Filtro de búsqueda (nombre o teléfono)
  // PostgREST lee , ( ) . como sintaxis dentro de .or(): si llegan en el valor
  // el usuario puede inyectar condiciones extra, así que se descartan.
  if (buscar) {
    const termino = buscar.replace(/[,()."\\]/g, '').trim()
    if (termino) {
      query = query.or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%`)
    }
  }

  // 5. Filtro por bloqueado
  if (bloqueado !== null) {
    query = query.eq('bloqueado', bloqueado === 'true')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let clientes = (data || []).map((cliente) => {
    const citasCompletadas = (cliente.citas || [])
      .filter((cita) => cita.estado === 'completada')
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())

    // Solo servicios ya realizados, igual que la última visita: una cita
    // pendiente todavía no cuenta como servicio prestado.
    const cantidadServicios = citasCompletadas.reduce(
      (total, cita) => total + (cita.cita_servicios?.length || 0), 0)

    const gastoTotal = (cliente.ventas || []).reduce(
      (total, venta) => total + (venta.total_clp || 0), 0)

    return{
      id:cliente.id,
      nombre:cliente.nombre,
      telefono:cliente.telefono,
      email:cliente.email,
      cumpleanos:cliente.cumpleanos,
      como_llego:cliente.como_llego,
      notas:cliente.notas,
      bloqueado:cliente.bloqueado,
      creado_en:cliente.creado_en,
      ultimaVisita: citasCompletadas[0]?.inicio || null,
      servicios: cantidadServicios,
      servicioHabitual: serviciosFrecuentes(citasCompletadas, 1)[0] ?? null,
      gasto: gastoTotal,
    }
  })

  // Las vistas se resuelven sobre los clientes ya leídos (hasta `limit`):
  // PostgREST no puede ordenar por la fecha de una relación embebida.
  if (vista === 'atendidos') {
    clientes = clientes
      .filter((cliente) => cliente.ultimaVisita)
      .sort((a, b) => new Date(b.ultimaVisita!).getTime() - new Date(a.ultimaVisita!).getTime())
  } else if (vista === 'sin-atender') {
    clientes = clientes.filter((cliente) => !cliente.ultimaVisita)
  }

  return NextResponse.json({clientes, total:clientes.length,})
}

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
    const { nombre, telefono, email, cumpleanos, como_llego, notas } = body

    // 4. Validaciones básicas
    if (!nombre || !telefono) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son obligatorios' },
        { status: 400 }
      )
    }

    // 5. Validar formato de teléfono (mínimo 8 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '') // quita todo lo que no sea número
    if (telefonoLimpio.length < 8) {
      return NextResponse.json(
        { error: 'El teléfono debe tener al menos 8 dígitos' },
        { status: 400 }
      )
    }

    // 6. Si ya hay un cliente con ese teléfono se reutiliza: desde "Nueva cita"
    //    se crea con solo nombre y teléfono, y no debe duplicar fichas.
    const { data: existentes, error: existentesError } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, bloqueado')
      .eq('peluqueria_id', usuario.peluqueria_id)

    if (existentesError) {
      return NextResponse.json({ error: existentesError.message }, { status: 500 })
    }

    const existente = (existentes ?? []).find(
      (cliente) => normalizarTelefono(cliente.telefono) === normalizarTelefono(telefono)
    )
    if (existente) {
      return NextResponse.json({
        success: true,
        existente: true,
        cliente: existente,
        message: `Ya existía un cliente con ese teléfono: ${existente.nombre}`,
      })
    }

    // 7. Crear el cliente
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        peluqueria_id: usuario.peluqueria_id,
        nombre,
        telefono,
        email: email || null,
        cumpleanos: cumpleanos || null,
        como_llego: como_llego || null,
        notas: notas || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cliente: data,
      message: 'Cliente creado correctamente',
    })
  } catch (error) {
    console.error('Error en POST /api/clientes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}