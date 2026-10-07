// El servidor corre en UTC (Vercel), pero los días de la peluquería son los de
// Chile: un "día cerrado" empieza a medianoche en Santiago, no en UTC.

const ZONA = 'America/Santiago'

/** Offset de Chile respecto a UTC, en ms, para ese instante (contempla horario de verano). */
function offsetChile(instante: Date) {
  const etiqueta = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value

  const partes = /GMT([+-])(\d{2}):(\d{2})/.exec(etiqueta ?? '')
  if (!partes) return 0
  const signo = partes[1] === '-' ? -1 : 1
  return signo * (Number(partes[2]) * 60 + Number(partes[3])) * 60_000
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

/** Instante en que empieza ese día (AAAA-MM-DD) en Chile. */
export function inicioDelDiaEnChile(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const medianocheUtc = Date.UTC(anio, mes - 1, dia)
  // Dos pasadas: el offset correcto es el de la medianoche chilena, que en los
  // días de cambio de horario puede diferir del de la medianoche UTC.
  const aproximado = medianocheUtc - offsetChile(new Date(medianocheUtc))
  return new Date(medianocheUtc - offsetChile(new Date(aproximado)))
}

/** Fecha AAAA-MM-DD de ese instante en Chile. */
export function fechaEnChile(instante: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(instante)
}
