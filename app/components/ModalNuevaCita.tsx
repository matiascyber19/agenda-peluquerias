'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Modal from './Modal'
import { INPUT, LABEL, BOTON_CREAR, BOTON_SECUNDARIO } from './estilos'

interface ClienteOpcion {
  id: string
  nombre: string
  telefono: string | null
  bloqueado: boolean
}

interface PeluqueroOpcion {
  id: string
  nombre: string
  activo: boolean
}

interface ServicioOpcion {
  id: string
  nombre: string
  duracion_minutos: number
  precio_clp: number
  activo: boolean
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onCreada: () => void
  /** Día preseleccionado (YYYY-MM-DD) cuando se abre desde la grilla. */
  fechaInicial?: string
}

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

export default function ModalNuevaCita({ abierto, onCerrar, onCreada, fechaInicial }: Props) {
  const [clientes, setClientes] = useState<ClienteOpcion[]>([])
  const [peluqueros, setPeluqueros] = useState<PeluqueroOpcion[]>([])
  const [servicios, setServicios] = useState<ServicioOpcion[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(true)

  const [clienteId, setClienteId] = useState('')
  const [peluqueroId, setPeluqueroId] = useState('')
  const [fecha, setFecha] = useState(fechaInicial ?? hoyLocal())
  const [hora, setHora] = useState('10:00')
  const [serviciosElegidos, setServiciosElegidos] = useState<string[]>([])
  const [notas, setNotas] = useState('')

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Al abrir: limpia el formulario y trae las tres listas que necesita el selector.
  useEffect(() => {
    if (!abierto) return

    setClienteId('')
    setPeluqueroId('')
    setFecha(fechaInicial ?? hoyLocal())
    setHora('10:00')
    setServiciosElegidos([])
    setNotas('')
    setError('')
    setCargandoDatos(true)

    const controller = new AbortController()

    Promise.all([
      fetch('/api/clientes?limit=500', { signal: controller.signal }).then((r) => r.json()),
      fetch('/api/peluqueros', { signal: controller.signal }).then((r) => r.json()),
      fetch('/api/servicios', { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([resClientes, resPeluqueros, resServicios]) => {
        setClientes((resClientes.clientes ?? []).filter((c: ClienteOpcion) => !c.bloqueado))
        setPeluqueros((resPeluqueros.peluqueros ?? []).filter((p: PeluqueroOpcion) => p.activo))
        setServicios((resServicios.servicios ?? []).filter((s: ServicioOpcion) => s.activo))
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError('No pudimos cargar clientes, peluqueros o servicios.')
      })
      .finally(() => setCargandoDatos(false))

    return () => controller.abort()
  }, [abierto, fechaInicial])

  const seleccionados = useMemo(
    () => servicios.filter((s) => serviciosElegidos.includes(s.id)),
    [servicios, serviciosElegidos]
  )

  const duracionTotal = seleccionados.reduce((t, s) => t + s.duracion_minutos, 0)
  const precioTotal = seleccionados.reduce((t, s) => t + s.precio_clp, 0)

  const horaFin = useMemo(() => {
    if (!fecha || !hora || duracionTotal === 0) return null
    const inicio = new Date(`${fecha}T${hora}`)
    if (Number.isNaN(inicio.getTime())) return null
    const fin = new Date(inicio.getTime() + duracionTotal * 60000)
    return fin.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
  }, [fecha, hora, duracionTotal])

  function alternarServicio(id: string) {
    setServiciosElegidos((previos) =>
      previos.includes(id) ? previos.filter((s) => s !== id) : [...previos, id]
    )
  }

  async function guardar() {
    if (!clienteId) return setError('Elige un cliente')
    if (!peluqueroId) return setError('Elige un peluquero')
    if (!fecha || !hora) return setError('Elige fecha y hora')
    if (seleccionados.length === 0) return setError('Elige al menos un servicio')

    const inicio = new Date(`${fecha}T${hora}`)
    if (Number.isNaN(inicio.getTime())) return setError('La fecha u hora no es válida')

    setGuardando(true)
    setError('')

    try {
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          peluquero_id: peluqueroId,
          inicio: inicio.toISOString(),
          servicios: seleccionados.map((s) => ({
            servicio_id: s.id,
            precio: s.precio_clp,
            duracion: s.duracion_minutos,
          })),
          notas: notas.trim() || null,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos crear la cita')
        setGuardando(false)
        return
      }

      onCreada()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  const faltanDatos =
    !cargandoDatos && (clientes.length === 0 || peluqueros.length === 0 || servicios.length === 0)

  return (
    <Modal
      titulo="Nueva cita"
      descripcion="Agenda una hora para un cliente"
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="xl"
    >
      {cargandoDatos ? (
        <p className="py-8 text-center text-sm text-gray-400">Cargando datos...</p>
      ) : faltanDatos ? (
        <div className="py-4">
          <p className="text-sm text-gray-600">Antes de agendar necesitas tener cargado:</p>
          <ul className="mt-3 space-y-2 text-sm">
            {clientes.length === 0 && (
              <li>
                · Al menos un cliente —{' '}
                <Link href="/clientes" className="font-medium text-slate-800 hover:underline">
                  ir a Clientes
                </Link>
              </li>
            )}
            {peluqueros.length === 0 && (
              <li>
                · Al menos un peluquero activo —{' '}
                <Link href="/peluqueros" className="font-medium text-slate-800 hover:underline">
                  ir a Peluqueros
                </Link>
              </li>
            )}
            {servicios.length === 0 && (
              <li>
                · Al menos un servicio activo —{' '}
                <Link href="/servicios" className="font-medium text-slate-800 hover:underline">
                  ir a Servicios
                </Link>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cliente" className={LABEL}>Cliente</label>
              <select
                id="cliente"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className={INPUT}
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.telefono ? ` · ${c.telefono}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="peluquero" className={LABEL}>Peluquero</label>
              <select
                id="peluquero"
                value={peluqueroId}
                onChange={(e) => setPeluqueroId(e.target.value)}
                className={INPUT}
              >
                <option value="">Selecciona un peluquero</option>
                {peluqueros.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fecha" className={LABEL}>Fecha</label>
              <input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="hora" className={LABEL}>Hora de inicio</label>
              <input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <span className={LABEL}>Servicios</span>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200">
              {servicios.map((s) => {
                const elegido = serviciosElegidos.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-gray-50 ${
                      elegido ? 'bg-slate-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={elegido}
                      onChange={() => alternarServicio(s.id)}
                      className="h-4 w-4 accent-slate-900"
                    />
                    <span className="flex-1 font-medium text-gray-800">{s.nombre}</span>
                    <span className="text-xs text-gray-400">{s.duracion_minutos} min</span>
                    <span className="w-20 text-right text-gray-600">{formatearCLP(s.precio_clp)}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {seleccionados.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-xs uppercase tracking-wide text-slate-400">Total</span>
              <span className="text-sm">
                {duracionTotal} min
                {horaFin && <span className="text-slate-400"> · termina {horaFin}</span>}
                <span className="ml-3 font-bold">{formatearCLP(precioTotal)}</span>
              </span>
            </div>
          )}

          <div>
            <label htmlFor="notas" className={LABEL}>Notas (opcional)</label>
            <textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Alergias, preferencias, comentarios..."
              className={INPUT}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={BOTON_CREAR}>
              {guardando ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
