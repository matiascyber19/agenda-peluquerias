import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { type Franja, validarFranjas } from '@/app/lib/horarios'
import { NextResponse } from 'next/server'

const HHMM = (hora: string) => hora.slice(0, 5) // Postgres devuelve "10:00:00"

// ============================================
// GET /api/horarios
// Peluqueros activos con sus franjas de atención.
// Devuelve { peluqueros: [{ id, nombre, color_agenda, franjas: [{ dia_semana, hora_inicio, hora_fin }] }] }
// ============================================
export async function GET() {
  const supabase = await createClient()
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('peluqueros')
    .select('id, nombre, color_agenda, horarios(dia_semana, hora_inicio, hora_fin, activo)')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const peluqueros = (data ?? []).map((peluquero) => ({
    id: peluquero.id,
    nombre: peluquero.nombre,
    color_agenda: peluquero.color_agenda,
    franjas: (peluquero.horarios ?? [])
      .filter((h) => h.activo !== false)
      .map((h) => ({ dia_semana: h.dia_semana, hora_inicio: HHMM(h.hora_inicio), hora_fin: HHMM(h.hora_fin) }))
      .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)),
  }))

  return NextResponse.json({ peluqueros })
}

// ============================================
// PUT /api/horarios
// Reemplaza las franjas de uno o más peluqueros por las mismas franjas
// (así funciona "copiar a todos").
// Body: { peluquero_ids: ["uuid"], franjas: [{ dia_semana: 1, hora_inicio: "10:00", hora_fin: "14:00" }] }
// Una lista de franjas vacía deja al peluquero sin horario (no recibe reservas).
// ============================================
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { peluquero_ids, franjas } = await request.json()

    if (
      !Array.isArray(peluquero_ids) ||
      peluquero_ids.length === 0 ||
      peluquero_ids.length > 50 ||
      peluquero_ids.some((id) => typeof id !== 'string' || !id)
    ) {
      return NextResponse.json({ error: 'Indica al menos un peluquero' }, { status: 400 })
    }

    const errorFranjas = validarFranjas(franjas)
    if (errorFranjas) {
      return NextResponse.json({ error: errorFranjas }, { status: 400 })
    }

    // RLS solo devuelve peluqueros de esta peluquería.
    const ids = [...new Set(peluquero_ids as string[])]
    const { data: encontrados, error: peluquerosError } = await supabase
      .from('peluqueros')
      .select('id')
      .in('id', ids)

    if (peluquerosError) {
      return NextResponse.json({ error: peluquerosError.message }, { status: 500 })
    }
    if ((encontrados ?? []).length !== ids.length) {
      return NextResponse.json({ error: 'Algún peluquero no existe en tu peluquería' }, { status: 400 })
    }

    // Se guardan las franjas actuales para restaurarlas si la inserción falla:
    // borrar e insertar son dos operaciones separadas.
    const { data: anteriores } = await supabase
      .from('horarios')
      .select('peluquero_id, dia_semana, hora_inicio, hora_fin, activo')
      .in('peluquero_id', ids)

    const { error: borrarError } = await supabase.from('horarios').delete().in('peluquero_id', ids)
    if (borrarError) {
      return NextResponse.json({ error: borrarError.message }, { status: 500 })
    }

    const nuevas = ids.flatMap((peluqueroId) =>
      (franjas as Franja[]).map((f) => ({
        peluquero_id: peluqueroId,
        dia_semana: f.dia_semana,
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        activo: true,
      }))
    )

    if (nuevas.length > 0) {
      const { error: insertarError } = await supabase.from('horarios').insert(nuevas)
      if (insertarError) {
        if (anteriores && anteriores.length > 0) {
          await supabase.from('horarios').insert(anteriores)
        }
        return NextResponse.json({ error: insertarError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, actualizados: ids.length })
  } catch (error) {
    console.error('Error en PUT /api/horarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
