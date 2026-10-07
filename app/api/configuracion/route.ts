import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/configuracion
// Datos de contacto de la peluquería del usuario.
// Devuelve { peluqueria: { nombre, slug, email, telefono }, emailCuenta }
// ============================================
export async function GET() {
  const supabase = await createClient()
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: peluqueria, error } = await supabase
    .from('peluquerias')
    .select('nombre, slug, email, telefono')
    .eq('id', sesion.peluqueriaId)
    .maybeSingle()

  if (error || !peluqueria) {
    return NextResponse.json({ error: 'No pudimos cargar la peluquería' }, { status: 500 })
  }

  // El correo de la cuenta se sugiere como correo de avisos si aún no hay uno.
  return NextResponse.json({ peluqueria, emailCuenta: sesion.user.email ?? null })
}

// ============================================
// PATCH /api/configuracion
// Body (ambos opcionales; '' o null los borra):
// { email: "avisos@peluqueria.cl", telefono: "+56 9 1234 5678" }
// ============================================
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { email, telefono } = await request.json()
    const cambios: Record<string, string | null> = {}

    if (email !== undefined) {
      const limpio = email ? String(email).trim() : ''
      if (limpio && (limpio.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio))) {
        return NextResponse.json({ error: 'El correo de avisos no es válido' }, { status: 400 })
      }
      cambios.email = limpio || null
    }

    if (telefono !== undefined) {
      const limpio = telefono ? String(telefono).trim() : ''
      const digitos = limpio.replace(/\D/g, '').length
      if (limpio && (limpio.length > 20 || digitos < 8 || digitos > 15)) {
        return NextResponse.json(
          { error: 'El WhatsApp debe tener entre 8 y 15 dígitos' },
          { status: 400 }
        )
      }
      cambios.telefono = limpio || null
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data: peluqueria, error } = await supabase
      .from('peluquerias')
      .update(cambios)
      .eq('id', sesion.peluqueriaId)
      .select('nombre, slug, email, telefono')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, peluqueria })
  } catch (error) {
    console.error('Error en PATCH /api/configuracion:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
