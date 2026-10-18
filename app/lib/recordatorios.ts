// Texto del recordatorio que se envía al cliente por WhatsApp. WhatsApp
// muestra en negrita lo que va entre asteriscos.

export interface DatosRecordatorio {
  cliente: string
  peluqueria: string
  direccion?: string | null
  comuna?: string | null
  /** 'hoy' o 'manana', según cuándo es la cita respecto de hoy en Chile. */
  dia: 'hoy' | 'manana'
  /** Inicio de la cita (ISO). */
  inicio: string
  /** "15:30" */
  hora: string
  peluquero?: string | null
  servicios?: string | null
}

/** "sábado 18 de octubre", en Chile. */
function diaLargo(inicio: string) {
  return new Date(inicio)
    .toLocaleDateString('es-CL', { timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
}

export function mensajeRecordatorio(d: DatosRecordatorio) {
  const nombre = d.cliente.trim().split(/\s+/)[0] || d.cliente
  const cuando = `${d.dia === 'hoy' ? 'hoy' : 'mañana'}, ${diaLargo(d.inicio)}, a las *${d.hora}*`
  const con = d.peluquero ? ` con ${d.peluquero}` : ''
  const que = d.servicios ? ` (${d.servicios})` : ''
  const donde = [d.direccion?.trim(), d.comuna?.trim()].filter(Boolean).join(', ')

  return [
    `Hola ${nombre} 👋 Te recordamos tu hora en *${d.peluqueria}* para ${cuando}${con}${que}.`,
    donde ? `📍 ${donde}` : null,
    'Si no puedes venir, avísanos respondiendo este mensaje. ¡Te esperamos!',
  ]
    .filter(Boolean)
    .join('\n')
}
