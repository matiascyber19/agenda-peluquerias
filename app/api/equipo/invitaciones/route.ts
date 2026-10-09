import { createClient } from '@/app/lib/supabase/server'
import { exigirRol, usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/equipo/invitaciones
// Body: { rol: "recepcionista" } o { rol: "peluquero", peluquero_id }
// Crea una invitación de 7 días. La persona entra con /unirse/[token].
// Solo el dueño.
// ============================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { rol, peluquero_id } = await request.json().catch(() => ({}))
    if (rol !== 'peluquero' && rol !== 'recepcionista') {
      return NextResponse.json({ error: 'Elige si es peluquero o recepcionista' }, { status: 400 })
    }

    if (rol === 'peluquero') {
      if (typeof peluquero_id !== 'string' || !peluquero_id) {
        return NextResponse.json({ error: 'Elige la ficha del peluquero' }, { status: 400 })
      }
      const { data: ficha } = await supabase
        .from('peluqueros')
        .select('usuario_id')
        .eq('id', peluquero_id)
        .maybeSingle()
      if (!ficha) {
        return NextResponse.json({ error: 'Ese peluquero no existe' }, { status: 404 })
      }
      if (ficha.usuario_id) {
        return NextResponse.json({ error: 'Ese peluquero ya tiene una cuenta' }, { status: 409 })
      }
    }

    const { data, error } = await supabase
      .from('invitaciones')
      .insert({
        peluqueria_id: sesion.peluqueriaId,
        rol,
        peluquero_id: rol === 'peluquero' ? peluquero_id : null,
      })
      .select('id, token, rol, peluquero_id, vence_en')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ invitacion: data }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/equipo/invitaciones', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
