import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// DELETE /api/bloqueos/[id]
// Reabre los días de un cierre (borra el bloqueo).
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // RLS solo deja borrar bloqueos de esta peluquería.
    const { data, error } = await supabase.from('bloqueos').delete().eq('id', id).select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/bloqueos/', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
