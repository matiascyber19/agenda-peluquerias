'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INPUT, LABEL, BOTON_CREAR, BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../components/estilos'
import { inicioDelDiaEnChile } from '../lib/fechas'
import { enlaceWhatsApp } from '../lib/reserva'

export interface Solicitud {
  id: string
  inicio: string
  fin: string | null
  notas: string | null
  creado_en: string | null
  cliente: { id: string; nombre: string; telefono: string | null } | null
  peluquero: { id: string; nombre: string; color_agenda: string | null } | null
  servicios: { nombre: string; duracion_minutos: number; precio_clp: number }[]
}

export interface Respondida {
  solicitud: Solicitud
  resultado: 'aceptada' | 'cambiada' | 'rechazada'
  inicio: string
  peluquero: string
}

const ZONA = 'America/Santiago'

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** "lunes, 12 de octubre, 11:00" en hora de Chile. */
export function formatearCuando(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Fecha (AAAA-MM-DD) y hora (HH:MM) de ese instante en Chile, para los campos del formulario. */
function partesEnChile(iso: string) {
  const [fecha, hora] = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .split(' ')
  return { fecha, hora }
}

function haceCuanto(iso: string | null, ahora: number) {
  if (!iso || !ahora) return ''
  const minutos = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000))
  if (minutos < 60) return `hace ${minutos} min`
  if (minutos < 24 * 60) return `hace ${Math.round(minutos / 60)} h`
  const dias = Math.round(minutos / (24 * 60))
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

interface Props {
  solicitud: Solicitud
  peluqueros: { id: string; nombre: string }[]
  /** Momento de la última consulta, para el "pedida hace…" (Date.now() no se lee al renderizar). */
  consultadoEn: number
  onRespondida: (respondida: Respondida) => void
}

