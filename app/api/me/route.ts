import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/me
// Datos del usuario en sesión para el Navbar.
// Devuelve { nombre, rol, peluqueria }
// ============================================
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, rol, peluquerias(nombre)')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario sin peluquería' }, { status: 403 })
  }

  const peluqueria = usuario.peluquerias as unknown as { nombre: string } | { nombre: string }[] | null
  const nombrePeluqueria = Array.isArray(peluqueria)
    ? peluqueria[0]?.nombre ?? null
    : peluqueria?.nombre ?? null

  return NextResponse.json({
    nombre: usuario.nombre,
    rol: usuario.rol,
    peluqueria: nombrePeluqueria,
  })
}
