import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/clientes/[id]
// Devuelve la ficha completa del cliente:
//   - Datos personales
//   - Historial de citas (últimas 20)
//   - Historial de ventas (últimas 20)
//   - Estadísticas: total citas, no-shows, gasto total
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Verificar sesión
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // 2. Obtener datos del cliente
    // RLS impide consultar clientes de otra peluquería
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select(`
        id,
        nombre,
        telefono,
        email,
        cumpleanos,
        como_llego,
        notas,
        foto_url,
        bloqueado,
        creado_en
      `)
      .eq('id', id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // 3. Historial visible de citas, últimas 20
    const { data: citas, error: citasError } = await supabase
      .from('citas')
      .select(`
        id,
        inicio,
        fin,
        estado,
        notas,
        peluqueros (
          id,
          nombre
        ),
        cita_servicios (
          precio_congelado_clp,
          duracion_congelada_min,
          servicios (
            id,
            nombre
          )
        )
      `)
      .eq('cliente_id', id)
      .order('inicio', { ascending: false })
      .limit(20)

    if (citasError) {
      return NextResponse.json(
        { error: `Error al cargar citas: ${citasError.message}` },
        { status: 500 }
      )
    }

    // 4. Historial visible de ventas, últimas 20
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select(`
        id,
        total_clp,
        medio_pago,
        fecha,
        peluqueros (
          id,
          nombre
        ),
        venta_items (
          id,
          tipo,
          nombre,
          cantidad,
          precio_unitario_clp,
          subtotal_clp
        )
      `)
      .eq('cliente_id', id)
      .order('fecha', { ascending: false })
      .limit(20)

    if (ventasError) {
      return NextResponse.json(
        { error: `Error al cargar ventas: ${ventasError.message}` },
        { status: 500 }
      )
    }

    // 5. Consultar TODAS las citas necesarias para estadísticas
    const { data: citasEstadisticas, error: citasEstadisticasError } =
      await supabase
        .from('citas')
        .select('inicio, estado')
        .eq('cliente_id', id)

    if (citasEstadisticasError) {
      return NextResponse.json(
        {
          error: `Error al calcular estadísticas de citas: ${citasEstadisticasError.message}`,
        },
        { status: 500 }
      )
    }

    // 6. Consultar TODAS las ventas necesarias para gasto total
    const { data: ventasEstadisticas, error: ventasEstadisticasError } =
      await supabase
        .from('ventas')
        .select('total_clp')
        .eq('cliente_id', id)

    if (ventasEstadisticasError) {
      return NextResponse.json(
        {
          error: `Error al calcular estadísticas de ventas: ${ventasEstadisticasError.message}`,
        },
        { status: 500 }
      )
    }

    const todasLasCitas = citasEstadisticas || []
    const todasLasVentas = ventasEstadisticas || []

    const totalCitas = todasLasCitas.length

    const completadas = todasLasCitas.filter(
      (cita) => cita.estado === 'completada'
    ).length

    const canceladas = todasLasCitas.filter(
      (cita) => cita.estado === 'cancelada'
    ).length

    const noShows = todasLasCitas.filter(
      (cita) => cita.estado === 'no_show'
    ).length

    const gastoTotal = todasLasVentas.reduce(
      (total, venta) => total + (venta.total_clp || 0),
      0
    )

    const visitasCompletadas = todasLasCitas
      .filter((cita) => cita.estado === 'completada')
      .sort(
        (a, b) =>
          new Date(b.inicio).getTime() -
          new Date(a.inicio).getTime()
      )

    const ultimaVisita = visitasCompletadas[0]?.inicio || null

    const promedioGasto =
      todasLasVentas.length > 0
        ? Math.round(gastoTotal / todasLasVentas.length)
        : 0

    // 7. Respuesta para el frontend de Mati
    return NextResponse.json({
      cliente,
      historial: {
        citas: citas || [],
        ventas: ventas || [],
      },
      estadisticas: {
        totalCitas,
        completadas,
        canceladas,
        noShows,
        gastoTotal,
        promedioGasto,
        ultimaVisita,
      },
    })
  } catch (error) {
    console.error('Error en GET /api/clientes/', error)

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH /api/clientes/[id]
// Actualiza datos del cliente
// Body esperado (todos opcionales):
// {
//   nombre, telefono, email, cumpleanos,
//   como_llego, notas, bloqueado
// }
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Leer body
    const body = await request.json()
    const { nombre, telefono, email, cumpleanos, como_llego, notas, bloqueado } = body

    // 3. Construir objeto solo con campos que llegaron
    const updates: any = {}
    if (nombre !== undefined) updates.nombre = nombre
    if (telefono !== undefined) updates.telefono = telefono
    if (email !== undefined) updates.email = email
    if (cumpleanos !== undefined) updates.cumpleanos = cumpleanos
    if (como_llego !== undefined) updates.como_llego = como_llego
    if (notas !== undefined) updates.notas = notas
    if (bloqueado !== undefined) updates.bloqueado = bloqueado

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    // 4. Validar teléfono si viene
    if (updates.telefono) {
      const telefonoLimpio = updates.telefono.replace(/\D/g, '')
      if (telefonoLimpio.length < 8) {
        return NextResponse.json(
          { error: 'El teléfono debe tener al menos 8 dígitos' },
          { status: 400 }
        )
      }
    }

    // 5. Actualizar (RLS filtra por peluquería automáticamente)
    const { data, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cliente: data,
      message: 'Cliente actualizado correctamente',
    })
  } catch (error) {
    console.error('Error en PATCH /api/clientes/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/clientes/[id]
// Bloquea al cliente (soft delete)
// No borra porque las citas tienen FK RESTRICT
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Marcar como bloqueado (soft delete)
    const { data, error } = await supabase
      .from('clientes')
      .update({ bloqueado: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente bloqueado correctamente',
    })
  } catch (error) {
    console.error('Error en DELETE /api/clientes/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}