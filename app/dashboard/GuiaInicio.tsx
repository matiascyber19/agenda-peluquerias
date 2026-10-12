'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'

type Paso = 'servicios' | 'peluqueros' | 'horarios' | 'whatsapp' | 'primeraReserva'

interface Guia {
  pasos: Record<Paso, boolean>
  slug: string
  reservaActiva: boolean
}

const PASOS: { clave: Paso; titulo: string; texto: string; href?: string; accion?: string }[] = [
  {
    clave: 'servicios',
    titulo: 'Agrega tus servicios',
    texto: 'Lo que ofreces, con su precio y duración.',
    href: '/servicios',
    accion: 'Agregar servicios',
  },
  {
    clave: 'peluqueros',
    titulo: 'Suma a tu equipo',
    texto: 'Invita a tus peluqueros con un enlace. Si tú también atiendes, agrégate.',
    href: '/peluqueros',
    accion: 'Ir a Peluqueros',
  },
  {
    clave: 'horarios',
    titulo: 'Define los horarios de atención',
    texto: 'Sin horarios, tu página de reservas no muestra horas disponibles.',
    href: '/configuracion#horarios',
    accion: 'Definir horarios',
  },
  {
    clave: 'whatsapp',
    titulo: 'Agrega el WhatsApp de la peluquería',
    texto: 'Para que tus clientes te escriban después de reservar.',
    href: '/configuracion#contacto',
    accion: 'Agregar WhatsApp',
  },
  {
    clave: 'primeraReserva',
    titulo: 'Comparte tu enlace de reservas',
    texto: 'En tu Instagram, WhatsApp o Google. Este paso se completa con tu primera reserva en línea.',
  },
]

// Ocultarla es una preferencia de este navegador: si falla el almacenamiento,
// la guía simplemente se sigue mostrando.
const claveOculta = (slug: string) => `guia-inicio-oculta:${slug}`

/**
 * Pasos para dejar lista una peluquería nueva. Se ve en el dashboard del
 * dueño hasta completarlos (cada paso se deduce de los datos) o hasta que la
 * oculte. Se revisa de nuevo al volver a la pestaña.
 */
export default function GuiaInicio() {
  const [guia, setGuia] = useState<Guia | null>(null)
  const [oculta, setOculta] = useState(false)
  const [enlace, setEnlace] = useState('')
  const [copiado, setCopiado] = useState(false)

  // Solo toca el estado cuando llega la respuesta: sirve para la primera carga
  // y para el refresco en silencio.
  const pedirGuia = useCallback(() => {
    fetch('/api/guia')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: Guia | null) => {
        if (!json) return
        setGuia(json)
        setEnlace(`${window.location.origin}/reservar/${json.slug}`)
        try {
          setOculta(localStorage.getItem(claveOculta(json.slug)) === '1')
        } catch {}
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    pedirGuia()
  }, [pedirGuia])

  // Quien vuelve de configurar algo en otra pestaña ve el paso marcado.
  useMantenerActualizado(pedirGuia, 60_000)

  function ocultar() {
    setOculta(true)
    try {
      if (guia) localStorage.setItem(claveOculta(guia.slug), '1')
    } catch {}
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  if (!guia || oculta) return null
  const listos = PASOS.filter((p) => guia.pasos[p.clave]).length
  if (listos === PASOS.length) return null
  const siguiente = PASOS.findIndex((p) => !guia.pasos[p.clave])

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Guía para empezar</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Deja lista tu peluquería para recibir reservas</h2>
        </div>
        <button type="button" onClick={ocultar} className="shrink-0 text-sm text-gray-400 hover:text-gray-600">
          Ocultar
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={PASOS.length}
          aria-valuenow={listos}
          aria-label="Pasos listos"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
            style={{ width: `${(listos / PASOS.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-gray-600">
          {listos} de {PASOS.length}
        </span>
      </div>

      <ol className="mt-5 space-y-2">
        {PASOS.map((paso, i) => {
          const hecho = guia.pasos[paso.clave]
          const esSiguiente = i === siguiente
          // Con la reserva en línea apagada, compartir el enlace no sirve: primero hay que activarla.
          const reservaApagada = paso.clave === 'primeraReserva' && !guia.reservaActiva
          return (
            <li
              key={paso.clave}
              className={`flex flex-wrap items-start gap-3 rounded-xl p-3 sm:flex-nowrap ${
                esSiguiente ? 'bg-amber-50 ring-1 ring-amber-200' : ''
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  hecho ? 'bg-emerald-500 text-white' : esSiguiente ? 'bg-amber-400 text-slate-950' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {hecho ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${hecho ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {paso.titulo}
                  <span className="sr-only">{hecho ? ' (listo)' : ' (pendiente)'}</span>
                </p>
                {!hecho && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {reservaApagada
                      ? 'La reserva en línea está desactivada. Actívala en Configuración para empezar a recibir reservas.'
                      : paso.texto}
                  </p>
                )}
                {!hecho && paso.clave === 'primeraReserva' && !reservaApagada && enlace && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="max-w-full truncate rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700">{enlace}</span>
                    <button
                      type="button"
                      onClick={copiar}
                      className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                    >
                      {copiado ? 'Copiado ✓' : 'Copiar enlace'}
                    </button>
                    <a
                      href={enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Ver mi página
                    </a>
                  </div>
                )}
              </div>
              {!hecho && (paso.href || reservaApagada) && (
                <Link
                  href={(reservaApagada ? '/configuracion#reglas' : paso.href) ?? '/configuracion'}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    esSiguiente
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'text-amber-700 hover:text-amber-800'
                  }`}
                >
                  {reservaApagada ? 'Activar' : paso.accion} →
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
