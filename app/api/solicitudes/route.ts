import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria, exigirRol } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/solicitudes
// Cuántas reservas en línea esperan respuesta (para el Navbar y el dashboard,
// que lo consultan cada minuto). Solo cuenta las de horas que aún no pasan.
// El detalle se lista con GET /api/citas?estado=solicitada&desde=<ahora>.
// Devuelve { pendientes }
// ============================================
export async function GET() {
  const supabase = await createClient()
  // Solo dueño y recepcionista
  const sinPermiso = await exigirRol(supabase, ['dueño', 'recepcionista'])
  if (sinPermiso) return sinPermiso
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { count, error } = await supabase
    .from('citas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'solicitada')
    .gte('inicio', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pendientes: count ?? 0 })
}
