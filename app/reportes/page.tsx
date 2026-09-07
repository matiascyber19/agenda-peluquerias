'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { INPUT, LABEL } from '../components/estilos'

interface Reporte {
  periodo: { desde: string; hasta: string }
  resumen: {
    ingresosTotales: number
    gastosTotales: number
    balance: number
    totalVentas: number
    totalGastos: number
    totalCitas: number
    porcentajeNoShow: number
  }
  ventas: { ingresosPorMedioPago: Record<string, number> }
  gastos: { gastosPorCategoria: Record<string, number> }
  citas: { porEstado: Record<string, number> }
  servicios: { masRealizados: { id: string; nombre: string; cantidad: number }[] }
}

function comoFechaInput(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_show: 'No-show',
}

/** Barra proporcional simple: evita traer una librería de gráficos. */
function Barra({ etiqueta, valor, maximo, formato }: {
  etiqueta: string
  valor: number
  maximo: number
  formato: (n: number) => string
}) {
  const porcentaje = maximo > 0 ? Math.round((valor / maximo) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-600">{etiqueta}</span>
        <span className="font-medium text-gray-800">{formato(valor)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  )
}

export default function ReportesPage() {
  const primerDiaDelMes = comoFechaInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const hoy = comoFechaInput(new Date())

  const [desde, setDesde] = useState(primerDiaDelMes)
  const [hasta, setHasta] = useState(hoy)
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ desde, hasta })

    fetch(`/api/reportes?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar el reporte')
        return json as Reporte
      })
      .then(setReporte)
      .catch((err) => {
        setError(err.message)
        setReporte(null)
      })
      .finally(() => setLoading(false))
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const maxMedio = reporte
    ? Math.max(...Object.values(reporte.ventas.ingresosPorMedioPago), 0)
    : 0
  const categorias = reporte ? Object.entries(reporte.gastos.gastosPorCategoria) : []
  const maxCategoria = categorias.length > 0 ? Math.max(...categorias.map(([, v]) => v)) : 0
  const maxServicio = reporte && reporte.servicios.masRealizados.length > 0
    ? reporte.servicios.masRealizados[0].cantidad
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresos, gastos y actividad del período</p>
        </div>

        {/* Selector de período */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label htmlFor="desde" className={LABEL}>Desde</label>
            <input
              id="desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="hasta" className={LABEL}>Hasta</label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {error ? (
          <p className="py-12 text-center text-sm text-red-500">{error}</p>
        ) : loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Cargando reporte...</p>
        ) : !reporte ? null : (
          <>
            {/* Resumen */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ingresos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatearCLP(reporte.resumen.ingresosTotales)}</p>
                <p className="mt-1 text-xs text-gray-400">{reporte.resumen.totalVentas} ventas</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Gastos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatearCLP(reporte.resumen.gastosTotales)}</p>
                <p className="mt-1 text-xs text-gray-400">{reporte.resumen.totalGastos} registros</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Balance</p>
                <p className={`mt-1 text-2xl font-bold ${reporte.resumen.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatearCLP(reporte.resumen.balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">No-show</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{reporte.resumen.porcentajeNoShow}%</p>
                <p className="mt-1 text-xs text-gray-400">de {reporte.resumen.totalCitas} citas</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Medios de pago */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-gray-800">Ingresos por medio de pago</h2>
                {maxMedio === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin ventas en el período</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(reporte.ventas.ingresosPorMedioPago).map(([medio, monto]) => (
                      <Barra
                        key={medio}
                        etiqueta={ETIQUETA_MEDIO[medio] ?? medio}
                        valor={monto}
                        maximo={maxMedio}
                        formato={formatearCLP}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Citas por estado */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-gray-800">Citas por estado</h2>
                {reporte.resumen.totalCitas === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin citas en el período</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(reporte.citas.porEstado).map(([estado, cantidad]) => (
                      <Barra
                        key={estado}
                        etiqueta={ETIQUETA_ESTADO[estado] ?? estado}
                        valor={cantidad}
                        maximo={reporte.resumen.totalCitas}
                        formato={(n) => String(n)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Gastos por categoría */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-gray-800">Gastos por categoría</h2>
                {categorias.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin gastos en el período</p>
                ) : (
                  <div className="space-y-4">
                    {categorias.map(([categoria, monto]) => (
                      <Barra
                        key={categoria}
                        etiqueta={categoria}
                        valor={monto}
                        maximo={maxCategoria}
                        formato={formatearCLP}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Servicios más realizados */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-gray-800">Servicios más realizados</h2>
                {reporte.servicios.masRealizados.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin servicios en el período</p>
                ) : (
                  <div className="space-y-4">
                    {reporte.servicios.masRealizados.map((servicio) => (
                      <Barra
                        key={servicio.id}
                        etiqueta={servicio.nombre}
                        valor={servicio.cantidad}
                        maximo={maxServicio}
                        formato={(n) => `${n}×`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
