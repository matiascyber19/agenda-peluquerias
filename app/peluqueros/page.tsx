'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ModalPeluquero, { type Peluquero } from '../components/ModalPeluquero'

const ETIQUETA_CONTRATO: Record<string, string> = {
  fijo: 'Sueldo fijo',
  comision: 'Comisión',
  arriendo_sillon: 'Arriendo de sillón',
}

export default function PeluquerosPage() {
  const [peluqueros, setPeluqueros] = useState<Peluquero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Peluquero | null>(null)
  const [cambiandoId, setCambiandoId] = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')

    fetch('/api/peluqueros')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los peluqueros')
        return json
      })
      .then((json) => setPeluqueros(json.peluqueros ?? []))
      .catch((err) => {
        setError(err.message)
        setPeluqueros([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function alternarActivo(peluquero: Peluquero) {
    setCambiandoId(peluquero.id)
    try {
      // DELETE solo desactiva; para reactivar se usa PATCH con activo: true.
      const res = peluquero.activo
        ? await fetch(`/api/peluqueros/${peluquero.id}`, { method: 'DELETE' })
        : await fetch(`/api/peluqueros/${peluquero.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: true }),
          })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cambiar el estado del peluquero')
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Peluqueros</h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading ? 'Cargando...' : error ? '—' : `${peluqueros.length} en el equipo`}
            </p>
          </div>
          <button
            onClick={abrirNuevo}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            + Nuevo peluquero
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Cargando peluqueros...</p>
        ) : peluqueros.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm text-gray-400">
              Todavía no tienes peluqueros. Agrega al menos uno para poder agendar citas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {peluqueros.map((peluquero) => (
              <div
                key={peluquero.id}
                className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
                  peluquero.activo ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: peluquero.color_agenda }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{peluquero.nombre}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {peluquero.telefono ?? 'Sin teléfono'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      peluquero.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {peluquero.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <p className="mt-4 text-sm text-gray-600">
                  {ETIQUETA_CONTRATO[peluquero.tipo_contrato] ?? peluquero.tipo_contrato}
                  {peluquero.tipo_contrato === 'comision' && (
                    <span className="text-gray-400"> · {peluquero.porcentaje_comision}%</span>
                  )}
                </p>

                <div className="mt-4 flex gap-3 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => {
                      setEnEdicion(peluquero)
                      setModalAbierto(true)
                    }}
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarActivo(peluquero)}
                    disabled={cambiandoId === peluquero.id}
                    className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50"
                  >
                    {cambiandoId === peluquero.id ? '...' : peluquero.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalPeluquero
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={cargar}
        peluquero={enEdicion}
      />
    </div>
  )
}
