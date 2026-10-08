import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { uno } from '@/app/lib/supabase/embebido'
import { esFecha, fechaEnChile, inicioDelDiaEnChile, sumarDias } from '@/app/lib/fechas'
import { NextResponse } from 'next/server'

const MAX_DIAS_POR_BLOQUEO = 366

// ============================================
// GET /api/bloqueos
// Días cerrados vigentes o futuros (tabla `bloqueos`).
// Devuelve { bloqueos: [{ id, desde, hasta, peluquero: { id, nombre } | null, motivo }] }
// `desde` y `hasta` son fechas AAAA-MM-DD en Chile; peluquero null = toda la peluquería.
// ============================================
export async function GET() {
  const supabase = await createClient()
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('bloqueos')
    .select('id, inicio, fin, motivo, peluqueros(id, nombre)')
    .gte('fin', new Date().toISOString())
    .order('inicio', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const bloqueos = (data ?? []).map((bloqueo) => ({
    id: bloqueo.id,
    desde: fechaEnChile(new Date(bloqueo.inicio)),
    // `fin` es la medianoche del día siguiente: el último día cerrado es el anterior.
    hasta: fechaEnChile(new Date(new Date(bloqueo.fin).getTime() - 1)),
    peluquero: uno(bloqueo.peluqueros),
    motivo: bloqueo.motivo,
  }))

  return NextResponse.json({ bloqueos })
}

// ============================================
// POST /api/bloqueos
// Cierra días completos, para toda la peluquería o para un peluquero.
// Body: { desde: "2026-12-24", hasta: "2026-12-25", peluquero_id: null | "uuid", motivo: "Navidad" }
// ============================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { desde, hasta, peluquero_id, motivo } = await request.json()

    if (!esFecha(desde) || !esFecha(hasta)) {
      return NextResponse.json({ error: 'Indica las fechas de inicio y término' }, { status: 400 })
    }
    if (hasta < desde) {
      return NextResponse.json({ error: 'La fecha de término es anterior a la de inicio' }, { status: 400 })
    }
    if (hasta < fechaEnChile(new Date())) {
      return NextResponse.json({ error: 'Esas fechas ya pasaron' }, { status: 400 })
    }

    const inicio = inicioDelDiaEnChile(desde)
    const fin = inicioDelDiaEnChile(sumarDias(hasta, 1))
    if (fin.getTime() - inicio.getTime() > MAX_DIAS_POR_BLOQUEO * 86_400_000) {
      return NextResponse.json({ error: 'Un cierre puede durar como máximo un año' }, { status: 400 })
    }

    // null cierra toda la peluquería; si viene un peluquero, RLS confirma que es de esta peluquería.
    if (peluquero_id) {
      const { data: peluquero } = await supabase
        .from('peluqueros')
        .select('id')
        .eq('id', peluquero_id)
        .maybeSingle()
      if (!peluquero) {
        return NextResponse.json({ error: 'El peluquero no existe en tu peluquería' }, { status: 400 })
      }
    }

    const motivoLimpio = motivo ? String(motivo).trim().slice(0, 200) : ''

    const { data: bloqueo, error } = await supabase
      .from('bloqueos')
      .insert({
        peluqueria_id: sesion.peluqueriaId,
        peluquero_id: peluquero_id || null,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        motivo: motivoLimpio || null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: bloqueo.id })
  } catch (error) {
    console.error('Error en POST /api/bloqueos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
