import type { createClient } from './supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Estados que dejan libre el horario del peluquero. */
const ESTADOS_SIN_HORARIO = ['cancelada', 'no_show', 'rechazada']

/**
 * Filtro de PostgREST (para `.or()`) que deja fuera las reservas en línea que
 * todavía no son citas de la agenda: la solicitud sin responder, la hora
 * propuesta que el cliente no ha aceptado y la rechazada. La agenda, el
 * dashboard y las estadísticas lo usan. Incluye `estado` nulo porque `not.in`
 * lo descartaría.
 */
export const FILTRO_CITAS_DE_AGENDA = 'estado.is.null,estado.not.in.(solicitada,rechazada,propuesta)'

/** Reservas en línea que esperan respuesta: de la peluquería o del cliente. */
export const ESTADOS_DE_SOLICITUD = ['solicitada', 'propuesta']

export function ocupaHorario(estado: string) {
  return !ESTADOS_SIN_HORARIO.includes(estado)
}

/**
 * Comprueba que el cliente y el peluquero existan en la peluquería del usuario
 * (RLS oculta los de otras peluquerías) y puedan recibir citas.
 * Devuelve el mensaje de error, o null si todo está en orden.
 */
export async function validarParticipantes(
  supabase: Supabase,
  { clienteId, peluqueroId }: { clienteId?: string; peluqueroId?: string }
): Promise<string | null> {
  if (clienteId) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('bloqueado')
      .eq('id', clienteId)
      .maybeSingle()
    if (!cliente) return 'El cliente no existe en tu peluquería'
    if (cliente.bloqueado) return 'El cliente está bloqueado'
  }

  if (peluqueroId) {
    const { data: peluquero } = await supabase
      .from('peluqueros')
      .select('activo')
      .eq('id', peluqueroId)
      .maybeSingle()
    if (!peluquero) return 'El peluquero no existe en tu peluquería'
    if (!peluquero.activo) return 'El peluquero está inactivo'
  }

  return null
}

/**
 * Busca otra cita vigente del peluquero que se cruce con [inicio, fin).
 * Es un chequeo de aplicación: dos pedidos simultáneos aún podrían colarse;
 * para cerrarlo del todo haría falta una restricción EXCLUDE en la base.
 */
export async function buscarCruce(
  supabase: Supabase,
  { peluqueroId, inicio, fin, excluirId }: {
    peluqueroId: string
    inicio: string
    fin: string
    excluirId?: string
  }
) {
  let query = supabase
    .from('citas')
    .select('inicio, fin')
    .eq('peluquero_id', peluqueroId)
    .not('estado', 'in', `(${ESTADOS_SIN_HORARIO.join(',')})`)
    .lt('inicio', fin)
    .gt('fin', inicio)
    .limit(1)

  if (excluirId) query = query.neq('id', excluirId)

  const { data, error } = await query
  return { cruce: data?.[0] ?? null, error }
}

/**
 * La base rechazó la cita por cruzarse con otra del mismo peluquero
 * (restricción citas_sin_cruces, migración 005). Pasa cuando dos personas
 * guardan al mismo tiempo y la revisión previa de la app no alcanzó a verlo.
 */
export function esErrorDeCruce(error: { code?: string } | null) {
  return error?.code === '23P01'
}

export const MENSAJE_CRUCE = 'El peluquero ya tiene otra cita en ese horario'

export function describirCruce(cruce: { inicio: string; fin: string }) {
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  return `El peluquero ya tiene una cita de ${hora(cruce.inicio)} a ${hora(cruce.fin)}`
}
