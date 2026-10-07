// Horarios de atención por peluquero (tabla `horarios`). Se usa en el servidor
// y en la pantalla de Configuración, para validar igual en ambos lados.

export interface Franja {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

/** 0 = domingo … 6 = sábado, igual que extract(dow) y getDay(). Se muestran de lunes a domingo. */
export const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
  { dia: 6, nombre: 'Sábado' },
  { dia: 0, nombre: 'Domingo' },
]

export const MAX_FRANJAS_POR_DIA = 4

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function nombreDia(dia: number) {
  return DIAS_SEMANA.find((d) => d.dia === dia)?.nombre ?? 'Un día'
}

/** Devuelve el mensaje de error, o null si las franjas son válidas. */
export function validarFranjas(franjas: unknown): string | null {
  if (!Array.isArray(franjas)) return 'Las franjas deben ser una lista'

  const porDia = new Map<number, Franja[]>()
  for (const franja of franjas) {
    const { dia_semana, hora_inicio, hora_fin } = (franja ?? {}) as Record<string, unknown>
    if (typeof dia_semana !== 'number' || !Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      return 'Día de la semana inválido'
    }
    if (typeof hora_inicio !== 'string' || typeof hora_fin !== 'string' || !HORA.test(hora_inicio) || !HORA.test(hora_fin)) {
      return `${nombreDia(dia_semana)}: las horas deben tener el formato HH:MM`
    }
    if (hora_fin <= hora_inicio) {
      return `${nombreDia(dia_semana)}: una franja termina antes de empezar`
    }
    porDia.set(dia_semana, [...(porDia.get(dia_semana) ?? []), { dia_semana, hora_inicio, hora_fin }])
  }

  for (const [dia, lista] of porDia) {
    if (lista.length > MAX_FRANJAS_POR_DIA) {
      return `${nombreDia(dia)}: como máximo ${MAX_FRANJAS_POR_DIA} franjas`
    }
    const ordenadas = [...lista].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    for (let i = 1; i < ordenadas.length; i++) {
      if (ordenadas[i].hora_inicio < ordenadas[i - 1].hora_fin) {
        return `${nombreDia(dia)}: hay franjas que se cruzan`
      }
    }
  }

  return null
}
