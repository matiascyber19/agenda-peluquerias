import { createClient } from '@/app/lib/supabase/server'
import { completarCuentaPendiente } from '@/app/lib/cuentaPendiente'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================
// GET /auth/confirmar
// Destino de los enlaces que manda Supabase por correo: recuperar la
// contraseña (next=/restablecer) y confirmar el correo de una cuenta nueva
// (next=/dashboard). Abre la sesión y redirige a `next`.
// Acepta los dos formatos de enlace:
//   ?code=...                    plantilla por defecto de Supabase (PKCE):
//                                solo funciona en el mismo navegador
//   ?token_hash=...&type=...     plantilla con {{ .TokenHash }}: funciona en
//                                cualquier navegador
// Al confirmar una cuenta nueva, termina el registro de la peluquería o la
// invitación que quedó pendiente (app/lib/cuentaPendiente.ts).
// ============================================
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // Solo rutas de esta misma app, para que el enlace no sirva para
  // redirigir a otro sitio.
  const next = searchParams.get('next') ?? '/dashboard'
  const destino = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  const esRecuperacion = destino === '/restablecer'
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, origin))

  const supabase = await createClient()
  let ok = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  if (!ok) {
    if (esRecuperacion) return ir('/recuperar?error=enlace')
    // Con ?code, Supabase ya confirmó el correo antes de redirigir: lo que
    // falló es abrir la sesión (otro navegador). Al iniciar sesión se termina
    // la cuenta. Sin code, el enlace venció o no es válido.
    return ir(code ? '/login?confirmado=1' : '/login?confirmacion=fallida')
  }

  if (!esRecuperacion) {
    const cuenta = await completarCuentaPendiente(supabase)
    if (!cuenta.lista) {
      await supabase.auth.signOut()
      return ir(`/login?error=${encodeURIComponent(cuenta.error ?? 'No pudimos terminar tu cuenta')}`)
    }
  }

  return ir(destino)
}
