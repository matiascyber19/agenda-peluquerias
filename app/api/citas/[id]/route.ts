import { createClient } from '@/app/lib/supabase/server'
import { buscarCruce, describirCruce, esErrorDeCruce, MENSAJE_CRUCE, ocupaHorario, validarParticipantes } from '@/app/lib/citas'
import { ESTADOS_SIN_COBRO } from '@/app/lib/cobros'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'

// ============================================
// PATCH /api/citas/[id]
// Actualiza una cita existente
// Body esperado (todos opcionales):
// {
//   estado: "confirmada" | "completada" | "cancelada" | "no_show" | "pendiente" | "rechazada" | "propuesta",
//   inicio: "2026-06-08T15:00:00Z",
//   fin: "2026-06-08T15:30:00Z",
//   notas: "texto",
//   peluquero_id: "uuid",
//   cliente_id: "uuid"
// }
// Reservas en línea: una cita 'solicitada' pasa a 'confirmada' (opcionalmente
// con otra hora o peluquero), a 'rechazada', que es final, o a 'propuesta':
// se le propone otra hora al cliente y él la acepta o rechaza con el enlace
// de propuesta_token (/propuesta/[token]). Solo dueño y recepción responden
// solicitudes; un peluquero solo maneja sus propias citas.
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Leer el body
    const body = await request.json()
    const { estado, inicio, fin, notas, peluquero_id, cliente_id } = body

    // 3. Validar estado si viene
    const estadosValidos = ['pendiente', 'confirmada', 'completada', 'cancelada', 'no_show', 'rechazada', 'propuesta']
    if (estado === 'solicitada') {
      return NextResponse.json(
        { error: 'Solo una reserva en línea puede quedar como solicitada' },
        { status: 400 }
      )
    }
    if (estado && !estadosValidos.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` },
        { status: 400 }
      )
    }

    for (const [campo, valor] of [['inicio', inicio], ['fin', fin]] as const) {
      if (valor !== undefined && Number.isNaN(new Date(valor).getTime())) {
        return NextResponse.json({ error: `La fecha de ${campo} no es válida` }, { status: 400 })
      }
    }

    // 4. Construir objeto solo con campos que llegaron
    const updates: Record<string, unknown> = {}
    if (estado !== undefined) updates.estado = estado
    if (inicio !== undefined) updates.inicio = inicio
    if (fin !== undefined) updates.fin = fin
    if (notas !== undefined) updates.notas = notas
    if (peluquero_id !== undefined) updates.peluquero_id = peluquero_id
    if (cliente_id !== undefined) updates.cliente_id = cliente_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    // 5. Cita actual (RLS solo deja ver las de esta peluquería)
    const { data: actual } = await supabase
      .from('citas')
      .select('inicio, fin, estado, peluquero_id, propuesta_token, inicio_solicitado, ventas ( id )')
      .eq('id', id)
      .maybeSingle()

    if (!actual) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    // Una cita cobrada se atendió: no puede pasar a cancelada ni a no-show.
    if (estado !== undefined && ESTADOS_SIN_COBRO.includes(estado) && (actual.ventas ?? []).length > 0) {
      return NextResponse.json(
        { error: 'Esta cita tiene un cobro registrado. Anula el cobro antes de cambiarla a ese estado.' },
        { status: 409 }
      )
    }

    const esSolicitud = actual.estado === 'solicitada' || actual.estado === 'propuesta'

    // Lo que no puede hacer un peluquero (la base también lo impide)
    const sesion = await usuarioConPeluqueria(supabase)
    if (sesion?.rol === 'peluquero') {
      if (esSolicitud) {
        return NextResponse.json(
          { error: 'Las solicitudes las responde recepción o el dueño' },
          { status: 403 }
        )
      }
      if (peluquero_id !== undefined && peluquero_id !== sesion.peluqueroId) {
        return NextResponse.json({ error: 'No puedes pasar tus citas a otro peluquero' }, { status: 403 })
      }
    }

    // Transiciones de las reservas en línea
    if (actual.estado === 'rechazada') {
      return NextResponse.json(
        { error: 'Una solicitud rechazada no se puede modificar' },
        { status: 400 }
      )
    }
    if (esSolicitud && estado !== undefined && !['confirmada', 'rechazada', 'propuesta'].includes(estado)) {
      return NextResponse.json(
        { error: 'Una solicitud solo puede confirmarse, rechazarse o recibir otra hora propuesta' },
        { status: 400 }
      )
    }
    if ((estado === 'rechazada' || estado === 'propuesta') && !esSolicitud) {
      return NextResponse.json(
        { error: 'Solo una solicitud en línea puede rechazarse o recibir otra hora; una cita se cancela o se mueve' },
        { status: 400 }
      )
    }

    // Proponer otra hora: se guarda la que pidió el cliente (la primera vez) y
    // un enlace para que él responda. Volver a proponer conserva el enlace.
    if (estado === 'propuesta') {
      if (inicio === undefined) {
        return NextResponse.json({ error: 'Para proponer otra hora, indica la hora nueva' }, { status: 400 })
      }
      updates.inicio_solicitado = actual.inicio_solicitado ?? actual.inicio
      updates.propuesta_token = actual.propuesta_token ?? randomBytes(32).toString('hex')
    }

    // Si se mueve el inicio sin indicar el fin, la cita conserva su duración.
    if (inicio !== undefined && fin === undefined && actual.fin) {
      const duracionMs = new Date(actual.fin).getTime() - new Date(actual.inicio).getTime()
      updates.fin = new Date(new Date(inicio).getTime() + duracionMs).toISOString()
    }

    const errorParticipantes = await validarParticipantes(supabase, {
      clienteId: cliente_id,
      peluqueroId: peluquero_id,
    })
    if (errorParticipantes) {
      return NextResponse.json({ error: errorParticipantes }, { status: 400 })
    }

    // 6. Si la cita queda vigente y vuelve de cancelada/no-show, o cambia de
    //    horario o de peluquero, el peluquero tiene que estar libre.
    const estadoFinal = String(updates.estado ?? actual.estado)
    const inicioFinal = String(updates.inicio ?? actual.inicio)
    const finFinal = (updates.fin ?? actual.fin) as string | null
    const reactivada = estado !== undefined && !ocupaHorario(actual.estado) && ocupaHorario(estado)
    const cambiaHorario = inicio !== undefined || fin !== undefined || peluquero_id !== undefined

    if (ocupaHorario(estadoFinal) && finFinal && (reactivada || cambiaHorario)) {
      const { cruce, error: cruceError } = await buscarCruce(supabase, {
        peluqueroId: String(updates.peluquero_id ?? actual.peluquero_id),
        inicio: new Date(inicioFinal).toISOString(),
        fin: new Date(finFinal).toISOString(),
        excluirId: id,
      })
      if (cruceError) {
        return NextResponse.json({ error: cruceError.message }, { status: 500 })
      }
      if (cruce) {
        return NextResponse.json({ error: describirCruce(cruce) }, { status: 409 })
      }
    }

    // 7. Actualizar la cita
    // RLS se encarga de que solo pueda modificar citas de su peluquería
    const { data, error } = await supabase
      .from('citas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (esErrorDeCruce(error)) {
        return NextResponse.json({ error: MENSAJE_CRUCE }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cita: data,
      message: 'Cita actualizada correctamente',
    })
  } catch (error) {
    console.error('Error en PATCH /api/citas/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/citas/[id]
// Cancela una cita (soft delete: cambia estado a 'cancelada')
// No borra el registro para mantener historial
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Una cita cobrada se atendió: no se puede cancelar sin anular el cobro.
    const { data: cobros } = await supabase.from('ventas').select('id').eq('cita_id', id).limit(1)
    if ((cobros ?? []).length > 0) {
      return NextResponse.json(
        { error: 'Esta cita tiene un cobro registrado. Anula el cobro antes de cancelarla.' },
        { status: 409 }
      )
    }

    // 3. Cambiar estado a 'cancelada' (soft delete)
    const { data, error } = await supabase
      .from('citas')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cita cancelada correctamente',
    })
  } catch (error) {
    console.error('Error en DELETE /api/citas/', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}