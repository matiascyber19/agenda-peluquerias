'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { DIAS_SEMANA, MAX_FRANJAS_POR_DIA, type Franja, validarFranjas } from '../lib/horarios'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../components/estilos'

interface PeluqueroHorario {
  id: string
  nombre: string
  color_agenda: string | null
  franjas: Franja[]
}

/** Franjas del peluquero en edición, agrupadas por día (0 = domingo … 6 = sábado). */
type Semana = Record<number, { inicio: string; fin: string }[]>

const INPUT_HORA =
  'rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white'

function aSemana(franjas: Franja[]): Semana {
  const semana: Semana = Object.fromEntries(DIAS_SEMANA.map(({ dia }) => [dia, []]))
  for (const f of franjas) semana[f.dia_semana].push({ inicio: f.hora_inicio, fin: f.hora_fin })
  return semana
}

function aFranjas(semana: Semana): Franja[] {
  return DIAS_SEMANA.flatMap(({ dia }) =>
    semana[dia].map((f) => ({ dia_semana: dia, hora_inicio: f.inicio, hora_fin: f.fin }))
  )
}

/** Una hora más tarde, sin pasar de las 23:59. */
function unaHoraDespues(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Horario de atención de cada peluquero, que define cuándo recibe reservas en línea. */
export default function SeccionHorarios() {
  const [peluqueros, setPeluqueros] = useState<PeluqueroHorario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seleccionadoId, setSeleccionadoId] = useState('')
  const [semana, setSemana] = useState<Semana>(() => aSemana([]))
  const [cambiado, setCambiado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // Solo toca el estado cuando llega la respuesta, para poder llamarla desde el
  // efecto de montaje sin provocar renders en cascada.
  const pedirHorarios = useCallback((elegirId?: string) => {
    fetch('/api/horarios')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los horarios')
        return json.peluqueros as PeluqueroHorario[]
      })
      .then((lista) => {
        setPeluqueros(lista)
        const elegido = lista.find((p) => p.id === elegirId) ?? lista[0]
        if (elegido) {
          setSeleccionadoId(elegido.id)
          setSemana(aSemana(elegido.franjas))
          setCambiado(false)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    pedirHorarios()
  }, [pedirHorarios])

  const seleccionado = peluqueros.find((p) => p.id === seleccionadoId)

  function elegir(peluquero: PeluqueroHorario) {
    if (
      cambiado &&
      !window.confirm(`Tienes cambios sin guardar en el horario de ${seleccionado?.nombre}. ¿Descartarlos?`)
    ) {
      return
    }
    setSeleccionadoId(peluquero.id)
    setSemana(aSemana(peluquero.franjas))
    setCambiado(false)
    setMensaje('')
    setError('')
  }

  function editar(cambio: (s: Semana) => Semana) {
    setSemana((actual) => cambio(actual))
    setCambiado(true)
    setMensaje('')
  }

  function agregarFranja(dia: number) {
    editar((s) => {
      const franjas = s[dia]
      const ultima = franjas[franjas.length - 1]
      const nueva = ultima
        ? { inicio: ultima.fin, fin: unaHoraDespues(ultima.fin) }
        : { inicio: '10:00', fin: '19:00' }
      return { ...s, [dia]: [...franjas, nueva] }
    })
  }

  function cambiarHora(dia: number, indice: number, campo: 'inicio' | 'fin', valor: string) {
    editar((s) => ({
      ...s,
      [dia]: s[dia].map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)),
    }))
  }

  function quitarFranja(dia: number, indice: number) {
    editar((s) => ({ ...s, [dia]: s[dia].filter((_, i) => i !== indice) }))
  }

  function copiarLunesALaSemana() {
    editar((s) => {
      const copia = { ...s }
      for (const dia of [2, 3, 4, 5, 6]) copia[dia] = s[1].map((f) => ({ ...f }))
      return copia
    })
  }

  async function guardar(peluqueroIds: string[]) {
    const franjas = aFranjas(semana)
    const errorFranjas = validarFranjas(franjas)
    if (errorFranjas) {
      setError(errorFranjas)
      return
    }

    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const res = await fetch('/api/horarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peluquero_ids: peluqueroIds, franjas }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar el horario')
        return
      }
      setMensaje(
        peluqueroIds.length > 1
          ? `Horario aplicado a ${peluqueroIds.length} peluqueros ✓`
          : 'Horario guardado ✓'
      )
      pedirHorarios(seleccionadoId)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  function copiarATodos() {
    if (
      window.confirm(
        `¿Aplicar este horario a los ${peluqueros.length} peluqueros? Se reemplazan sus horarios actuales.`
      )
    ) {
      guardar(peluqueros.map((p) => p.id))
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-800">Horarios de atención</h2>
      <p className="mt-1 text-sm text-gray-500">
        Cuándo recibe reservas en línea cada peluquero. Sin horario, no recibe reservas.
      </p>

      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando horarios...</p>
      ) : peluqueros.length === 0 ? (
        error ? (
          <p className="py-6 text-center text-sm text-red-500">{error}</p>
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">
            No tienes peluqueros activos.{' '}
            <Link href="/peluqueros" className="font-medium text-slate-700 hover:underline">
              Agrega uno
            </Link>
          </p>
        )
      ) : (
        <>
          {/* Peluquero en edición */}
          <div className="mt-5 flex flex-wrap gap-2">
            {peluqueros.map((peluquero) => (
              <button
                key={peluquero.id}
                type="button"
                onClick={() => elegir(peluquero)}
                aria-pressed={peluquero.id === seleccionadoId}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                  peluquero.id === seleccionadoId
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: peluquero.color_agenda ?? '#64748b' }}
                />
                {peluquero.nombre}
                {peluquero.franjas.length === 0 && <span className="text-xs opacity-70">· sin horario</span>}
              </button>
            ))}
          </div>

          {/* Franjas por día */}
          <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {DIAS_SEMANA.map(({ dia, nombre }) => (
              <div key={dia} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <div className="w-28 shrink-0 text-sm font-medium text-gray-700 sm:pt-1.5">{nombre}</div>
                <div className="flex-1 space-y-2">
                  {semana[dia].length === 0 && <p className="text-sm text-gray-400 sm:pt-1.5">Cerrado</p>}
                  {semana[dia].map((franja, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        step={900}
                        value={franja.inicio}
                        onChange={(e) => cambiarHora(dia, i, 'inicio', e.target.value)}
                        aria-label={`${nombre}: inicio de la franja ${i + 1}`}
                        className={INPUT_HORA}
                      />
                      <span className="text-sm text-gray-400">a</span>
                      <input
                        type="time"
                        step={900}
                        value={franja.fin}
                        onChange={(e) => cambiarHora(dia, i, 'fin', e.target.value)}
                        aria-label={`${nombre}: fin de la franja ${i + 1}`}
                        className={INPUT_HORA}
                      />
                      <button
                        type="button"
                        onClick={() => quitarFranja(dia, i)}
                        aria-label={`${nombre}: quitar la franja ${i + 1}`}
                        className="rounded-lg px-2 text-lg leading-none text-gray-400 transition-colors hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {semana[dia].length < MAX_FRANJAS_POR_DIA && (
                      <button
                        type="button"
                        onClick={() => agregarFranja(dia)}
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                      >
                        + Agregar franja
                      </button>
                    )}
                    {dia === 1 && semana[1].length > 0 && (
                      <button
                        type="button"
                        onClick={copiarLunesALaSemana}
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                      >
                        Copiar a martes–sábado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {mensaje && <span className="text-sm text-green-600">{mensaje}</span>}
            {peluqueros.length > 1 && (
              <button type="button" onClick={copiarATodos} disabled={guardando} className={BOTON_SECUNDARIO}>
                Copiar a todos los peluqueros
              </button>
            )}
            <button
              type="button"
              onClick={() => guardar([seleccionadoId])}
              disabled={guardando || !cambiado}
              className={BOTON_PRIMARIO}
            >
              {guardando ? 'Guardando...' : 'Guardar horario'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
