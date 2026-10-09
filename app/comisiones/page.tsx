'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import SelectorMes from '../components/SelectorMes'
import { BOTON_PRIMARIO } from '../components/estilos'
import { diasDelMes } from '../lib/fechas'
import { useHoyEnChile } from '../lib/useHoyEnChile'
import { esRol, type Rol } from '../lib/roles'

interface ResumenPeluquero {
  id: string
  nombre: string
  activo: boolean
  porcentaje: number
  ventas: number
  comision: number
  pendiente: number
}

interface Detalle {
  id: string
  peluquero_id: string
  fecha: string
  cliente: string | null
  venta: number
  comision: number
  pagado: boolean
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function formatearDia(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export default function ComisionesPage() {
  // Mientras no se elija otro, el mes en curso según Chile ('' en el servidor).
  const hoy = useHoyEnChile()
  const [mesElegido, setMes] = useState<string | null>(null)
  const mes = mesElegido ?? hoy.slice(0, 7)
  const [recarga, setRecarga] = useState(0)
  const [rol, setRol] = useState<Rol | null>(null)
  const [porPagar, setPorPagar] = useState<string | null>(null)
  const [pagando, setPagando] = useState(false)
  const [aviso, setAviso] = useState('')

  const consulta = mes ? `${mes}|${recarga}` : ''
  const [respuesta, setRespuesta] = useState<{
    consulta: string
    peluqueros: ResumenPeluquero[]
    detalle: Detalle[]
    error: string
  }>({ consulta: '', peluqueros: [], detalle: [], error: '' })
  const cargando = !consulta || respuesta.consulta !== consulta

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setRol(esRol(json?.rol) ? json.rol : null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!mes) return
    const controller = new AbortController()
    fetch(`/api/comisiones?${new URLSearchParams(diasDelMes(mes)).toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar las comisiones')
        return json as { peluqueros: ResumenPeluquero[]; detalle: Detalle[] }
      })
      .then((json) => setRespuesta({ consulta, peluqueros: json.peluqueros, detalle: json.detalle, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRespuesta({ consulta, peluqueros: [], detalle: [], error: err.message })
      })
    return () => controller.abort()
  }, [consulta, mes])

  async function pagar(peluquero: ResumenPeluquero) {
    setPagando(true)
    setAviso('')
    try {
      const res = await fetch('/api/comisiones/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peluquero_id: peluquero.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAviso(json.error ?? 'No pudimos marcar el pago')
        return
      }
      setAviso(`Marcaste ${formatearCLP(json.monto)} como pagados a ${peluquero.nombre}.`)
      setPorPagar(null)
      setRecarga((n) => n + 1)
    } catch {
      setAviso('No pudimos conectar con el servidor')
    } finally {
      setPagando(false)
    }
  }

  const esDueno = rol === 'dueño'
  const nombres = Object.fromEntries(respuesta.peluqueros.map((p) => [p.id, p.nombre]))
  // Se muestran los peluqueros activos y los que tienen algo que mostrar.
  const visibles = respuesta.peluqueros.filter((p) => p.activo || p.comision > 0 || p.pendiente > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rol === 'peluquero' ? 'Mis comisiones' : 'Comisiones'}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Se calculan solas al registrar el cobro de una cita, con el porcentaje de cada peluquero.
            </p>
          </div>
          {mes && <SelectorMes mes={mes} onCambiar={setMes} />}
        </div>

        {aviso && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{aviso}</p>}

        {cargando ? (
          <p className="py-12 text-center text-sm text-gray-400">Cargando comisiones...</p>
        ) : respuesta.error ? (
          <p className="py-12 text-center text-sm text-red-500">{respuesta.error}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {visibles.length === 0 && (
                <p className="text-sm text-gray-400">
                  {rol === 'peluquero' ? 'Tu cuenta no está vinculada a una ficha de peluquero.' : 'No hay peluqueros.'}
                </p>
              )}
              {visibles.map((p) => (
                <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{p.nombre}</h2>
                    <span className="text-xs text-gray-500">
                      {p.porcentaje > 0 ? `${p.porcentaje} % por cobro` : 'Sin comisión'}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Cobros del mes</dt>
                      <dd className="font-semibold text-gray-800">{formatearCLP(p.ventas)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Comisión del mes</dt>
                      <dd className="font-semibold text-gray-800">{formatearCLP(p.comision)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Por pagar</dt>
                      <dd className={`font-semibold ${p.pendiente > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
                        {formatearCLP(p.pendiente)}
                      </dd>
                    </div>
                  </dl>

                  {p.porcentaje === 0 && esDueno && (
                    <p className="mt-3 text-xs text-gray-400">
                      Para que genere comisión, ponle contrato por comisión en{' '}
                      <Link href="/peluqueros" className="font-medium text-slate-700 hover:underline">Peluqueros</Link>.
                    </p>
                  )}

                  {esDueno && p.pendiente > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {porPagar === p.id ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700">¿Le pagaste {formatearCLP(p.pendiente)}?</span>
                          <span className="flex gap-3">
                            <button type="button" onClick={() => setPorPagar(null)} className="text-gray-500 hover:text-gray-700">
                              No
                            </button>
                            <button type="button" onClick={() => pagar(p)} disabled={pagando} className={BOTON_PRIMARIO}>
                              {pagando ? 'Guardando...' : 'Sí, marcar pagado'}
                            </button>
                          </span>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPorPagar(p.id)} className="text-sm font-medium text-slate-700 hover:underline">
                          Marcar {formatearCLP(p.pendiente)} como pagado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-800">Detalle del mes</h2>
              {respuesta.detalle.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No hay comisiones este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        {esDueno && <th className="py-2 pr-3 font-medium">Peluquero</th>}
                        <th className="py-2 pr-3 font-medium">Cliente</th>
                        <th className="py-2 pr-3 text-right font-medium">Cobro</th>
                        <th className="py-2 pr-3 text-right font-medium">Comisión</th>
                        <th className="py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {respuesta.detalle.map((d) => (
                        <tr key={d.id}>
                          <td className="py-2 pr-3 text-gray-500">{formatearDia(d.fecha)}</td>
                          {esDueno && <td className="py-2 pr-3 text-gray-800">{nombres[d.peluquero_id] ?? '—'}</td>}
                          <td className="py-2 pr-3 text-gray-800">{d.cliente ?? '—'}</td>
                          <td className="py-2 pr-3 text-right text-gray-600">{formatearCLP(d.venta)}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-gray-900">{formatearCLP(d.comision)}</td>
                          <td className="py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                d.pagado ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {d.pagado ? 'Pagada' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
