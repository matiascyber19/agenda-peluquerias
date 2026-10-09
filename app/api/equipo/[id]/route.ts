import { createClient } from '@/app/lib/supabase/server'
import { exigirRol } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// PATCH /api/equipo/[id]
// Body: { activo: boolean }
// Desactiva (pierde el acceso al instante) o reactiva una cuenta del equipo.
// Solo el dueño, y no sobre su propia cuenta.
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso

    const { activo } = await request.json().catch(() => ({}))
    if (typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'Indica si la cuenta queda activa' }, { status: 400 })
    }

    // La base revisa que sea de la misma peluquería, que no sea el dueño ni la propia cuenta.
    const { error } = await supabase.rpc('equipo_cambiar_estado', { p_usuario_id: id, p_activo: activo })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'P0001' ? 400 : 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en PATCH /api/equipo/[id]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
