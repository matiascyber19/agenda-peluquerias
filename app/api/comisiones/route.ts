import { createClient } from '@/app/lib/supabase/server'
import { exigirRol, usuarioConPeluqueria } from '@/app/lib/sesion'
import { esFecha, inicioDelDiaEnChile, sumarDias } from '@/app/lib/fechas'
import { type Embebido, uno } from '@/app/lib/supabase/embebido'
import { traerTodas } from '@/app/lib/supabase/paginar'
import { NextResponse } from 'next/server'

interface FilaComision {
  id: string
  peluquero_id: string
  monto_clp: number
  pagado: boolean | null
  fecha_pago: string | null
  creado_en: string
  ventas: Embebido<{
    total_clp: number
    fecha: string
    citas: Embebido<{ inicio: string; clientes: Embebido<{ nombre: string }> }>
  }>
}

// ============================================
// GET /api/comisiones?desde=2026-10-01&hasta=2026-10-31
// Comisiones generadas en el período (días de Chile) y lo pendiente de pago.
// El dueño ve a todos los peluqueros; un peluquero, solo lo suyo (la base
// filtra por rol).
// Devuelve { peluqueros: [{ id, nombre, porcentaje, ventas, comision, pendiente }],
//            detalle: [{ id, peluquero_id, fecha, cliente, venta, comision, pagado }] }
// ============================================
export async function GET(request: Request) {
  const supabase = await createClient()
  const sinPermiso = await exigirRol(supabase, ['dueño', 'peluquero'])
  if (sinPermiso) return sinPermiso
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
    return NextResponse.json({ error: 'Indica un período válido (desde y hasta, AAAA-MM-DD)' }, { status: 400 })
  }
  const inicioPeriodo = inicioDelDiaEnChile(desde).toISOString()
  const finPeriodo = inicioDelDiaEnChile(sumarDias(hasta, 1)).toISOString()

  let consultaPeluqueros = supabase
    .from('peluqueros')
    .select('id, nombre, tipo_contrato, porcentaje_comision, activo')
    .order('nombre')
  if (sesion.rol === 'peluquero') {
    consultaPeluqueros = consultaPeluqueros.eq('id', sesion.peluqueroId ?? '00000000-0000-0000-0000-000000000000')
  }

  const [peluqueros, delPeriodo, pendientes, ventas] = await Promise.all([
    consultaPeluqueros,
    traerTodas<FilaComision>((primera, ultima) =>
      supabase
        .from('comisiones')
        .select(`
          id, peluquero_id, monto_clp, pagado, fecha_pago, creado_en,
          ventas ( total_clp, fecha, citas ( inicio, clientes ( nombre ) ) )
        `)
        .gte('creado_en', inicioPeriodo)
        .lt('creado_en', finPeriodo)
        .order('creado_en', { ascending: false })
        .range(primera, ultima) as unknown as PromiseLike<{ data: FilaComision[] | null; error: { message: string } | null }>
    ),
    traerTodas<{ peluquero_id: string; monto_clp: number }>((primera, ultima) =>
      supabase
        .from('comisiones')
        .select('peluquero_id, monto_clp')
        .eq('pagado', false)
        .order('id')
        .range(primera, ultima)
    ),
    traerTodas<{ peluquero_id: string | null; total_clp: number }>((primera, ultima) =>
      supabase
        .from('ventas')
        .select('peluquero_id, total_clp')
        .gte('fecha', inicioPeriodo)
        .lt('fecha', finPeriodo)
        .order('id')
        .range(primera, ultima)
    ),
  ])

  const error = peluqueros.error ?? delPeriodo.error ?? pendientes.error ?? ventas.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sumar = <T extends { peluquero_id: string | null }>(filas: T[], valor: (f: T) => number, id: string) =>
    filas.filter((f) => f.peluquero_id === id).reduce((suma, f) => suma + valor(f), 0)

  const resumen = (peluqueros.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    activo: p.activo ?? true,
    porcentaje: p.tipo_contrato === 'comision' ? p.porcentaje_comision ?? 0 : 0,
    ventas: sumar(ventas.data ?? [], (v) => v.total_clp, p.id),
    comision: sumar(delPeriodo.data ?? [], (c) => c.monto_clp, p.id),
    pendiente: sumar(pendientes.data ?? [], (c) => c.monto_clp, p.id),
  }))

  const detalle = (delPeriodo.data ?? []).map((c) => {
    const venta = uno(c.ventas)
    const cita = uno(venta?.citas ?? null)
    return {
      id: c.id,
      peluquero_id: c.peluquero_id,
      fecha: venta?.fecha ?? c.creado_en,
      cliente: uno(cita?.clientes ?? null)?.nombre ?? null,
      venta: venta?.total_clp ?? 0,
      comision: c.monto_clp,
      pagado: c.pagado ?? false,
      fecha_pago: c.fecha_pago,
    }
  })

  return NextResponse.json({ peluqueros: resumen, detalle })
}
