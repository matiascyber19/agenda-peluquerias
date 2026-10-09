'use client'

import { useEffect, useState } from 'react'
import { INPUT, LABEL, BOTON_PRIMARIO } from '../components/estilos'
import {
  OPCIONES_ANTICIPACION,
  OPCIONES_DIAS,
  OPCIONES_INTERVALO,
  OPCIONES_PENDIENTES,
  type ReglasReserva,
} from '../lib/reglasReserva'

/** Interruptor con texto: se ve como un switch y es un checkbox accesible. */
function Interruptor({ id, activo, onCambiar, titulo, detalle }: {
  id: string
  activo: boolean
  onCambiar: (valor: boolean) => void
  titulo: string
  detalle: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-gray-800">{titulo}</span>
        <span className="block text-xs text-gray-500">{detalle}</span>
      </span>
      <input id={id} type="checkbox" checked={activo} onChange={(e) => onCambiar(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-amber-400 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400"
      />
    </label>
  )
}

/** Reglas de la reserva en línea: si está activa, cómo se confirma y sus límites. */
export default function SeccionReglas() {
  const [cargando, setCargando] = useState(true)
  // Si la carga falla no se muestra el formulario: guardarlo cambiaría las reglas.
  const [reglas, setReglas] = useState<ReglasReserva | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar las reglas')
        return json.reglas as ReglasReserva
      })
      .then(setReglas)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  function cambiar<K extends keyof ReglasReserva>(campo: K, valor: ReglasReserva[K]) {
    setReglas((previas) => (previas ? { ...previas, [campo]: valor } : previas))
    setGuardado(false)
  }

  async function guardar() {
    if (!reglas) return
    setGuardando(true)
    setGuardado(false)
    setError('')
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reglas }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar las reglas')
        return
      }
      setReglas(json.reglas)
      setGuardado(true)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-800">Reglas de la reserva en línea</h2>
      <p className="mt-1 text-sm text-gray-500">Cómo y cuándo pueden reservar tus clientes desde tu enlace</p>

      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando...</p>
      ) : !reglas ? (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
        >
          <Interruptor
            id="reservaActiva"
            activo={reglas.activa}
            onCambiar={(v) => cambiar('activa', v)}
            titulo="Recibir reservas en línea"
            detalle="Apagado, tu página de reservas avisa que por ahora no se puede reservar."
          />
          <Interruptor
            id="confirmacionAutomatica"
            activo={reglas.confirmacion_automatica}
            onCambiar={(v) => cambiar('confirmacion_automatica', v)}
            titulo="Confirmar las reservas automáticamente"
            detalle="Encendido, la reserva entra directo a la agenda. Apagado, llega a Solicitudes y tú la confirmas."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="anticipacion" className={LABEL}>Anticipación mínima</label>
              <select
                id="anticipacion"
                value={reglas.anticipacion_min}
                onChange={(e) => cambiar('anticipacion_min', Number(e.target.value))}
                className={INPUT}
              >
                {OPCIONES_ANTICIPACION.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Cuánto antes de la hora se puede reservar.</p>
            </div>
            <div>
              <label htmlFor="diasMax" className={LABEL}>Reservas hasta</label>
              <select
                id="diasMax"
                value={reglas.dias_max}
                onChange={(e) => cambiar('dias_max', Number(e.target.value))}
                className={INPUT}
              >
                {OPCIONES_DIAS.map((d) => (
                  <option key={d} value={d}>{d} días hacia adelante</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="intervalo" className={LABEL}>Horas cada</label>
              <select
                id="intervalo"
                value={reglas.intervalo_min}
                onChange={(e) => cambiar('intervalo_min', Number(e.target.value))}
                className={INPUT}
              >
                {OPCIONES_INTERVALO.map((m) => (
                  <option key={m} value={m}>{m === 60 ? '1 hora' : `${m} minutos`}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Por ejemplo, cada 30 minutos: 10:00, 10:30, 11:00...</p>
            </div>
            <div>
              <label htmlFor="maxPendientes" className={LABEL}>Reservas pendientes por cliente</label>
              <select
                id="maxPendientes"
                value={reglas.max_pendientes}
                onChange={(e) => cambiar('max_pendientes', Number(e.target.value))}
                className={INPUT}
              >
                {OPCIONES_PENDIENTES.map((n) => (
                  <option key={n} value={n}>Hasta {n}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Evita que una misma persona tome muchas horas.</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            {guardado && <span className="text-sm text-green-600">Guardado ✓</span>}
            <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
              {guardando ? 'Guardando...' : 'Guardar reglas'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
