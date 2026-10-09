'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import { INPUT, LABEL } from '../components/estilos'
import { useHoyEnChile } from '../lib/useHoyEnChile'

interface Reporte {
  periodo: { desde: string; hasta: string }
  resumen: {
    ingresosTotales: number
    gastosTotales: number
    comisionesTotales: number
    balance: number
    totalVentas: number
    totalGastos: number
    totalCitas: number
    citasConResultado: number
    porcentajeNoShow: number
  }
  ventas: { ingresosPorMedioPago: Record<string, number> }
  gastos: { gastosPorCategoria: Record<string, number> }
  citas: { porEstado: Record<string, number> }
  servicios: { masRealizados: { id: string; nombre: string; cantidad: number }[] }
}

/** "1 venta", "3 ventas" */
function contar(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`
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
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  )
}

export default function ReportesPage() {
  // Por defecto, el mes en curso según Chile, como los períodos de la API.
  // La página se genera al compilar: "hoy" solo se calcula en el navegador
  // ('' en el servidor) y se usa mientras la persona no elija otras fechas.
  const hoy = useHoyEnChile()
  const [desdeElegido, setDesde] = useState<string | null>(null)
  const [hastaElegido, setHasta] = useState<string | null>(null)
  const desde = desdeElegido ?? (hoy ? `${hoy.slice(0, 8)}01` : '')
  const hasta = hastaElegido ?? hoy

  // La respuesta recuerda qué período pidió: mientras no coincida con el
  // seleccionado, el reporte está cargando. Así el efecto no necesita
  // hacer setLoading(true) de forma síncrona.
  const consulta = desde && hasta ? `${desde}|${hasta}` : ''
  const [respuesta, setRespuesta] = useState<{
    consulta: string
    reporte: Reporte | null
    error: string
  }>({ consulta: '', reporte: null, error: '' })
  const loading = respuesta.consulta !== consulta
  const error = loading ? '' : respuesta.error
  const reporte = respuesta.reporte

  useEffect(() => {
    if (!consulta) return
    const controller = new AbortController()
    const params = new URLSearchParams({ desde, hasta })

    fetch(`/api/reportes?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar el reporte')
        return json as Reporte
      })
      .then((reporte) => setRespuesta({ consulta, reporte, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRespuesta({ consulta, reporte: null, error: err.message })
      })

    return () => controller.abort()
  }, [consulta, desde, hasta])

  const maxMedio = reporte
    ? Math.max(...Object.values(reporte.ventas.ingresosPorMedioPago), 0)
    : 0
  const categorias = reporte ? Object.entries(reporte.gastos.gastosPorCategoria) : []
  const maxCategoria = categorias.length > 0 ? Math.max(...categorias.map(([, v]) => v)) : 0
  const maxServicio = reporte && reporte.servicios.masRealizados.length > 0
    ? reporte.servicios.masRealizados[0].cantidad
    : 0

  return (
    <div className="min-h-screen fondo-panel">
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
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ingresos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatearCLP(reporte.resumen.ingresosTotales)}</p>
                <p className="mt-1 text-xs text-gray-400">{contar(reporte.resumen.totalVentas, 'venta', 'ventas')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Gastos</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatearCLP(reporte.resumen.gastosTotales)}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {contar(reporte.resumen.totalGastos, 'registro', 'registros')} ·{' '}
                  <Link href="/gastos" className="font-medium text-slate-600 hover:underline">Registrar</Link>
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Comisiones</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatearCLP(reporte.resumen.comisionesTotales)}</p>
                <p className="mt-1 text-xs text-gray-400">
                  <Link href="/comisiones" className="font-medium text-slate-600 hover:underline">Ver detalle</Link>
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Balance</p>
                <p className={`mt-1 text-2xl font-bold ${reporte.resumen.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatearCLP(reporte.resumen.balance)}
                </p>
                <p className="mt-1 text-xs text-gray-400">Ingresos − gastos − comisiones</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">No-show</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{reporte.resumen.porcentajeNoShow}%</p>
                <p className="mt-1 text-xs text-gray-400">
                  {reporte.citas.porEstado.no_show ?? 0} de{' '}
                  {contar(reporte.resumen.citasConResultado, 'cita atendida o perdida', 'citas atendidas o perdidas')}
                </p>
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
