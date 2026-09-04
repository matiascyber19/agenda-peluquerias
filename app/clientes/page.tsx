'use client'

import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'

interface Cliente {
  id: string
  nombre: string
  telefono: string | null
  ultimaVisita: string | null
  totalServicios: number
  totalGastadoClp: number
  bloqueado: boolean
}

const FILTROS = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'activos', label: 'Activos' },
  { valor: 'inactivos60', label: 'Sin visitar 60+ días' },
  { valor: 'bloqueados', label: 'Bloqueados' },
]

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function formatearFecha(iso: string | null) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // debounce de la búsqueda: no dispara un fetch por cada tecla
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    if (busquedaAplicada) params.set('q', busquedaAplicada)
    if (filtro !== 'todos') params.set('filtro', filtro)

    fetch(`/api/clientes?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los clientes')
        return json
      })
      .then((json) => setClientes(json.clientes ?? []))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setClientes([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [busquedaAplicada, filtro])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 text-sm mt-1">
              {loading ? 'Cargando...' : error ? '—' : `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`}
            </p>
          </div>
          <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
            + Nuevo cliente
          </button>
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
              className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
            />
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
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
          ) : clientes.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              {busquedaAplicada || filtro !== 'todos'
                ? 'Ningún cliente coincide con la búsqueda'
                : 'Todavía no tienes clientes registrados'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Última visita</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Servicios</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Total gastado</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente, i) => (
                    <tr
                      key={cliente.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === clientes.length - 1 ? 'border-0' : ''}`}
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
                      <td className="px-6 py-4 text-sm text-gray-500">{cliente.totalServicios}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatearCLP(cliente.totalGastadoClp)}</td>
                      <td className="px-6 py-4">
                        {cliente.bloqueado ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
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
