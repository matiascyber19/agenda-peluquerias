'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import SelectorMes from '../components/SelectorMes'
import { BOTON_PRIMARIO, INPUT, LABEL } from '../components/estilos'
import { diasDelMes } from '../lib/fechas'
import { useHoyEnChile } from '../lib/useHoyEnChile'
import { CATEGORIAS_GASTO, type Gasto } from '../lib/gastos'

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** "8 oct." Se lee al mediodía para que la zona horaria no corra el día. */
function formatearDia(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export default function GastosPage() {
  // Hoy según Chile ('' mientras se renderiza en el servidor). Mientras la
  // persona no elija otro mes o fecha, se usan los de hoy.
  const hoy = useHoyEnChile()
  const [mesElegido, setMes] = useState<string | null>(null)
  const mes = mesElegido ?? hoy.slice(0, 7)
  const [recarga, setRecarga] = useState(0)

  // La respuesta recuerda qué mes (y qué recarga) pidió: mientras no coincida,
  // la lista está cargando.
  const consulta = mes ? `${mes}|${recarga}` : ''
  const [respuesta, setRespuesta] = useState<{ consulta: string; gastos: Gasto[]; error: string }>({
    consulta: '',
    gastos: [],
    error: '',
  })
  const cargando = !consulta || respuesta.consulta !== consulta
  const gastos = respuesta.gastos

  const [fechaElegida, setFecha] = useState<string | null>(null)
  const fecha = fechaElegida ?? hoy
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [porBorrar, setPorBorrar] = useState<string | null>(null)

  useEffect(() => {
    if (!mes) return
    const controller = new AbortController()
    const params = new URLSearchParams(diasDelMes(mes))
    fetch(`/api/gastos?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los gastos')
        return (json.gastos ?? []) as Gasto[]
      })
      .then((lista) => setRespuesta({ consulta, gastos: lista, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRespuesta({ consulta, gastos: [], error: err.message })
      })
    return () => controller.abort()
  }, [consulta, mes])

  async function registrar() {
    const valor = Number(monto)
    if (!Number.isInteger(valor) || valor <= 0) return setError('Ingresa el monto en pesos, sin puntos ni decimales')
    if (!categoria) return setError('Elige una categoría')
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, descripcion, categoria, monto_clp: valor }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos registrar el gasto')
        return
      }
      setDescripcion('')
      setMonto('')
      // Muestra el mes del gasto recién registrado.
      setMes(fecha.slice(0, 7))
      setRecarga((n) => n + 1)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id: string) {
    setError('')
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      const json = await res?.json().catch(() => ({}))
      setError(json?.error ?? 'No pudimos borrar el gasto')
      return
    }
    setPorBorrar(null)
    setRecarga((n) => n + 1)
  }

  const total = gastos.reduce((suma, g) => suma + g.monto_clp, 0)
  const porCategoria = Object.entries(
    gastos.reduce<Record<string, number>>((acc, g) => {
      const clave = g.categoria ?? 'Otros'
      acc[clave] = (acc[clave] ?? 0) + g.monto_clp
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Arriendo, insumos, sueldos y todo lo que sale. Se descuentan en{' '}
              <Link href="/reportes" className="font-medium text-slate-700 hover:underline">Reportes</Link>.
            </p>
          </div>
          {mes && <SelectorMes mes={mes} onCambiar={setMes} />}
        </div>

        {/* Registrar */}
        <form
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            registrar()
          }}
        >
          <h2 className="mb-4 font-semibold text-gray-800">Registrar gasto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gastoFecha" className={LABEL}>Fecha</label>
              <input id="gastoFecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INPUT} required />
            </div>
            <div>
              <label htmlFor="gastoCategoria" className={LABEL}>Categoría</label>
              <select id="gastoCategoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={INPUT}>
                <option value="">Elige una categoría</option>
                {CATEGORIAS_GASTO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gastoDescripcion" className={LABEL}>Descripción</label>
              <input
                id="gastoDescripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Tinturas, arriendo de octubre..."
                maxLength={200}
                className={INPUT}
                required
              />
            </div>
            <div>
              <label htmlFor="gastoMonto" className={LABEL}>Monto</label>
              <input
                id="gastoMonto"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="25000"
                className={INPUT}
                required
              />
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
              {guardando ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </form>

        {/* Lista del mes */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-gray-800">Gastos del mes</h2>
            {!cargando && <p className="text-lg font-bold text-gray-900">{formatearCLP(total)}</p>}
          </div>

          {porCategoria.length > 0 && !cargando && (
            <div className="mb-4 flex flex-wrap gap-2">
              {porCategoria.map(([nombre, suma]) => (
                <span key={nombre} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  {nombre}: <span className="font-semibold text-gray-800">{formatearCLP(suma)}</span>
                </span>
              ))}
            </div>
          )}

          {cargando ? (
            <p className="py-8 text-center text-sm text-gray-400">Cargando gastos...</p>
          ) : respuesta.error ? (
            <p className="py-8 text-center text-sm text-red-500">{respuesta.error}</p>
          ) : gastos.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No hay gastos registrados este mes.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {gastos.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="w-16 shrink-0 text-gray-400">{formatearDia(g.fecha)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-800">{g.descripcion}</span>
                    <span className="text-xs text-gray-400">{g.categoria ?? 'Otros'}</span>
                  </span>
                  <span className="font-semibold text-gray-900">{formatearCLP(g.monto_clp)}</span>
                  {porBorrar === g.id ? (
                    <span className="flex gap-3">
                      <button type="button" onClick={() => setPorBorrar(null)} className="text-gray-500 hover:text-gray-700">
                        No
                      </button>
                      <button type="button" onClick={() => borrar(g.id)} className="font-medium text-red-600 hover:text-red-800">
                        Sí, borrar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPorBorrar(g.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Borrar ${g.descripcion}`}
                    >
                      Borrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
