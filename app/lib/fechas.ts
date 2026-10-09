// El servidor corre en UTC (Vercel), pero los días de la peluquería son los de
// Chile: un "día cerrado" empieza a medianoche en Santiago, no en UTC.
//
// Chile continental está en UTC-3 (verano) o UTC-4 (invierno). Para pasar una
// fecha y hora de Chile a un instante se prueban esos dos desfases y se elige
// el que, visto en Chile, da exactamente esa fecha y hora. Así también se
// cubren los días de cambio de horario.

const ZONA = 'America/Santiago'
const DESFASES_HORAS = [3, 4]

/** "AAAA-MM-DD HH:MM" de ese instante en Chile. */
function enChile(instante: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instante)
}

/** ¿Es una fecha real con formato AAAA-MM-DD? */
export function esFecha(fecha: unknown): fecha is string {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** Fecha AAAA-MM-DD de ese instante en Chile. */
export function fechaEnChile(instante: Date) {
  return enChile(instante).slice(0, 10)
}

/**
 * Instante de esa fecha (AAAA-MM-DD) y hora (HH:MM) en Chile. Si la hora se
 * repite (al volver al horario de invierno) se usa la primera; si no existe
 * (al pasar al de verano, entre las 00:00 y las 00:59) se usa la siguiente.
 */
export function instanteEnChile(fecha: string, hora: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  const comoUtc = Date.UTC(anio, mes - 1, dia, h, m)
  for (const desfase of DESFASES_HORAS) {
    const candidato = new Date(comoUtc + desfase * 3_600_000)
    if (enChile(candidato) === `${fecha} ${hora}`) return candidato
  }
  return new Date(comoUtc + DESFASES_HORAS[DESFASES_HORAS.length - 1] * 3_600_000)
}

/**
 * Instante en que empieza ese día (AAAA-MM-DD) en Chile: el primero de los
 * desfases posibles que ya cae en esa fecha. El día del cambio a horario de
 * verano la medianoche no existe y el día empieza a la 01:00.
 */
export function inicioDelDiaEnChile(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const medianocheUtc = Date.UTC(anio, mes - 1, dia)
  for (const desfase of DESFASES_HORAS) {
    const candidato = new Date(medianocheUtc + desfase * 3_600_000)
    if (fechaEnChile(candidato) === fecha) return candidato
  }
  return new Date(medianocheUtc + DESFASES_HORAS[DESFASES_HORAS.length - 1] * 3_600_000)
}

/** Mes AAAA-MM al que se le suman (o restan) meses. */
export function sumarMeses(mes: string, meses: number) {
  const [anio, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio, m - 1 + meses, 1)).toISOString().slice(0, 7)
}

/** Primer y último día (AAAA-MM-DD) de un mes AAAA-MM. */
export function diasDelMes(mes: string) {
  const [anio, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

/** "octubre de 2026" */
export function nombreDelMes(mes: string) {
  const [anio, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio, m - 1, 15)).toLocaleDateString('es-CL', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
}
