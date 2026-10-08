import { createClient } from '@/app/lib/supabase/server'
import { esFecha } from '@/app/lib/fechas'
import { errorDeReserva, UUID } from '@/app/lib/reserva'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/reservar/[slug]/disponibilidad?fecha=2026-10-12&servicios=uuid,uuid&peluquero=uuid
// Horas libres de ese día para los servicios elegidos. Sin `peluquero` es
// "sin preferencia". Ruta pública (sin sesión).
// Devuelve { fecha, duracion_minutos, horas: [{ inicio, hora }] }
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const servicios = (searchParams.get('servicios') ?? '').split(',').filter(Boolean)
  const peluquero = searchParams.get('peluquero')

  if (!esFecha(fecha)) {
    return NextResponse.json({ error: 'Elige un día' }, { status: 400 })
  }
  if (servicios.length === 0 || servicios.some((id) => !UUID.test(id))) {
    return NextResponse.json({ error: 'Elige al menos un servicio' }, { status: 400 })
  }
  if (peluquero && !UUID.test(peluquero)) {
    return NextResponse.json({ error: 'Ese peluquero no está disponible' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reserva_disponibilidad', {
    p_slug: slug,
    p_fecha: fecha,
    p_servicio_ids: servicios,
    p_peluquero_id: peluquero || null,
  })

  if (error) {
    const { mensaje, status } = errorDeReserva(error)
    return NextResponse.json({ error: mensaje }, { status })
  }
  if (!data) {
    return NextResponse.json({ error: 'Esta peluquería no existe' }, { status: 404 })
  }

  return NextResponse.json(data)
}
