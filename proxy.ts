import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { esRol, paginaDe } from './app/lib/roles'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const pagina = paginaDe(pathname)

  if (pagina && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rol de la cuenta. Sin fila visible en `usuarios` (cuenta desactivada o sin
  // peluquería) no hay rol, y no entra al panel.
  let rol = null
  if (user) {
    const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', user.id).maybeSingle()
    rol = esRol(usuario?.rol) ? usuario.rol : null
  }

  if (pagina && !rol) {
    return NextResponse.redirect(new URL('/login?acceso=sin-cuenta', request.url))
  }

  // Una página que no es para su rol lo devuelve al dashboard.
  if (pagina && rol && !pagina.roles.includes(rol)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (pathname === '/login' && rol) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/agenda/:path*',
    '/solicitudes/:path*',
    '/clientes/:path*',
    '/servicios/:path*',
    '/peluqueros/:path*',
    '/equipo/:path*',
    '/reportes/:path*',
    '/gastos/:path*',
    '/comisiones/:path*',
    '/configuracion/:path*',
    '/login',
  ],
}