/** Una reserva en línea esperando respuesta: aceptar, cambiar la hora o rechazar. */
export default function TarjetaSolicitud({ solicitud, peluqueros, consultadoEn, onRespondida }: Props) {
  const original = partesEnChile(solicitud.inicio)
  const [cambiando, setCambiando] = useState(false)
  const [fecha, setFecha] = useState(original.fecha)
  const [hora, setHora] = useState(original.hora)
  const [peluqueroId, setPeluqueroId] = useState(solicitud.peluquero?.id ?? '')
  const [enviando, setEnviando] = useState<'' | 'aceptar' | 'rechazar' | 'cambiar'>('')
  const [error, setError] = useState('')

  const duracion = solicitud.servicios.reduce((t, s) => t + s.duracion_minutos, 0)
  const total = solicitud.servicios.reduce((t, s) => t + s.precio_clp, 0)
  const nombreCliente = solicitud.cliente?.nombre ?? 'Cliente'

  async function responder(
    accion: 'aceptar' | 'rechazar' | 'cambiar',
    cuerpo: Record<string, string>,
    resultado: Respondida['resultado'],
    peluquero: string
  ) {
    setEnviando(accion)
    setError('')
    try {
      const res = await fetch(`/api/citas/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos responder la solicitud')
        return
      }
      onRespondida({ solicitud, resultado, inicio: json.cita?.inicio ?? cuerpo.inicio ?? solicitud.inicio, peluquero })
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setEnviando('')
    }
  }

  function aceptar() {
    responder('aceptar', { estado: 'confirmada' }, 'aceptada', solicitud.peluquero?.nombre ?? '')
  }

  function rechazar() {
    if (!window.confirm(`¿Rechazar la solicitud de ${nombreCliente}? La hora queda libre para otros clientes.`)) return
    responder('rechazar', { estado: 'rechazada' }, 'rechazada', solicitud.peluquero?.nombre ?? '')
  }

  function aceptarConCambio() {
    if (!fecha || !/^\d{2}:\d{2}$/.test(hora)) return setError('Elige el día y la hora')
    if (!peluqueroId) return setError('Elige un peluquero')
    const [h, m] = hora.split(':').map(Number)
    const inicio = new Date(inicioDelDiaEnChile(fecha).getTime() + (h * 60 + m) * 60_000).toISOString()

    const cuerpo: Record<string, string> = { estado: 'confirmada', inicio }
    if (peluqueroId !== solicitud.peluquero?.id) cuerpo.peluquero_id = peluqueroId
    const peluquero = peluqueros.find((p) => p.id === peluqueroId)?.nombre ?? solicitud.peluquero?.nombre ?? ''
    responder('cambiar', cuerpo, 'cambiada', peluquero)
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 first-letter:uppercase">{formatearCuando(solicitud.inicio)}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {duracion} min · {formatearCLP(total)}
          </p>
        </div>
        <span className="text-xs text-gray-400">Pedida {haceCuanto(solicitud.creado_en, consultadoEn)}</span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-400">Cliente</dt>
          <dd className="font-medium text-gray-800">
            {solicitud.cliente ? (
              <Link href={`/clientes/${solicitud.cliente.id}`} className="hover:underline">
                {nombreCliente}
              </Link>
            ) : (
              nombreCliente
            )}
            {solicitud.cliente?.telefono && <span className="font-normal text-gray-500"> · {solicitud.cliente.telefono}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Peluquero</dt>
          <dd className="flex items-center gap-2 font-medium text-gray-800">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: solicitud.peluquero?.color_agenda ?? '#64748b' }}
            />
            {solicitud.peluquero?.nombre ?? 'Sin asignar'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-400">Servicios</dt>
          <dd className="text-gray-800">{solicitud.servicios.map((s) => s.nombre).join(' + ')}</dd>
        </div>
        {solicitud.notas && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-400">Comentarios del cliente</dt>
            <dd className="whitespace-pre-wrap text-gray-800">{solicitud.notas}</dd>
          </div>
        )}
      </dl>

      {cambiando && (
        <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`fecha-${solicitud.id}`} className={LABEL}>Día</label>
            <input
              id={`fecha-${solicitud.id}`}
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor={`hora-${solicitud.id}`} className={LABEL}>Hora</label>
            <input
              id={`hora-${solicitud.id}`}
              type="time"
              step={900}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor={`peluquero-${solicitud.id}`} className={LABEL}>Peluquero</label>
            <select
              id={`peluquero-${solicitud.id}`}
              value={peluqueroId}
              onChange={(e) => setPeluqueroId(e.target.value)}
              className={INPUT}
            >
              {peluqueros.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        {cambiando ? (
          <>
            <button type="button" onClick={aceptarConCambio} disabled={!!enviando} className={BOTON_CREAR}>
              {enviando === 'cambiar' ? 'Guardando...' : 'Aceptar con este cambio'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCambiando(false)
                setError('')
              }}
              disabled={!!enviando}
              className={BOTON_SECUNDARIO}
            >
              Volver
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={aceptar} disabled={!!enviando} className={BOTON_CREAR}>
              {enviando === 'aceptar' ? 'Aceptando...' : 'Aceptar'}
            </button>
            <button type="button" onClick={() => setCambiando(true)} disabled={!!enviando} className={BOTON_SECUNDARIO}>
              Cambiar hora
            </button>
            <button
              type="button"
              onClick={rechazar}
              disabled={!!enviando}
              className="ml-auto text-sm font-medium text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
            >
              {enviando === 'rechazar' ? 'Rechazando...' : 'Rechazar'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

/** Solicitud ya respondida: ofrece avisar al cliente por WhatsApp con el mensaje escrito. */
export function TarjetaRespondida({
  respondida,
  peluqueria,
  onListo,
}: {
  respondida: Respondida
  peluqueria: string
  onListo: () => void
}) {
  const { solicitud, resultado, inicio, peluquero } = respondida
  const nombre = solicitud.cliente?.nombre?.split(' ')[0] ?? ''
  const cuando = formatearCuando(inicio)
  const en = peluqueria ? ` en ${peluqueria}` : ''

  const mensaje =
    resultado === 'rechazada'
      ? `Hola ${nombre}, lamentablemente no podemos atenderte el ${formatearCuando(solicitud.inicio)}${en}. ¿Te acomoda otro horario?`
      : resultado === 'cambiada'
        ? `Hola ${nombre}, no teníamos disponible la hora que pediste, así que te agendamos el ${cuando} con ${peluquero}${en}. Si no te acomoda, avísanos.`
        : `Hola ${nombre}, te confirmamos tu hora${en}: ${cuando} con ${peluquero}. ¡Te esperamos!`

  const titulo =
    resultado === 'rechazada'
      ? `Rechazaste la solicitud de ${solicitud.cliente?.nombre ?? 'el cliente'}`
      : `Agendada: ${solicitud.cliente?.nombre ?? 'cliente'}, ${cuando} con ${peluquero}`

  return (
    <article
      className={`rounded-2xl border p-5 shadow-sm ${
        resultado === 'rechazada' ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'
      }`}
    >
      <p className="text-sm font-semibold text-gray-900">
        {resultado === 'rechazada' ? '✕ ' : '✓ '}
        {titulo}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {resultado === 'rechazada'
          ? 'La hora quedó libre. Avísale al cliente para que elija otra.'
          : 'Ya está en la agenda. Avísale al cliente que quedó confirmada.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {solicitud.cliente?.telefono ? (
          <a
            href={enlaceWhatsApp(solicitud.cliente.telefono, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON_CREAR}
          >
            Avisar por WhatsApp
          </a>
        ) : (
          <span className="text-sm text-gray-400">El cliente no dejó teléfono.</span>
        )}
        <button type="button" onClick={onListo} className={BOTON_PRIMARIO}>
          Listo
        </button>
      </div>
    </article>
  )
}
