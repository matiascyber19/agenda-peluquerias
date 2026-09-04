'use client'

import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'

interface Cita {
  id: string
  inicio: string
  fin: string | null
  estado: string
  cliente: { nombre: string; telefono: string | null } | null
  peluquero: { id: string; nombre: string; color_agenda: string | null } | null
  servicios: { nombre: string; duracion_minutos: number; precio_clp: number }[]
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HORA_INICIO = 9   // primera hora visible
const HORA_FIN = 20     // última hora visible (exclusiva)
const PX_POR_HORA = 64
const COLOR_POR_DEFECTO = '#64748b'

/** Lunes de la semana a la que pertenece `fecha`, a las 00:00 */
function lunesDe(fecha: Date) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  const diaSemana = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - diaSemana)
  return d
}

function sumarDias(fecha: Date, dias: number) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d
}

function mismoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function rangoSemanaTexto(lunes: Date) {
  const domingo = sumarDias(lunes, 6)
  const mismoMes = lunes.getMonth() === domingo.getMonth()
  const opciones: Intl.DateTimeFormatOptions = mismoMes
    ? { day: 'numeric' }
    : { day: 'numeric', month: 'long' }
  return `Semana del ${lunes.toLocaleDateString('es-CL', opciones)} al ${domingo.toLocaleDateString(
    'es-CL',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )}`
}

function hhmm(fecha: Date) {
  return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AgendaPage() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes])
  const horas = useMemo(
    () => Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i),
    []
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    const desde = new Date(lunes)
    const hasta = sumarDias(lunes, 7)
    const params = new URLSearchParams({
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
    })

    fetch(`/api/citas?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar las citas')
        return json
      })
      .then((json) => setCitas(json.citas ?? []))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setCitas([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [lunes])

  // Leyenda de peluqueros construida desde los datos, no escrita a mano
  const peluqueros = useMemo(() => {
    const mapa = new Map<string, { nombre: string; color: string }>()
    for (const cita of citas) {
      if (cita.peluquero && !mapa.has(cita.peluquero.id)) {
        mapa.set(cita.peluquero.id, {
          nombre: cita.peluquero.nombre,
          color: cita.peluquero.color_agenda ?? COLOR_POR_DEFECTO,
        })
      }
    }
    return [...mapa.values()]
  }, [citas])

  /** Posición vertical y alto de la cita, proporcionales a su duración real */
  function geometria(cita: Cita) {
    const inicio = new Date(cita.inicio)
    const duracionMin = cita.fin
      ? (new Date(cita.fin).getTime() - inicio.getTime()) / 60000
      : cita.servicios.reduce((s, srv) => s + (srv.duracion_minutos || 0), 0) || 30

    const minutosDesdeTope = (inicio.getHours() - HORA_INICIO) * 60 + inicio.getMinutes()
    const top = (minutosDesdeTope / 60) * PX_POR_HORA
    const alto = Math.max((duracionMin / 60) * PX_POR_HORA, 22)
    return { top, alto, inicio, duracionMin }
  }

  const hoy = new Date()
  const altoGrilla = (HORA_FIN - HORA_INICIO) * PX_POR_HORA

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500 text-sm mt-1">{rangoSemanaTexto(lunes)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLunes((l) => sumarDias(l, -7))}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setLunes(lunesDe(new Date()))}
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => setLunes((l) => sumarDias(l, 7))}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Siguiente →
            </button>
            <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
              + Nueva cita
            </button>
          </div>
        </div>

        {/* Leyenda peluqueros */}
        <div className="flex items-center gap-4 mb-4 min-h-6">
          {peluqueros.map((p) => (
            <div key={p.nombre} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-sm text-gray-600">{p.nombre}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {/* Calendario semanal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
              <p className="text-sm text-gray-400">Cargando citas...</p>
            </div>
          )}

          {/* Header días */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="p-4 text-xs text-gray-400 font-medium"></div>
            {dias.map((dia, i) => {
              const esHoy = mismoDia(dia, hoy)
              return (
                <div
                  key={dia.toISOString()}
                  className={`p-4 text-center border-l border-gray-100 ${esHoy ? 'bg-slate-900 text-white' : ''}`}
                >
                  <p className={`text-xs font-medium ${esHoy ? 'text-slate-300' : 'text-gray-400'}`}>
                    {DIAS[i]}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${esHoy ? 'text-white' : 'text-gray-700'}`}>
                    {dia.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Grilla: columna de horas + 7 columnas de días con posicionamiento absoluto */}
          <div className="grid grid-cols-8">
            {/* Columna de horas */}
            <div className="border-r border-gray-100">
              {horas.map((h) => (
                <div
                  key={h}
                  style={{ height: PX_POR_HORA }}
                  className="px-3 pt-1 text-xs text-gray-400 font-mono border-b border-gray-100"
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Un contenedor relativo por día */}
            {dias.map((dia) => {
              const citasDelDia = citas.filter((c) => mismoDia(new Date(c.inicio), dia))
              return (
                <div
                  key={dia.toISOString()}
                  className="relative border-l border-gray-100"
                  style={{ height: altoGrilla }}
                >
                  {/* líneas de hora */}
                  {horas.map((h) => (
                    <div key={h} style={{ height: PX_POR_HORA }} className="border-b border-gray-100" />
                  ))}

                  {citasDelDia.map((cita) => {
                    const { top, alto, inicio, duracionMin } = geometria(cita)
                    if (top < 0 || top >= altoGrilla) return null
                    const color = cita.peluquero?.color_agenda ?? COLOR_POR_DEFECTO
                    const servicios = cita.servicios.map((s) => s.nombre).join(' + ')
                    return (
                      <div
                        key={cita.id}
                        title={`${hhmm(inicio)} · ${cita.cliente?.nombre ?? 'Sin cliente'} · ${servicios || 'Sin servicio'} (${duracionMin} min)`}
                        className={`absolute left-1 right-1 rounded-lg border p-1.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${
                          cita.estado === 'cancelada' || cita.estado === 'no_show' ? 'opacity-50 line-through' : ''
                        }`}
                        style={{
                          top,
                          height: alto,
                          backgroundColor: `${color}22`,
                          borderColor: color,
                        }}
                      >
                        <p className="text-xs font-semibold truncate" style={{ color }}>
                          {cita.cliente?.nombre ?? 'Sin cliente'}
                        </p>
                        {alto > 34 && (
                          <p className="text-xs text-gray-500 truncate">{servicios || 'Sin servicio'}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {!loading && !error && citas.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-4">No hay citas en esta semana</p>
        )}
      </div>
    </div>
  )
}
