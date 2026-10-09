'use client'

import { useState } from 'react'
import Modal from './Modal'
import { INPUT, LABEL, BOTON_PRIMARIO, BOTON_SECUNDARIO } from './estilos'
import { type Cobro, MEDIOS_DE_PAGO, type MedioDePago, esCobrable, etiquetaMedioDePago } from '../lib/cobros'

export interface CitaDetalle {
  id: string
  inicio: string
  fin: string | null
  estado: string
  cliente: { nombre: string; telefono: string | null } | null
  peluquero: { id: string; nombre: string; color_agenda: string | null } | null
  servicios: { nombre: string; duracion_minutos: number; precio_clp: number }[]
  cobro?: Cobro | null
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

// El detalle se monta por cada cita que se abre, así el selector parte con su
// estado sin tener que resetearlo en un efecto.
export default function ModalDetalleCita({ cita, ...props }: Props) {
  if (!cita) return null
  return <DetalleCita key={cita.id} cita={cita} {...props} />
}

function DetalleCita({ cita, onCerrar, onActualizada }: Props & { cita: CitaDetalle }) {
  // 'cancelada' no está entre las opciones: una cita cancelada se reactiva
  // eligiendo otro estado, así que el selector parte en pendiente.
  const [estado, setEstado] = useState(cita.estado === 'cancelada' ? 'pendiente' : cita.estado)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const precioTotal = cita.servicios.reduce((t, s) => t + s.precio_clp, 0)
  const duracionTotal = cita.servicios.reduce((t, s) => t + s.duracion_minutos, 0)

  const [medioPago, setMedioPago] = useState<MedioDePago>('efectivo')
  const [totalCobro, setTotalCobro] = useState(String(precioTotal))
  const [cobrando, setCobrando] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [anulando, setAnulando] = useState(false)

  async function registrarCobro() {
    const total = Number(totalCobro)
    if (totalCobro.trim() === '' || !Number.isInteger(total) || total < 0) {
      setError('Ingresa un total válido, en pesos y sin decimales')
      return
    }
    setCobrando(true)
    setError('')
    try {
      const res = await fetch(`/api/citas/${cita.id}/cobro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medio_pago: medioPago, total_clp: total }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos registrar el cobro')
        return
      }
      onActualizada()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setCobrando(false)
    }
  }

  async function anularCobro() {
    setAnulando(true)
    setError('')
    try {
      const res = await fetch(`/api/citas/${cita.id}/cobro`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos anular el cobro')
        return
      }
      onActualizada()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setAnulando(false)
    }
  }

  async function guardarEstado() {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/citas/${cita.id}`, {
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
      const res = await fetch(`/api/citas/${cita.id}`, { method: 'DELETE' })
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

        {cita.cobro ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm">
            <span className="text-green-800">
              Cobrado <span className="font-semibold">{formatearCLP(cita.cobro.total_clp)}</span>
              {' · '}
              {etiquetaMedioDePago(cita.cobro.medio_pago)}
            </span>
            {confirmarAnular ? (
              <span className="flex gap-3">
                <button onClick={() => setConfirmarAnular(false)} className="text-gray-500 hover:text-gray-700">
                  No
                </button>
                <button
                  onClick={anularCobro}
                  disabled={anulando}
                  className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {anulando ? 'Anulando...' : 'Sí, anular'}
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmarAnular(true)}
                className="font-medium text-red-500 hover:text-red-700"
              >
                Anular cobro
              </button>
            )}
          </div>
        ) : esCobrable(cita.estado) ? (
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-800">Registrar cobro</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Medio de pago">
              {MEDIOS_DE_PAGO.map((medio) => (
                <button
                  key={medio.valor}
                  type="button"
                  aria-pressed={medioPago === medio.valor}
                  onClick={() => setMedioPago(medio.valor)}
                  className={
                    medioPago === medio.valor
                      ? 'rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                      : 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-gray-300'
                  }
                >
                  {medio.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="totalCobro" className={LABEL}>Total cobrado</label>
                <input
                  id="totalCobro"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={totalCobro}
                  onChange={(e) => setTotalCobro(e.target.value)}
                  className={INPUT}
                />
              </div>
              <button onClick={registrarCobro} disabled={cobrando} className={BOTON_PRIMARIO}>
                {cobrando ? 'Registrando...' : 'Registrar cobro'}
              </button>
            </div>
          </div>
        ) : null}

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
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
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
