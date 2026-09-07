'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ModalServicio, { type Servicio } from '../components/ModalServicio'

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Servicio | null>(null)
  const [cambiandoId, setCambiandoId] = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')

    fetch('/api/servicios')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los servicios')
        return json
      })
      .then((json) => setServicios(json.servicios ?? []))
      .catch((err) => {
        setError(err.message)
        setServicios([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function alternarActivo(servicio: Servicio) {
    setCambiandoId(servicio.id)
    try {
      // DELETE solo desactiva; para reactivar se usa PATCH con activo: true.
      const res = servicio.activo
        ? await fetch(`/api/servicios/${servicio.id}`, { method: 'DELETE' })
        : await fetch(`/api/servicios/${servicio.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: true }),
          })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cambiar el estado del servicio')
        return
      }
      cargar()
    } finally {
      setCambiandoId('')
    }
  }

  function abrirNuevo() {
    setEnEdicion(null)
    setModalAbierto(true)
  }

  function abrirEdicion(servicio: Servicio) {
    setEnEdicion(servicio)
    setModalAbierto(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading ? 'Cargando...' : error ? '—' : `${servicios.length} ${servicios.length === 1 ? 'servicio' : 'servicios'}`}
            </p>
          </div>
          <button
            onClick={abrirNuevo}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            + Nuevo servicio
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {error ? (
            <p className="py-12 text-center text-sm text-red-500">{error}</p>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Cargando servicios...</p>
          ) : servicios.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              Todavía no tienes servicios. Crea el primero para poder agendar citas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Servicio</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Duración</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Precio</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((servicio) => (
                    <tr key={servicio.id} className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-800">{servicio.nombre}</p>
                        {servicio.descripcion && (
                          <p className="mt-0.5 text-xs text-gray-400">{servicio.descripcion}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{servicio.duracion_minutos} min</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatearCLP(servicio.precio_clp)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            servicio.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {servicio.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => abrirEdicion(servicio)}
                            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => alternarActivo(servicio)}
                            disabled={cambiandoId === servicio.id}
                            className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50"
                          >
                            {cambiandoId === servicio.id ? '...' : servicio.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ModalServicio
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={cargar}
        servicio={enEdicion}
      />
    </div>
  )
}
