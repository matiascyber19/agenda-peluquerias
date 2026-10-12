import { createClient } from '@/app/lib/supabase/server'
import { exigirRol, usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/guia
// Pasos para dejar lista una peluquería nueva (la guía del dashboard). Cada
// paso se deduce de los datos, no se marca a mano. Solo el dueño.
// Devuelve {
//   pasos: { servicios, peluqueros, horarios, whatsapp, primeraReserva },
//   slug, reservaActiva
// }
// ============================================
export async function GET() {
  const supabase = await createClient()
  const sinPermiso = await exigirRol(supabase, ['dueño'])
  if (sinPermiso) return sinPermiso
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const id = sesion.peluqueriaId

  // `activo` puede venir nulo en filas antiguas: nulo cuenta como activo.
  const [peluqueria, servicios, peluqueros, clientesEnLinea, solicitudes] = await Promise.all([
    supabase.from('peluquerias').select('slug, telefono, reserva_activa').eq('id', id).maybeSingle(),
    supabase.from('servicios').select('id', { count: 'exact', head: true }).eq('peluqueria_id', id).not('activo', 'is', false),
    supabase.from('peluqueros').select('id').eq('peluqueria_id', id).not('activo', 'is', false),
    supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('peluqueria_id', id)
      .eq('como_llego', 'reserva en línea'),
    // Una solicitud (aunque después se rechace) solo puede venir de la reserva en línea
    supabase
      .from('citas')
      .select('id', { count: 'exact', head: true })
      .eq('peluqueria_id', id)
      .in('estado', ['solicitada', 'propuesta', 'rechazada']),
  ])

  const error = peluqueria.error ?? servicios.error ?? peluqueros.error ?? clientesEnLinea.error ?? solicitudes.error
  if (error || !peluqueria.data) {
    return NextResponse.json({ error: 'No pudimos revisar la configuración' }, { status: 500 })
  }

  // Horarios de algún peluquero activo: sin ellos la página de reservas no muestra horas.
  const idsActivos = (peluqueros.data ?? []).map((p) => p.id)
  let conHorario = 0
  if (idsActivos.length > 0) {
    const horarios = await supabase
      .from('horarios')
      .select('id', { count: 'exact', head: true })
      .in('peluquero_id', idsActivos)
      .not('activo', 'is', false)
    if (horarios.error) {
      return NextResponse.json({ error: 'No pudimos revisar los horarios' }, { status: 500 })
    }
    conHorario = horarios.count ?? 0
  }

  return NextResponse.json({
    pasos: {
      servicios: (servicios.count ?? 0) > 0,
      peluqueros: idsActivos.length > 0,
      horarios: conHorario > 0,
      whatsapp: Boolean(peluqueria.data.telefono?.trim()),
      primeraReserva: (clientesEnLinea.count ?? 0) + (solicitudes.count ?? 0) > 0,
    },
    slug: peluqueria.data.slug,
    reservaActiva: peluqueria.data.reserva_activa !== false,
  })
}
