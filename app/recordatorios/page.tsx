'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { enlaceWhatsApp } from '../lib/reserva'
import { mensajeRecordatorio } from '../lib/recordatorios'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'

type Dia = 'manana' | 'hoy'

interface CitaPorRecordar {
  id: string
  inicio: string
  hora: string
  cliente: string
  telefono: string | null
  peluquero: string | null
  servicios: string
  enviado: boolean
}

interface Respuesta {
  fecha: string
  peluqueria: { nombre: string; direccion: string | null; comuna: string | null }
  citas: CitaPorRecordar[]
}

const PESTANAS: { dia: Dia; label: string }[] = [
  { dia: 'manana', label: 'Mañana' },
  { dia: 'hoy', label: 'Hoy' },
]

/** "sábado 18 de octubre" de una fecha AAAA-MM-DD. */
function formatearFecha(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`)
    .toLocaleDateString('es-CL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
}

/**
 * Recordatorios por WhatsApp: las citas de mañana (o de hoy) con un botón que
 * abre WhatsApp con el mensaje escrito. Al apretarlo, la cita queda marcada
 * como recordada, para que todo el equipo sepa a quién falta avisarle.
 */
export default function RecordatoriosPage() {
  const [dia, setDia] = useState<Dia>('manana')
  const [datos, setDatos] = useState<{ dia: Dia; respuesta: Respuesta } | null>(null)
  const [error, setError] = useState('')

  // Solo toca el estado cuando llega la respuesta: sirve para la primera carga
  // y para el refresco en silencio.
  const pedir = useCallback(() => {
    fetch(`/api/recordatorios?dia=${dia}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar las citas')
        return json as Respuesta
      })
      .then((respuesta) => {
        setDatos({ dia, respuesta })
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [dia])

  useEffect(() => {
    pedir()
  }, [pedir])

  // Lo que marca otra persona del equipo aparece sin recargar.
  useMantenerActualizado(pedir, 30_000)

  const respuesta = datos?.dia === dia ? datos.respuesta : null

  /** Marca o desmarca el recordatorio; si falla, vuelve atrás y avisa. */
  async function marcar(cita: CitaPorRecordar, enviado: boolean) {
    const cambiar = (valor: boolean) =>
      setDatos((actual) =>
        actual && {
          ...actual,
          respuesta: {
            ...actual.respuesta,
            citas: actual.respuesta.citas.map((c) => (c.id === cita.id ? { ...c, enviado: valor } : c)),
          },
        }
      )
    cambiar(enviado)
    setError('')
    const res = await fetch(`/api/recordatorios/${cita.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enviado }),
    }).catch(() => null)
    if (!res?.ok) {
      cambiar(!enviado)
      const json = await res?.json().catch(() => ({}))
      setError(json?.error ?? 'No pudimos guardar el recordatorio')
    }
  }

  const citas = respuesta?.citas ?? []
  const enviados = citas.filter((c) => c.enviado).length

  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Avísales a tus clientes por WhatsApp un día antes. Así llegan más y te avisan si no pueden venir.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Día" className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {PESTANAS.map((p) => (
              <button
                key={p.dia}
                type="button"
                role="tab"
                aria-selected={dia === p.dia}
                onClick={() => setDia(p.dia)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  dia === p.dia ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {respuesta && citas.length > 0 && (
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{enviados}</span> de {citas.length} avisados ·{' '}
              <span className="first-letter:uppercase">{formatearFecha(respuesta.fecha)}</span>
            </p>
          )}
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-sm">
          {!respuesta ? (
            <p className="py-12 text-center text-sm text-gray-400">{error ? '—' : 'Cargando citas...'}</p>
          ) : citas.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl" aria-hidden>☕</p>
              <p className="mt-2 text-sm text-gray-400">
                No hay citas para {dia === 'hoy' ? 'hoy' : 'mañana'} ({formatearFecha(respuesta.fecha)})
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {citas.map((cita) => {
                const enlace = cita.telefono
                  ? enlaceWhatsApp(
                      cita.telefono,
                      mensajeRecordatorio({
                        cliente: cita.cliente,
                        peluqueria: respuesta.peluqueria.nombre,
                        direccion: respuesta.peluqueria.direccion,
                        comuna: respuesta.peluqueria.comuna,
                        dia,
                        inicio: cita.inicio,
                        hora: cita.hora,
                        peluquero: cita.peluquero,
                        servicios: cita.servicios,
                      })
                    )
                  : null
                return (
                  <li key={cita.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-gray-800">{cita.hora}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{cita.cliente}</p>
                      <p className="truncate text-xs text-gray-500">
                        {cita.telefono ?? 'Sin teléfono'}
                        {cita.peluquero && ` · ${cita.peluquero}`}
                        {cita.servicios && ` · ${cita.servicios}`}
                      </p>
                    </div>
                    {cita.enviado ? (
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Avisado ✓
                        </span>
                        {enlace && (
                          <a
                            href={enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-gray-500 hover:text-gray-800"
                          >
                            Abrir de nuevo
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => marcar(cita, false)}
                          className="text-xs text-gray-400 hover:text-gray-700"
                        >
                          Deshacer
                        </button>
                      </div>
                    ) : enlace ? (
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => marcar(cita, true)}
                        className="shrink-0 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                      >
                        Enviar por WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcar(cita, true)}
                        className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800"
                      >
                        Marcar como avisado
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-gray-400">
          El mensaje se abre en WhatsApp ya escrito: revísalo y aprieta enviar. La cita queda marcada como avisada para
          todo el equipo.
        </p>
      </div>
    </div>
  )
}
