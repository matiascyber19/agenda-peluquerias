import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/auth/restablecer
// Body: { password }
// Cambia la contraseña de la sesión abierta por el enlace del correo.
// ============================================
export async function POST(request: Request) {
  try {
    const { password } = await request.json().catch(() => ({}))
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }
    if (password.length > 72) {
      return NextResponse.json(
        { error: 'La contraseña puede tener como máximo 72 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'El enlace venció. Pide uno nuevo para cambiar tu contraseña.' },
        { status: 401 }
      )
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const mensaje =
        error.code === 'same_password'
          ? 'La contraseña nueva tiene que ser distinta de la anterior'
          : error.code === 'weak_password'
            ? 'Esa contraseña es muy débil. Prueba con una más larga o con números y símbolos.'
            : 'No pudimos cambiar la contraseña. Intenta de nuevo.'
      return NextResponse.json({ error: mensaje }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en POST /api/auth/restablecer', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
