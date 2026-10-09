import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/propuesta/[token]
// Body: { acepta: boolean }
// El cliente acepta (queda confirmada) o rechaza la hora que le propuso la
// peluquería. Público: el token largo del enlace es la llave.
// ============================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json({ error: 'El enlace no es válido' }, { status: 404 })
    }
    const { acepta } = await request.json().catch(() => ({}))
    if (typeof acepta !== 'boolean') {
      return NextResponse.json({ error: 'Indica si aceptas la hora' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('propuesta_responder', { p_token: token, p_acepta: acepta })

    if (error) {
      // P0001: mensajes de la función pensados para el cliente
      if (error.code === 'P0001') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      return NextResponse.json({ error: 'No pudimos registrar tu respuesta. Intenta de nuevo.' }, { status: 500 })
    }

    return NextResponse.json({ estado: data?.estado })
  } catch (error) {
    console.error('Error en POST /api/propuesta/[token]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
