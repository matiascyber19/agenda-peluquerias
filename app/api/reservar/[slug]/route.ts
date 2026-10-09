import { createClient } from '@/app/lib/supabase/server'
import { errorDeReserva, UUID } from '@/app/lib/reserva'
import { avisarNuevaSolicitud } from '@/app/lib/avisos'
import { after, NextResponse } from 'next/server'

// Rutas públicas (sin sesión): todo pasa por las funciones de la migración
// 003, que validan y exponen solo lo necesario para reservar.

// ============================================
// GET /api/reservar/[slug]
// Nombre, contacto, servicios activos y peluqueros con horario.
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('reserva_peluqueria', { p_slug: slug })

  if (error) {
    const { mensaje, status } = errorDeReserva(error)
    return NextResponse.json({ error: mensaje }, { status })
  }
  if (!data) {
    return NextResponse.json({ error: 'Esta peluquería no existe' }, { status: 404 })
  }

  return NextResponse.json({ peluqueria: data })
}

// ============================================
// POST /api/reservar/[slug]
// Crea la reserva: 'solicitada', o 'confirmada' si la peluquería confirma
// automáticamente (reglas de la migración 006).
// Body: { servicio_ids: ["uuid"], peluquero_id: "uuid" | null, inicio: "ISO",
//         nombre, telefono, email?, notas? }
// Responde 409 si la hora se tomó mientras el cliente elegía.
// ============================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { servicio_ids, peluquero_id, inicio, nombre, telefono, email, notas } = await request.json()

    if (!Array.isArray(servicio_ids) || servicio_ids.some((id) => typeof id !== 'string' || !UUID.test(id))) {
      return NextResponse.json({ error: 'Elige al menos un servicio' }, { status: 400 })
    }
    if (peluquero_id && (typeof peluquero_id !== 'string' || !UUID.test(peluquero_id))) {
      return NextResponse.json({ error: 'Ese peluquero no está disponible' }, { status: 400 })
    }
    if (typeof inicio !== 'string' || Number.isNaN(new Date(inicio).getTime())) {
      return NextResponse.json({ error: 'Elige una hora' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('reserva_crear', {
      p_slug: slug,
      p_servicio_ids: servicio_ids,
      p_peluquero_id: peluquero_id || null,
      p_inicio: inicio,
      p_nombre: typeof nombre === 'string' ? nombre : '',
      p_telefono: typeof telefono === 'string' ? telefono : '',
      p_email: typeof email === 'string' ? email : null,
      p_notas: typeof notas === 'string' ? notas : null,
    })

    if (error) {
      const { mensaje, status } = errorDeReserva(error)
      return NextResponse.json({ error: mensaje }, { status })
    }

    // El correo al encargado se envía después de responder: el cliente no
    // espera por él, y si falla la solicitud igual queda en "Solicitudes".
    const urlBase = new URL(request.url).origin
    after(() => avisarNuevaSolicitud(data.cita_id, urlBase))

    return NextResponse.json({ success: true, reserva: data })
  } catch (error) {
    console.error('Error en POST /api/reservar/', error)
    return NextResponse.json({ error: 'No pudimos procesar la reserva. Intenta de nuevo.' }, { status: 500 })
  }
}
