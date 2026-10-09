import { createClient } from '@/app/lib/supabase/server'
import { exigirRol, usuarioConPeluqueria } from '@/app/lib/sesion'
import { esFecha } from '@/app/lib/fechas'
import { CATEGORIAS_GASTO, type Gasto, MONTO_MAXIMO_GASTO } from '@/app/lib/gastos'
import { traerTodas } from '@/app/lib/supabase/paginar'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/gastos?desde=2026-10-01&hasta=2026-10-31
// Gastos del período (días de Chile), del más reciente al más antiguo.
// Solo el dueño.
// ============================================
export async function GET(request: Request) {
  const supabase = await createClient()
  const sinPermiso = await exigirRol(supabase, ['dueño'])
  if (sinPermiso) return sinPermiso

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
    return NextResponse.json({ error: 'Indica un período válido (desde y hasta, AAAA-MM-DD)' }, { status: 400 })
  }

  // `fecha` es de tipo date: se compara directo con los días.
  const { data, error } = await traerTodas<Gasto>((primera, ultima) =>
    supabase
      .from('gastos')
      .select('id, descripcion, categoria, monto_clp, fecha')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .range(primera, ultima)
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ gastos: data })
}

// ============================================
// POST /api/gastos
// Body: { fecha: "2026-10-08", descripcion, categoria, monto_clp }
// ============================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const sinPermiso = await exigirRol(supabase, ['dueño'])
    if (sinPermiso) return sinPermiso
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { fecha, descripcion, categoria, monto_clp } = await request.json().catch(() => ({}))
    const texto = typeof descripcion === 'string' ? descripcion.trim() : ''

    if (!esFecha(fecha)) {
      return NextResponse.json({ error: 'Elige la fecha del gasto' }, { status: 400 })
    }
    if (texto.length < 2 || texto.length > 200) {
      return NextResponse.json({ error: 'Describe el gasto (entre 2 y 200 caracteres)' }, { status: 400 })
    }
    if (!CATEGORIAS_GASTO.includes(categoria)) {
      return NextResponse.json({ error: 'Elige una categoría' }, { status: 400 })
    }
    if (!Number.isInteger(monto_clp) || monto_clp <= 0 || monto_clp > MONTO_MAXIMO_GASTO) {
      return NextResponse.json({ error: 'El monto tiene que ser un número entero mayor que 0' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('gastos')
      .insert({ peluqueria_id: sesion.peluqueriaId, fecha, descripcion: texto, categoria, monto_clp })
      .select('id, descripcion, categoria, monto_clp, fecha')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ gasto: data }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/gastos', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
