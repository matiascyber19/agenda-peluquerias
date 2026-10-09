// Reglas de la reserva en línea de cada peluquería (columnas reserva_* de
// `peluquerias`, migración 006). Los límites son los del CHECK
// reglas_reserva_validas.

export interface ReglasReserva {
  activa: boolean
  confirmacion_automatica: boolean
  anticipacion_min: number
  dias_max: number
  intervalo_min: number
  max_pendientes: number
}

export const COLUMNAS_REGLAS =
  'reserva_activa, reserva_confirmacion_automatica, reserva_anticipacion_min, reserva_dias_max, reserva_intervalo_min, reserva_max_pendientes'

export const OPCIONES_ANTICIPACION = [
  { valor: 0, label: 'Sin mínimo' },
  { valor: 30, label: '30 minutos' },
  { valor: 60, label: '1 hora' },
  { valor: 120, label: '2 horas' },
  { valor: 180, label: '3 horas' },
  { valor: 360, label: '6 horas' },
  { valor: 720, label: '12 horas' },
  { valor: 1440, label: '1 día' },
  { valor: 2880, label: '2 días' },
]
export const OPCIONES_DIAS = [7, 14, 30, 60, 90, 180]
export const OPCIONES_INTERVALO = [5, 10, 15, 20, 30, 60]
export const OPCIONES_PENDIENTES = [1, 2, 3, 4, 5]

interface FilaReglas {
  reserva_activa: boolean
  reserva_confirmacion_automatica: boolean
  reserva_anticipacion_min: number
  reserva_dias_max: number
  reserva_intervalo_min: number
  reserva_max_pendientes: number
}

export function reglasDeFila(fila: FilaReglas): ReglasReserva {
  return {
    activa: fila.reserva_activa,
    confirmacion_automatica: fila.reserva_confirmacion_automatica,
    anticipacion_min: fila.reserva_anticipacion_min,
    dias_max: fila.reserva_dias_max,
    intervalo_min: fila.reserva_intervalo_min,
    max_pendientes: fila.reserva_max_pendientes,
  }
}

const entero = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/**
 * Valida las reglas que vienen (todas opcionales) y las pasa a columnas.
 * Devuelve { error } o { columnas }.
 */
export function columnasDeReglas(reglas: Partial<ReglasReserva>) {
  const columnas: Partial<FilaReglas> = {}
  if (reglas.activa !== undefined) {
    if (typeof reglas.activa !== 'boolean') return { error: 'Indica si la reserva en línea está activa' }
    columnas.reserva_activa = reglas.activa
  }
  if (reglas.confirmacion_automatica !== undefined) {
    if (typeof reglas.confirmacion_automatica !== 'boolean') return { error: 'Indica si las reservas se confirman solas' }
    columnas.reserva_confirmacion_automatica = reglas.confirmacion_automatica
  }
  if (reglas.anticipacion_min !== undefined) {
    if (!entero(reglas.anticipacion_min, 0, 10080)) return { error: 'La anticipación mínima no es válida' }
    columnas.reserva_anticipacion_min = reglas.anticipacion_min
  }
  if (reglas.dias_max !== undefined) {
    if (!entero(reglas.dias_max, 1, 180)) return { error: 'Se puede reservar con entre 1 y 180 días de anticipación' }
    columnas.reserva_dias_max = reglas.dias_max
  }
  if (reglas.intervalo_min !== undefined) {
    if (!OPCIONES_INTERVALO.includes(reglas.intervalo_min)) return { error: 'El intervalo entre horas no es válido' }
    columnas.reserva_intervalo_min = reglas.intervalo_min
  }
  if (reglas.max_pendientes !== undefined) {
    if (!entero(reglas.max_pendientes, 1, 10)) return { error: 'El máximo de reservas pendientes va de 1 a 10' }
    columnas.reserva_max_pendientes = reglas.max_pendientes
  }
  return { columnas }
}
