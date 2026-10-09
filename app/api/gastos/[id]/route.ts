import { createClient } from '@/app/lib/supabase/server'
import { exigirRol } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// DELETE /api/gastos/[id]
// Borra un gasto registrado por error. Solo el dueño.
// ============================================
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso

    const { data, error } = await supabase.from('gastos').delete().eq('id', id).select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/gastos/[id]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
