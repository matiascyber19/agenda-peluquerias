import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/auth/recuperar
// Body: { email }
// Envía el correo para elegir una contraseña nueva. El enlace vuelve a
// /auth/confirmar, que abre la sesión y lleva a /restablecer.
// Siempre responde lo mismo exista o no la cuenta, para no revelar qué
// correos están registrados.
// ============================================
export async function POST(request: Request) {
  try {
    const { email } = await request.json().catch(() => ({}))
    const limpio = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!limpio || limpio.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      return NextResponse.json({ error: 'Ingresa un correo válido' }, { status: 400 })
    }

    const supabase = await createClient()
    const { origin } = new URL(request.url)
    const { error } = await supabase.auth.resetPasswordForEmail(limpio, {
      redirectTo: `${origin}/auth/confirmar?next=/restablecer`,
    })

    // Supabase limita los correos seguidos a la misma dirección
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Ya te enviamos un correo hace poco. Espera un minuto y vuelve a intentar.' },
        { status: 429 }
      )
    }
    if (error) {
      console.error('Error al pedir recuperación de contraseña:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en POST /api/auth/recuperar', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
