import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('>>> entró al GET de citas')
  const supabase = await createClient()

  //Leer parámetros de la URL ej: /api/citas?fecha=2026-05-31
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const peluquero_id = searchParams.get('peluquero_id')

  //Consulta base
  let query = supabase
    .from('citas')
    .select(`
      id,
      inicio,
      estado,
      clientes ( nombre, telefono ),
      peluqueros ( nombre ),
      servicios ( nombre, duracion_minutos, precio_clp )
    `)
    .order('inicio', { ascending: true })

  //Filtros opcionales
  if (fecha) {
    query = query
      .gte('inicio', `${fecha}T00:00:00`)
      .lte('inicio', `${fecha}T23:59:59`)
  }

  if (peluquero_id) {
    query = query.eq('peluquero_id', peluquero_id)
  }

  const { data, error } = await query

  console.log('data:', data)
  console.log('error: ', error)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ citas: data })
}