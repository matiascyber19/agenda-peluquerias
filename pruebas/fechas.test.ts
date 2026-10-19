import { describe, expect, it } from 'vitest'
import { cuandoEs, fechaEnChile, inicioDelDiaEnChile, instanteEnChile, sumarDias } from '@/app/lib/fechas'

// El servidor corre en UTC (Vercel) y las fechas de la peluquería son las de
// Chile, que cambia de horario dos veces al año.

/** "AAAA-MM-DD HH:MM" de un instante en Chile. */
const enChile = (d: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

const DIAS_DE_2026 = Array.from({ length: 365 }, (_, i) => sumarDias('2026-01-01', i))

describe('fechas en hora de Chile', () => {
  it('fechaEnChile usa el día de Chile, no el de UTC', () => {
    // 02:30 UTC del 10 de octubre todavía es 9 de octubre en Chile (UTC-3)
    expect(fechaEnChile(new Date('2026-10-10T02:30:00Z'))).toBe('2026-10-09')
  })

  it('instanteEnChile da la hora pedida en Chile todos los días del año, también con cambio de horario', () => {
    const errores = DIAS_DE_2026.filter((fecha) => enChile(instanteEnChile(fecha, '12:00')) !== `${fecha} 12:00`)
    expect(errores).toEqual([])
  })

  it('inicioDelDiaEnChile es el primer minuto del día en Chile, todos los días del año', () => {
    const errores = DIAS_DE_2026.filter((fecha) => {
      const inicio = inicioDelDiaEnChile(fecha)
      const unMinutoAntes = new Date(inicio.getTime() - 60_000)
      return fechaEnChile(inicio) !== fecha || fechaEnChile(unMinutoAntes) !== sumarDias(fecha, -1)
    })
    expect(errores).toEqual([])
  })

  it('los días con cambio de horario duran 23 o 25 horas, y son exactamente dos', () => {
    const duracion = (fecha: string) =>
      (inicioDelDiaEnChile(sumarDias(fecha, 1)).getTime() - inicioDelDiaEnChile(fecha).getTime()) / 3_600_000
    const distintos = DIAS_DE_2026.map((fecha) => [fecha, duracion(fecha)] as const).filter(([, h]) => h !== 24)
    expect(distintos.map(([, h]) => h).sort()).toEqual([23, 25])
  })
})

describe('cuándo es la próxima cita', () => {
  const ahora = new Date('2026-10-09T15:20:00Z') // viernes 9, 12:20 en Chile

  it.each([
    ['2026-10-09T15:20:00Z', 'Hoy', 'Ahora'],
    ['2026-10-09T15:45:00Z', 'Hoy', 'En 25 min'],
    ['2026-10-09T17:35:00Z', 'Hoy', 'En 2 h 15 min'],
    ['2026-10-09T18:20:00Z', 'Hoy', 'En 3 h'],
    ['2026-10-10T02:30:00Z', 'Hoy', 'En 11 h 10 min'], // 23:30 en Chile: en UTC ya es mañana
    ['2026-10-10T13:00:00Z', 'Mañana', 'En 21 h 40 min'],
    ['2026-10-10T23:00:00Z', 'Mañana', 'Mañana'],
    ['2026-10-11T13:00:00Z', 'domingo 11 de octubre', 'En 2 días'],
    ['2026-10-16T13:00:00Z', 'viernes 16 de octubre', 'En 7 días'], // antes decía "En 9940 minutos"
  ])('%s → %s, %s', (inicio, dia, falta) => {
    expect(cuandoEs(inicio, ahora)).toEqual({ dia, falta })
  })
})
