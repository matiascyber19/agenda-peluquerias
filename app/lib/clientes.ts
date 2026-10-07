import { type Embebido, uno } from './supabase/embebido'

/**
 * Últimos 9 dígitos del teléfono: "+56 9 6666 6666", "966666666" y
 * "56966666666" quedan iguales. Sirve para no duplicar clientes que escriben
 * su número de distintas formas.
 */
export function normalizarTelefono(telefono: string | null | undefined) {
  return (telefono ?? '').replace(/\D/g, '').slice(-9)
}

interface CitaConServicios {
  cita_servicios: { servicios: Embebido<{ nombre: string }> }[] | null
}

/** Servicios más pedidos en las citas dadas, de mayor a menor. */
export function serviciosFrecuentes(citas: CitaConServicios[], limite: number) {
  const veces = new Map<string, number>()
  for (const cita of citas) {
    for (const detalle of cita.cita_servicios ?? []) {
      const nombre = uno(detalle.servicios)?.nombre
      if (nombre) veces.set(nombre, (veces.get(nombre) ?? 0) + 1)
    }
  }
  return [...veces]
    .map(([nombre, cantidad]) => ({ nombre, veces: cantidad }))
    .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre))
    .slice(0, limite)
}

/** Promedio de días entre visitas consecutivas; null con menos de dos visitas. */
export function diasEntreVisitas(fechas: string[]) {
  if (fechas.length < 2) return null
  const tiempos = fechas.map((f) => new Date(f).getTime()).sort((a, b) => a - b)
  const totalDias = (tiempos[tiempos.length - 1] - tiempos[0]) / 86_400_000
  return Math.round(totalDias / (tiempos.length - 1))
}
