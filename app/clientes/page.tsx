'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'

interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string | null
  cumpleanos: string | null
  como_llego: string | null
  notas: string | null
  bloqueado: boolean
  ultimaVisita: string | null
  servicios: number
  servicioHabitual: { nombre: string; veces: number } | null
  gasto: number
}

// Los clientes ya no se crean aquí: llegan solos al reservar en línea o al
// crear una cita. La lista parte mostrando a los que ya se atendieron.
const FILTROS = [
  { valor: 'atendidos', label: 'Atendidos' },
  { valor: 'sin-visitar', label: 'Sin visitar 60+ días' },
  { valor: 'sin-atender', label: 'Aún no atendidos' },
  { valor: 'bloqueados', label: 'Bloqueados' },
  { valor: 'todos', label: 'Todos' },
]

// Cuántos clientes se leen como máximo para armar la lista (tope de la API).
const LIMITE_CLIENTES = 500

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

function formatearFecha(iso: string | null) {
  if (!iso) return 'Sin visitas'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  })
}

export default function ClientesPage() {
  const router = useRouter()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('atendidos')

  // debounce de la búsqueda: no dispara un fetch por cada tecla
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  // La respuesta recuerda qué búsqueda pidió: mientras no coincida con la
  // actual, la lista está cargando. Así el efecto no necesita hacer
  // setLoading(true) de forma síncrona.
  const consulta = `${busquedaAplicada}|${filtro}`
  const [respuesta, setRespuesta] = useState<{
    consulta: string
    clientes: Cliente[]
    error: string
  }>({ consulta: '', clientes: [], error: '' })
  const loading = respuesta.consulta !== consulta
  const error = loading ? '' : respuesta.error
  const clientes = respuesta.clientes

  // Búsqueda en servidor: la API soporta ?buscar=, ?bloqueado= y ?vista=.
  useEffect(() => {
    const controller = new AbortController()

    const params = new URLSearchParams({ limit: String(LIMITE_CLIENTES) })
    if (busquedaAplicada) params.set('buscar', busquedaAplicada)
    if (filtro === 'atendidos' || filtro === 'sin-visitar') params.set('vista', 'atendidos')
    if (filtro === 'sin-atender') params.set('vista', 'sin-atender')
    if (filtro === 'bloqueados') params.set('bloqueado', 'true')

    fetch(`/api/clientes?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los clientes')
        return json
      })
      .then((json) => setRespuesta({ consulta, clientes: json.clientes ?? [], error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRespuesta({ consulta, clientes: [], error: err.message })
      })

    return () => controller.abort()
  }, [consulta, busquedaAplicada, filtro])

  // "Sin visitar 60+ días" no existe como filtro en la API: se resuelve en
  // cliente sobre los atendidos.
  const clientesFiltrados = useMemo(() => {
    if (filtro !== 'sin-visitar') return clientes

    const haceSesentaDias = new Date()
    haceSesentaDias.setDate(haceSesentaDias.getDate() - 60)

    return clientes.filter(
      (cliente) => cliente.ultimaVisita && new Date(cliente.ultimaVisita) < haceSesentaDias
    )
  }, [clientes, filtro])

  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading
              ? 'Cargando...'
              : error
              ? '—'
              : `${clientesFiltrados.length} ${clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}`}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Se agregan solos al reservar en línea o al crear una cita
          </p>
        </div>

        {/* Buscador y filtros */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            />
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {error ? (
            <p className="text-sm text-red-500 py-12 text-center">{error}</p>
          ) : loading ? (
            <p className="text-sm text-gray-400 py-12 text-center">Cargando clientes...</p>
          ) : clientesFiltrados.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              {busquedaAplicada
                ? 'Ningún cliente coincide con la búsqueda'
                : filtro === 'atendidos'
                ? 'Todavía no hay clientes atendidos: aparecen aquí cuando completas su primera cita'
                : 'No hay clientes en esta categoría'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Última visita</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Servicio habitual</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Servicios</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Total gastado</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente, i) => (
                    <tr
                      key={cliente.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === clientesFiltrados.length - 1 ? 'border-0' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                            {cliente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{cliente.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{cliente.telefono ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatearFecha(cliente.ultimaVisita)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {cliente.servicioHabitual
                          ? `${cliente.servicioHabitual.nombre} (${cliente.servicioHabitual.veces}×)`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{cliente.servicios}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatearCLP(cliente.gasto)}</td>
                      <td className="px-6 py-4">
                        {cliente.bloqueado ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/clientes/${cliente.id}`)}
                          className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                        >
                          Ver ficha →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
