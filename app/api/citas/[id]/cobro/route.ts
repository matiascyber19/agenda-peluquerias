import { createClient } from '@/app/lib/supabase/server'
import { type Embebido, uno } from '@/app/lib/supabase/embebido'
import { usuarioConPeluqueria, exigirRol } from '@/app/lib/sesion'
import { esCobrable, esMedioDePago } from '@/app/lib/cobros'
import { NextResponse } from 'next/server'

const TOTAL_MAXIMO_CLP = 10_000_000

interface CitaACobrar {
  id: string
  inicio: string
  estado: string | null
  cliente_id: string
  peluquero_id: string
  cita_servicios: {
    servicio_id: string
    precio_congelado_clp: number
    servicios: Embebido<{ nombre: string }>
  }[] | null
  ventas: { id: string }[] | null
}

// ============================================
// POST /api/citas/[id]/cobro
// Registra el cobro de una cita: una venta con un ítem por servicio, al
// precio congelado en la cita.
// Body: { medio_pago: "efectivo" | "transferencia" | "debito" | "credito",
//         total_clp?: número (si se omite, la suma de los servicios) }
// Si la cita ya empezó y no estaba completada, queda completada.
// ============================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { medio_pago, total_clp } = await request.json().catch(() => ({}))
    if (!esMedioDePago(medio_pago)) {
      return NextResponse.json({ error: 'Elige un medio de pago' }, { status: 400 })
    }
    if (
      total_clp !== undefined &&
      (!Number.isInteger(total_clp) || total_clp < 0 || total_clp > TOTAL_MAXIMO_CLP)
    ) {
      return NextResponse.json({ error: 'El total no es válido' }, { status: 400 })
    }

    // RLS solo deja ver las citas de esta peluquería
    const { data } = await supabase
      .from('citas')
      .select(`
        id, inicio, estado, cliente_id, peluquero_id,
        cita_servicios ( servicio_id, precio_congelado_clp, servicios ( nombre ) ),
        ventas ( id )
      `)
      .eq('id', id)
      .maybeSingle()
    const cita = data as unknown as CitaACobrar | null

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }
    if (!esCobrable(cita.estado)) {
      return NextResponse.json(
        { error: 'Solo se puede cobrar una cita pendiente, confirmada o completada' },
        { status: 400 }
      )
    }
    if ((cita.ventas ?? []).length > 0) {
      return NextResponse.json({ error: 'Esta cita ya tiene un cobro registrado' }, { status: 409 })
    }

    const items = (cita.cita_servicios ?? []).map((cs) => ({
      tipo: 'servicio',
      referencia_id: cs.servicio_id,
      nombre: (uno(cs.servicios)?.nombre ?? 'Servicio').slice(0, 150),
      cantidad: 1,
      precio_unitario_clp: cs.precio_congelado_clp,
      subtotal_clp: cs.precio_congelado_clp,
    }))
    const total = total_clp ?? items.reduce((suma, item) => suma + item.subtotal_clp, 0)

    // 1. La venta
    const { data: venta, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        peluqueria_id: sesion.peluqueriaId,
        cita_id: cita.id,
        cliente_id: cita.cliente_id,
        peluquero_id: cita.peluquero_id,
        total_clp: total,
        medio_pago,
      })
      .select('id, total_clp, medio_pago, fecha')
      .single()

    if (ventaError || !venta) {
      // 23505: el índice único de la migración 005 detectó un cobro doble
      if (ventaError?.code === '23505') {
        return NextResponse.json({ error: 'Esta cita ya tiene un cobro registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: ventaError?.message ?? 'No pudimos registrar el cobro' }, { status: 500 })
    }

    // Si algo falla después, se borra la venta para no dejar cobros a medias.
    const deshacer = () => supabase.from('ventas').delete().eq('id', venta.id)

    // 2. Sus ítems
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('venta_items')
        .insert(items.map((item) => ({ ...item, venta_id: venta.id })))
      if (itemsError) {
        await deshacer()
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    // 3. Una cita que ya empezó y se cobra, se atendió
    if (cita.estado !== 'completada' && new Date(cita.inicio) <= new Date()) {
      const { error: estadoError } = await supabase
        .from('citas')
        .update({ estado: 'completada' })
        .eq('id', cita.id)
      if (estadoError) {
        await deshacer()
        return NextResponse.json({ error: estadoError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ cobro: venta }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/citas/[id]/cobro', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ============================================
// DELETE /api/citas/[id]/cobro
// Anula el cobro de una cita (borra la venta, sus ítems y su comisión si no
// está pagada). La cita conserva su estado. Solo dueño y recepción.
// ============================================
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    // Solo dueño y recepcionista
    const sinPermiso = await exigirRol(supabase, ['dueño', 'recepcionista'])
    if (sinPermiso) return sinPermiso
    const sesion = await usuarioConPeluqueria(supabase)
    if (!sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('ventas')
      .delete()
      .eq('cita_id', id)
      .select('id')

    if (error) {
      // P0001: la base no deja anular un cobro cuya comisión ya se pagó (migración 006)
      if (error.code === 'P0001') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Esta cita no tiene un cobro registrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/citas/[id]/cobro', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
