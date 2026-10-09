'use client'

import { useState } from 'react'
import { enlaceWhatsApp } from '@/app/lib/reserva'

export interface Propuesta {
  estado: string
  vigente: boolean
  peluqueria: string
  telefono: string | null
  inicio: string
  fin: string
  inicio_solicitado: string | null
  peluquero: string | null
  cliente: string | null
  servicios: { nombre: string; precio_clp: number }[]
  total_clp: number
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** "martes 13 de octubre, 11:00" en hora de Chile. */
function formatearCuando(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** El cliente ve la hora que le propone la peluquería y la acepta o la rechaza. */
export default function RespuestaPropuesta({ token, propuesta }: { token: string; propuesta: Propuesta }) {
  // El resultado de responder en esta visita; si no, el estado guardado.
  const [estado, setEstado] = useState(propuesta.estado)
  const [enviando, setEnviando] = useState<'' | 'aceptar' | 'rechazar'>('')
  const [error, setError] = useState('')

  const cuando = formatearCuando(propuesta.inicio)
  const pendiente = estado === 'propuesta' && propuesta.vigente

  async function responder(acepta: boolean) {
    setEnviando(acepta ? 'aceptar' : 'rechazar')
    setError('')
    try {
      const res = await fetch(`/api/propuesta/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acepta }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos registrar tu respuesta')
        return
      }
      setEstado(json.estado)
    } catch {
      setError('No pudimos conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando('')
    }
  }

  const whatsapp = propuesta.telefono
    ? enlaceWhatsApp(
        propuesta.telefono,
        estado === 'rechazada'
          ? `Hola, soy ${propuesta.cliente ?? ''}. La hora del ${cuando} no me sirve, ¿tienen otra?`
          : `Hola, soy ${propuesta.cliente ?? ''}. Les escribo por mi hora del ${cuando}.`
      )
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
        <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tu hora</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{propuesta.peluqueria}</h1>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {estado === 'confirmada' ? (
            <>
              <p className="text-3xl">✅</p>
              <h2 className="mt-2 text-xl font-bold text-gray-900">¡Listo{propuesta.cliente ? `, ${propuesta.cliente}` : ''}! Tu hora quedó confirmada</h2>
            </>
          ) : estado === 'rechazada' ? (
            <>
              <h2 className="text-xl font-bold text-gray-900">Esta hora ya no está reservada</h2>
              <p className="mt-1 text-sm text-gray-500">
                Si todavía quieres atenderte, escríbele a {propuesta.peluqueria} para buscar otra hora.
              </p>
            </>
          ) : !pendiente ? (
            <h2 className="text-xl font-bold text-gray-900">Esta propuesta ya no está disponible</h2>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">
                Hola{propuesta.cliente ? ` ${propuesta.cliente}` : ''}, te proponemos otra hora
              </h2>
              {propuesta.inicio_solicitado && (
                <p className="mt-1 text-sm text-gray-500">
                  La que pediste ({formatearCuando(propuesta.inicio_solicitado)}) no estaba disponible.
                </p>
              )}
            </>
          )}

          <dl className="mt-5 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Cuándo</dt>
              <dd className="text-right font-semibold text-gray-900 first-letter:uppercase">{cuando}</dd>
            </div>
            {propuesta.peluquero && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Con</dt>
                <dd className="font-medium text-gray-900">{propuesta.peluquero}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Servicios</dt>
              <dd className="text-right font-medium text-gray-900">{propuesta.servicios.map((s) => s.nombre).join(' + ')}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-gray-200 pt-3">
              <dt className="text-gray-500">Total</dt>
              <dd className="font-bold text-gray-900">{formatearCLP(propuesta.total_clp)}</dd>
            </div>
          </dl>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            {pendiente && (
              <>
                <button
                  type="button"
                  onClick={() => responder(true)}
                  disabled={!!enviando}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                >
                  {enviando === 'aceptar' ? 'Confirmando...' : 'Aceptar esta hora'}
                </button>
                <button
                  type="button"
                  onClick={() => responder(false)}
                  disabled={!!enviando}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {enviando === 'rechazar' ? 'Enviando...' : 'No me sirve'}
                </button>
              </>
            )}
            {whatsapp && !pendiente && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Escribir por WhatsApp
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
