import { createClient } from '@/app/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================
// GET /auth/confirmar
// Destino de los enlaces que manda Supabase por correo (por ahora, el de
// recuperar la contraseña). Abre la sesión y redirige a `next`.
// Acepta los dos formatos de enlace:
//   ?code=...                    plantilla por defecto de Supabase (PKCE):
//                                hay que abrirlo en el mismo navegador
//   ?token_hash=...&type=...     plantilla con {{ .TokenHash }}: funciona en
//                                cualquier navegador
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

  const supabase = await createClient()
  let ok = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  return NextResponse.redirect(new URL(ok ? destino : '/recuperar?error=enlace', origin))
}
