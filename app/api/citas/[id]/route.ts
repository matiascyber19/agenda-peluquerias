import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// PATCH /api/citas/[id]
// Actualiza una cita existente
// Body esperado (todos opcionales):
// {
//   estado: "confirmada" | "completada" | "cancelada" | "no_show" | "pendiente",
//   inicio: "2026-06-08T15:00:00Z",
//   fin: "2026-06-08T15:30:00Z",
//   notas: "texto",
//   peluquero_id: "uuid",
//   cliente_id: "uuid"
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

    // 2. Leer el body
    const body = await request.json()
    const { estado, inicio, fin, notas, peluquero_id, cliente_id } = body

    // 3. Validar estado si viene
    const estadosValidos = ['pendiente', 'confirmada', 'completada', 'cancelada', 'no_show']
    if (estado && !estadosValidos.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` },
        { status: 400 }
      )
    }

    // 4. Construir objeto solo con campos que llegaron
    const updates: any = {}
    if (estado !== undefined) updates.estado = estado
    if (inicio !== undefined) updates.inicio = inicio
    if (fin !== undefined) updates.fin = fin
    if (notas !== undefined) updates.notas = notas
    if (peluquero_id !== undefined) updates.peluquero_id = peluquero_id
    if (cliente_id !== undefined) updates.cliente_id = cliente_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    // 5. Actualizar la cita
    // RLS se encarga de que solo pueda modificar citas de su peluquería
    const { data, error } = await supabase
      .from('citas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cita: data,
      message: 'Cita actualizada correctamente',
    })
  } catch (error) {
    console.error('Error en PATCH /api/citas/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/citas/[id]
// Cancela una cita (soft delete: cambia estado a 'cancelada')
// No borra el registro para mantener historial
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

    // 2. Cambiar estado a 'cancelada' (soft delete)
    const { data, error } = await supabase
      .from('citas')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cita cancelada correctamente',
    })
  } catch (error) {
    console.error('Error en DELETE /api/citas/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}