import { createClient } from '@/app/lib/supabase/server'
import { completarCuentaPendiente } from '@/app/lib/cuentaPendiente'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  //1.Recibe email y contraseña desde formulario
  const { email, password } = await request.json()

  //2.Conectar a Supabase
  const supabase = await createClient()

  // 3.Intenta login
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // 4.Si hay error, avisarle al frontend con un mensaje en español
  if (error) {
    const mensaje =
      error.code === 'email_not_confirmed'
        ? 'Confirma tu correo antes de entrar: te enviamos un enlace al crear la cuenta.'
        : 'Correo o contraseña incorrectos'
    return NextResponse.json({ error: mensaje }, { status: 401 })
  }

  // 5.La cuenta tiene que pertenecer a una peluquería. Si se creó con la
  //   confirmación de correo activada, aquí se termina el registro o la
  //   invitación que quedó pendiente. Si no hay cómo, se cierra la sesión y
  //   se explica el motivo (antes el panel la rechazaba y el login quedaba
  //   cargando).
  const cuenta = await completarCuentaPendiente(supabase)
  if (!cuenta.lista) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: cuenta.error }, { status: 403 })
  }

  // 6.Si todo ok, redirigir al panel
  return NextResponse.json({ ok: true })
}
