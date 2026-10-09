import { createClient } from '@/app/lib/supabase/server'
import { exigirRol } from '@/app/lib/sesion'
import { fechaEnChile } from '@/app/lib/fechas'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/comisiones/pagar
// Body: { peluquero_id }
// Marca como pagadas, con fecha de hoy, todas las comisiones pendientes de ese
// peluquero. Solo el dueño. Devuelve { pagadas, monto }.
// ============================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso

    const { peluquero_id } = await request.json().catch(() => ({}))
    if (typeof peluquero_id !== 'string' || !peluquero_id) {
      return NextResponse.json({ error: 'Indica el peluquero' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('comisiones')
      .update({ pagado: true, fecha_pago: fechaEnChile(new Date()) })
      .eq('peluquero_id', peluquero_id)
      .eq('pagado', false)
      .select('monto_clp')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const filas = data ?? []
    if (filas.length === 0) {
      return NextResponse.json({ error: 'No hay comisiones pendientes para ese peluquero' }, { status: 404 })
    }

    return NextResponse.json({
      pagadas: filas.length,
      monto: filas.reduce((suma, f) => suma + f.monto_clp, 0),
    })
  } catch (error) {
    console.error('Error en POST /api/comisiones/pagar', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
