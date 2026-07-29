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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // 3. Historial de citas (últimas 20)
    const { data: citas } = await supabase
      .from('citas')
      .select(`
        id,
        inicio,
        fin,
        estado,
        notas,
        peluqueros ( nombre ),
        cita_servicios (
          precio_congelado_clp,
          servicios ( nombre )
        )
      `)
      .eq('cliente_id', id)
      .order('inicio', { ascending: false })
      .limit(20)

    // 4. Historial de ventas (últimas 20)
    const { data: ventas } = await supabase
      .from('ventas')
      .select(`
        id,
        total_clp,
        medio_pago,
        fecha,
        peluqueros ( nombre ),
        venta_items ( nombre, cantidad, subtotal_clp )
      `)
      .eq('cliente_id', id)
      .order('fecha', { ascending: false })
      .limit(20)

    // 5. Estadísticas
    const totalCitas = citas?.length || 0
    const noShows = citas?.filter(c => c.estado === 'no_show').length || 0
    const completadas = citas?.filter(c => c.estado === 'completada').length || 0
    const gastoTotal = ventas?.reduce((sum, v) => sum + (v.total_clp || 0), 0) || 0
    const ultimaVisita = citas?.find(c => c.estado === 'completada')?.inicio || null

    return NextResponse.json({
      cliente,
      historial: {
        citas: citas || [],
        ventas: ventas || [],
      },
      estadisticas: {
        totalCitas,
        completadas,
        noShows,
        gastoTotal,
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