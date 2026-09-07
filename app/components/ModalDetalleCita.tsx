'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { LABEL, BOTON_PRIMARIO, BOTON_SECUNDARIO } from './estilos'

export interface CitaDetalle {
  id: string
  inicio: string
  fin: string | null
  estado: string
  cliente: { nombre: string; telefono: string | null } | null
  peluquero: { id: string; nombre: string; color_agenda: string | null } | null
  servicios: { nombre: string; duracion_minutos: number; precio_clp: number }[]
}

interface Props {
  cita: CitaDetalle | null
  onCerrar: () => void
  onActualizada: () => void
}

const ESTADOS = [
  { valor: 'pendiente', label: 'Pendiente' },
  { valor: 'confirmada', label: 'Confirmada' },
  { valor: 'completada', label: 'Completada' },
  { valor: 'no_show', label: 'No llegó' },
]

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function ModalDetalleCita({ cita, onCerrar, onActualizada }: Props) {
  const [estado, setEstado] = useState('pendiente')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    if (!cita) return
    // 'cancelada' no está entre las opciones: una cita cancelada se reactiva
    // eligiendo otro estado, así que el selector parte en pendiente.
    setEstado(cita.estado === 'cancelada' ? 'pendiente' : cita.estado)
    setError('')
  }, [cita])

  if (!cita) return null

  const precioTotal = cita.servicios.reduce((t, s) => t + s.precio_clp, 0)
  const duracionTotal = cita.servicios.reduce((t, s) => t + s.duracion_minutos, 0)

  async function guardarEstado() {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/citas/${cita!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos actualizar la cita')
        return
      }
      onActualizada()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  async function cancelarCita() {
    setCancelando(true)
    setError('')
    try {
      const res = await fetch(`/api/citas/${cita!.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cancelar la cita')
        return
      }
      onActualizada()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <Modal titulo="Detalle de la cita" abierto onCerrar={onCerrar}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-500 first-letter:uppercase">{formatearFechaHora(cita.inicio)}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {cita.cliente?.nombre ?? 'Sin cliente'}
          </p>
          {cita.cliente?.telefono && (
            <p className="text-sm text-gray-500">{cita.cliente.telefono}</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200">
          {cita.servicios.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Sin servicios</p>
          ) : (
            cita.servicios.map((servicio, i) => (
              <div
                key={`${servicio.nombre}-${i}`}
                className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm last:border-0"
              >
                <span className="font-medium text-gray-800">{servicio.nombre}</span>
                <span className="text-gray-400">{servicio.duracion_minutos} min</span>
                <span className="w-20 text-right text-gray-600">{formatearCLP(servicio.precio_clp)}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {cita.peluquero?.nombre ?? 'Sin peluquero'}
          </span>
          <span className="text-sm">
            {duracionTotal} min
            <span className="ml-3 font-bold">{formatearCLP(precioTotal)}</span>
          </span>
        </div>

        {cita.estado === 'cancelada' && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Esta cita está cancelada. Puedes reactivarla eligiendo otro estado.
          </p>
        )}

        <div>
          <label htmlFor="estadoCita" className={LABEL}>Estado</label>
          <select
            id="estadoCita"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>{e.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-between gap-3 border-t border-gray-100 pt-4">
          {cita.estado !== 'cancelada' ? (
            <button
              onClick={cancelarCita}
              disabled={cancelando}
              className="px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
            >
              {cancelando ? 'Cancelando...' : 'Cancelar cita'}
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-3">
            <button onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button>
            <button
              onClick={guardarEstado}
              disabled={guardando || estado === cita.estado}
              className={BOTON_PRIMARIO}
            >
              {guardando ? 'Guardando...' : cita.estado === 'cancelada' ? 'Reactivar' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
