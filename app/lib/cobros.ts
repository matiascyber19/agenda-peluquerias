// Cobro de una cita: una venta (tabla `ventas`) con un ítem por servicio
// (`venta_items`). Los ingresos del dashboard y de reportes salen de ahí.

/** Los mismos valores que acepta el CHECK `medio_pago_valido` de `ventas`. */
export const MEDIOS_DE_PAGO = [
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'transferencia', label: 'Transferencia' },
  { valor: 'debito', label: 'Débito' },
  { valor: 'credito', label: 'Crédito' },
] as const

export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number]['valor']

export function esMedioDePago(valor: unknown): valor is MedioDePago {
  return MEDIOS_DE_PAGO.some((m) => m.valor === valor)
}

export function etiquetaMedioDePago(valor: string) {
  return MEDIOS_DE_PAGO.find((m) => m.valor === valor)?.label ?? valor
}

/** Estados en que una cita se puede cobrar. Sin estado cuenta como pendiente. */
export function esCobrable(estado: string | null) {
  return estado === null || ['pendiente', 'confirmada', 'completada'].includes(estado)
}

/** Estados que no pueden quedar con un cobro registrado. */
export const ESTADOS_SIN_COBRO = ['cancelada', 'no_show', 'rechazada']

export interface Cobro {
  id: string
  total_clp: number
  medio_pago: string
  fecha: string
}
