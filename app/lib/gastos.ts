// Categorías de gastos. Se guardan con este mismo texto en `gastos.categoria`,
// que es lo que muestra Reportes en "Gastos por categoría".
export const CATEGORIAS_GASTO = [
  'Arriendo',
  'Sueldos',
  'Productos e insumos',
  'Servicios básicos',
  'Publicidad',
  'Mantención',
  'Impuestos',
  'Otros',
] as const

export const MONTO_MAXIMO_GASTO = 100_000_000

export interface Gasto {
  id: string
  descripcion: string
  categoria: string | null
  monto_clp: number
  fecha: string
}
