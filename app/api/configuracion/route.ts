import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria, exigirRol } from '@/app/lib/sesion'
import { COLUMNAS_REGLAS, columnasDeReglas, reglasDeFila } from '@/app/lib/reglasReserva'
import { NextResponse } from 'next/server'

const SELECCION = `nombre, slug, email, telefono, ${COLUMNAS_REGLAS}`

// ============================================
// GET /api/configuracion
// Datos de contacto y reglas de reserva de la peluquería. Solo el dueño.
// Devuelve { peluqueria: { nombre, slug, email, telefono }, reglas, emailCuenta }
// ============================================
export async function GET() {
  const supabase = await createClient()
  // Solo dueño
  const sinPermiso = await exigirRol(supabase, ['dueño'])
  if (sinPermiso) return sinPermiso
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: fila, error } = await supabase
    .from('peluquerias')
    .select(SELECCION)
    .eq('id', sesion.peluqueriaId)
    .maybeSingle()

  if (error || !fila) {
    return NextResponse.json({ error: 'No pudimos cargar la peluquería' }, { status: 500 })
  }

  // El correo de la cuenta se sugiere como correo de avisos si aún no hay uno.
  const { nombre, slug, email, telefono } = fila
  return NextResponse.json({
    peluqueria: { nombre, slug, email, telefono },
    reglas: reglasDeFila(fila),
    emailCuenta: sesion.user.email ?? null,
  })
}

// ============================================
// PATCH /api/configuracion
// Body (todo opcional; en email y telefono, '' o null los borra):
// { email: "avisos@peluqueria.cl", telefono: "+56 9 1234 5678",
//   reglas: { activa, confirmacion_automatica, anticipacion_min, dias_max,
//             intervalo_min, max_pendientes } }
// ============================================
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    // Solo dueño
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { email, telefono, reglas } = await request.json()
    const cambios: Record<string, string | number | boolean | null> = {}

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

    if (reglas !== undefined) {
      const resultado = columnasDeReglas(reglas ?? {})
      if (resultado.error) {
        return NextResponse.json({ error: resultado.error }, { status: 400 })
      }
      Object.assign(cambios, resultado.columnas)
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data: fila, error } = await supabase
      .from('peluquerias')
      .update(cambios)
      .eq('id', sesion.peluqueriaId)
      .select(SELECCION)
      .single()

    if (error || !fila) {
      return NextResponse.json({ error: error?.message ?? 'No pudimos guardar' }, { status: 500 })
    }

    const { nombre, slug, email: correo, telefono: whatsapp } = fila
    return NextResponse.json({
      success: true,
      peluqueria: { nombre, slug, email: correo, telefono: whatsapp },
      reglas: reglasDeFila(fila),
    })
  } catch (error) {
    console.error('Error en PATCH /api/configuracion:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
