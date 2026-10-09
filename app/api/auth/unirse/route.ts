import { createClient } from '@/app/lib/supabase/server'
import { urlDeConfirmacion } from '@/app/lib/cuentaPendiente'
import { NextResponse } from 'next/server'

// ============================================
// POST /api/auth/unirse
// Body: { token, nombre, email, password }
// Crea la cuenta de quien fue invitado al equipo y acepta la invitación
// (invitacion_aceptar, migración 006). Si el correo ya tiene una cuenta sin
// peluquería (por ejemplo, un intento anterior), entra con ella.
// Con la confirmación de correo activada en Supabase no hay sesión hasta
// confirmar: la invitación queda anotada en la cuenta y se acepta sola al
// confirmar o al iniciar sesión (app/lib/cuentaPendiente.ts). Responde 202
// con { confirmar: true }.
// ============================================
export async function POST(request: Request) {
  try {
    const { token, nombre, email, password } = await request.json().catch(() => ({}))
    const correo = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : ''

    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json({ error: 'La invitación no es válida' }, { status: 400 })
    }
    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      return NextResponse.json({ error: 'Escribe tu nombre' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 120) {
      return NextResponse.json({ error: 'Ingresa un correo válido' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Crear la cuenta, o entrar si el correo ya tiene una
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: {
        emailRedirectTo: urlDeConfirmacion(request),
        data: { invitacion_pendiente: { token, nombre: nombreLimpio } },
      },
    })
    if (error) {
      if (error.code !== 'user_already_exists') {
        const mensaje = error.code === 'weak_password' ? 'Esa contraseña es muy débil. Prueba con una más larga.' : error.message
        return NextResponse.json({ error: mensaje }, { status: 400 })
      }
      const { error: entrarError } = await supabase.auth.signInWithPassword({ email: correo, password })
      if (entrarError) {
        return NextResponse.json(
          { error: 'Ese correo ya tiene una cuenta y la contraseña no coincide. Usa tu contraseña de siempre.' },
          { status: 409 }
        )
      }
    } else if (!data.session) {
      // Con la confirmación de correo activada, signUp no abre sesión. Si el
      // correo ya estaba confirmado (otro intento), se entra con la contraseña.
      const { error: entrarError } = await supabase.auth.signInWithPassword({ email: correo, password })
      if (entrarError?.code === 'email_not_confirmed') {
        return NextResponse.json({ confirmar: true }, { status: 202 })
      }
      if (entrarError) {
        return NextResponse.json(
          { error: 'Ese correo ya tiene una cuenta y la contraseña no coincide. Usa tu contraseña de siempre.' },
          { status: 409 }
        )
      }
    }

    // 2. Aceptar la invitación con la sesión recién abierta
    const { data: aceptada, error: aceptarError } = await supabase.rpc('invitacion_aceptar', {
      p_token: token,
      p_nombre: nombreLimpio,
    })
    if (aceptarError) {
      return NextResponse.json(
        { error: aceptarError.code === 'P0001' ? aceptarError.message : 'No pudimos aceptar la invitación' },
        { status: aceptarError.code === 'P0001' ? 409 : 500 }
      )
    }

    return NextResponse.json({ success: true, peluqueria: aceptada?.peluqueria, rol: aceptada?.rol })
  } catch (error) {
    console.error('Error en POST /api/auth/unirse', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
