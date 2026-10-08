'use client'

import { useCallback, useEffect, useState } from 'react'
import { INPUT, LABEL, BOTON_PRIMARIO } from '../components/estilos'

interface Cierre {
  id: string
  desde: string
  hasta: string
  peluquero: { id: string; nombre: string } | null
  motivo: string | null
}

interface PeluqueroOpcion {
  id: string
  nombre: string
  activo: boolean
}

/** AAAA-MM-DD → "mié 24 dic 2026". Se lee al mediodía para que la zona horaria no corra el día. */
function formatearDia(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Feriados, vacaciones o días libres: esos días no se ofrecen horas en la reserva en línea. */
export default function SeccionCierres() {
  const [cierres, setCierres] = useState<Cierre[]>([])
  const [peluqueros, setPeluqueros] = useState<PeluqueroOpcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [peluqueroId, setPeluqueroId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [reabriendoId, setReabriendoId] = useState('')

  // Solo toca el estado cuando llega la respuesta, para poder llamarla desde el
  // efecto de montaje sin provocar renders en cascada.
  const pedirCierres = useCallback(() => {
    Promise.all([
      fetch('/api/bloqueos').then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los días cerrados')
        return json.bloqueos as Cierre[]
      }),
      fetch('/api/peluqueros')
        .then((res) => (res.ok ? res.json() : { peluqueros: [] }))
        .then((json) => (json.peluqueros ?? []) as PeluqueroOpcion[]),
    ])
      .then(([listaCierres, listaPeluqueros]) => {
        setCierres(listaCierres)
        setPeluqueros(listaPeluqueros.filter((p) => p.activo))
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    pedirCierres()
  }, [pedirCierres])

  async function agregar() {
    if (!desde) return setError('Elige desde qué día')
    const fechaHasta = hasta || desde
    if (fechaHasta < desde) return setError('El último día no puede ser anterior al primero')

    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/bloqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desde,
          hasta: fechaHasta,
          peluquero_id: peluqueroId || null,
          motivo: motivo.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar el cierre')
        return
      }
      setDesde('')
      setHasta('')
      setPeluqueroId('')
      setMotivo('')
      pedirCierres()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  async function reabrir(cierre: Cierre) {
    setReabriendoId(cierre.id)
    setError('')
    try {
      const res = await fetch(`/api/bloqueos/${cierre.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos reabrir esos días')
        return
      }
      pedirCierres()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setReabriendoId('')
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-800">Días cerrados</h2>
      <p className="mt-1 text-sm text-gray-500">
        Feriados, vacaciones o días libres de un peluquero. Esos días no se ofrecen horas para reservar.
      </p>

      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          {cierres.length === 0 ? (
            <p className="mt-5 text-sm text-gray-400">No hay días cerrados próximos.</p>
          ) : (
            <ul className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {cierres.map((cierre) => (
                <li key={cierre.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {cierre.desde === cierre.hasta
                        ? formatearDia(cierre.desde)
                        : `${formatearDia(cierre.desde)} – ${formatearDia(cierre.hasta)}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cierre.peluquero ? cierre.peluquero.nombre : 'Toda la peluquería'}
                      {cierre.motivo && ` · ${cierre.motivo}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reabrir(cierre)}
                    disabled={reabriendoId === cierre.id}
                    className="text-sm font-medium text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                  >
                    {reabriendoId === cierre.id ? '...' : 'Reabrir'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              agregar()
            }}
          >
            <div>
              <label htmlFor="cierreDesde" className={LABEL}>Desde</label>
              <input
                id="cierreDesde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="cierreHasta" className={LABEL}>Hasta (opcional si es un solo día)</label>
              <input
                id="cierreHasta"
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="cierreQuien" className={LABEL}>Quién</label>
              <select
                id="cierreQuien"
                value={peluqueroId}
                onChange={(e) => setPeluqueroId(e.target.value)}
                className={INPUT}
              >
                <option value="">Toda la peluquería</option>
                {peluqueros.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cierreMotivo" className={LABEL}>Motivo (opcional)</label>
              <input
                id="cierreMotivo"
                type="text"
                value={motivo}
                maxLength={200}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Feriado, vacaciones..."
                className={INPUT}
              />
            </div>

            {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}

            <div className="flex justify-end sm:col-span-2">
              <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                {guardando ? 'Guardando...' : 'Cerrar esos días'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
