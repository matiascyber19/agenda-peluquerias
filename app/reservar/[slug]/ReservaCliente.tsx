'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { INPUT, LABEL } from '@/app/components/estilos'
import {
  enlaceWhatsApp,
  type HoraLibre,
  type PeluqueriaPublica,
  REGLAS_POR_DEFECTO,
  type ResumenReserva,
} from '@/app/lib/reserva'
import { useMantenerActualizado } from '@/app/lib/useMantenerActualizado'

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/** Fecha AAAA-MM-DD del calendario local. */
function fechaLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "lunes 12 de octubre". Se lee al mediodía para que la zona horaria no corra el día. */
function formatearDiaLargo(fecha: string) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Consulta de horas libres para un día, unos servicios y (opcional) un peluquero. */
function urlHoras(slug: string, fecha: string, servicios: string[], peluqueroId: string) {
  const params = new URLSearchParams({ fecha, servicios: servicios.join(',') })
  if (peluqueroId) params.set('peluquero', peluqueroId)
  return `/api/reservar/${slug}/disponibilidad?${params.toString()}`
}

// "Hoy" no cambia mientras la página está abierta: no hace falta suscribirse.
const sinSuscripcion = () => () => {}

const TITULO_PASO = 'mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500'
const OPCION = 'rounded-xl border px-3 py-2 text-sm transition-colors'
const OPCION_ACTIVA = 'border-slate-900 bg-slate-900 text-white'
const OPCION_INACTIVA = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'

interface Props {
  slug: string
  peluqueria: PeluqueriaPublica
}

export default function ReservaCliente({ slug, peluqueria }: Props) {
  // "Hoy" solo se conoce en el navegador: el servidor renderiza sin días y
  // React los completa al hidratar, sin desajustes.
  const hoy = useSyncExternalStore(sinSuscripcion, () => fechaLocal(new Date()), () => '')
  const reglas = peluqueria.reglas ?? REGLAS_POR_DEFECTO
  // Se ofrecen hoy y los días que permita la peluquería en sus reglas.
  const cantidadDias = reglas.dias_max + 1
  const dias = useMemo(() => {
    if (!hoy) return []
    const base = new Date(`${hoy}T12:00:00`)
    return Array.from({ length: cantidadDias }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      return fechaLocal(d)
    })
  }, [hoy, cantidadDias])

  const router = useRouter()
  const [elegidosGuardados, setElegidos] = useState<string[]>([])
  const [peluqueroGuardado, setPeluqueroId] = useState('')
  // La página se actualiza sola (más abajo): si la peluquería quita un servicio
  // o un peluquero con la página abierta, lo elegido que ya no existe no cuenta.
  // Depende de los ids como texto: al refrescar llegan objetos nuevos con los
  // mismos servicios, y eso no debe volver a pedir las horas.
  const idsServicios = peluqueria.servicios.map((s) => s.id).join(',')
  const elegidos = useMemo(() => {
    const vigentes = new Set(idsServicios.split(','))
    return elegidosGuardados.filter((id) => vigentes.has(id))
  }, [elegidosGuardados, idsServicios])
  const peluqueroId = peluqueria.peluqueros.some((p) => p.id === peluqueroGuardado) ? peluqueroGuardado : ''
  const [fecha, setFecha] = useState('')
  const [horaElegida, setHoraElegida] = useState<HoraLibre | null>(null)
  const [recarga, setRecarga] = useState(0)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<ResumenReserva | null>(null)

  const seleccionados = peluqueria.servicios.filter((s) => elegidos.includes(s.id))
  const duracion = seleccionados.reduce((t, s) => t + s.duracion_minutos, 0)
  const total = seleccionados.reduce((t, s) => t + s.precio_clp, 0)

  // Las horas se piden de nuevo cuando cambia el día, los servicios o el
  // peluquero. La respuesta recuerda qué consulta pidió: mientras no coincida
  // con la actual, las horas están cargando.
  const consulta =
    fecha && elegidos.length > 0 ? `${fecha}|${[...elegidos].sort().join(',')}|${peluqueroId}|${recarga}` : ''
  const [respuesta, setRespuesta] = useState<{ consulta: string; horas: HoraLibre[]; error: string }>({
    consulta: '',
    horas: [],
    error: '',
  })
  const cargandoHoras = consulta !== '' && respuesta.consulta !== consulta
  const horas = respuesta.consulta === consulta ? respuesta.horas : []
  const errorHoras = respuesta.consulta === consulta ? respuesta.error : ''

  useEffect(() => {
    if (!consulta) return
    const controller = new AbortController()

    fetch(urlHoras(slug, fecha, elegidos, peluqueroId), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar las horas')
        return (json.horas ?? []) as HoraLibre[]
      })
      .then((lista) => setRespuesta({ consulta, horas: lista, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRespuesta({ consulta, horas: [], error: err.message })
      })

    return () => controller.abort()
  }, [consulta, fecha, elegidos, peluqueroId, slug])

  // Si la peluquería cambia sus servicios, peluqueros, horarios o WhatsApp con
  // la página abierta, se ve al volver a la pestaña o al minuto, sin recargar.
  // Las horas se vuelven a pedir en silencio, sin pasar por "Cargando horas...",
  // y si la hora elegida ya se tomó, se suelta.
  function refrescar() {
    if (resumen) return
    router.refresh()
    if (!consulta) return
    const consultaActual = consulta
    fetch(urlHoras(slug, fecha, elegidos, peluqueroId))
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return
        const lista = (json.horas ?? []) as HoraLibre[]
        setRespuesta((previa) =>
          previa.consulta === consultaActual ? { consulta: consultaActual, horas: lista, error: '' } : previa
        )
        if (horaElegida && !lista.some((h) => h.inicio === horaElegida.inicio)) {
          setHoraElegida(null)
          setError('La hora que elegiste ya no está disponible. Elige otra.')
        }
      })
      .catch(() => {})
  }
  useMantenerActualizado(refrescar, 60_000)

  function alternarServicio(id: string) {
    setElegidos((previos) => (previos.includes(id) ? previos.filter((s) => s !== id) : [...previos, id]))
    setHoraElegida(null)
    setError('')
  }

  function elegirPeluquero(id: string) {
    setPeluqueroId(id)
    setHoraElegida(null)
    setError('')
  }

  function elegirDia(dia: string) {
    setFecha(dia)
    setHoraElegida(null)
    setError('')
  }

  async function reservar() {
    if (elegidos.length === 0) return setError('Elige al menos un servicio')
    if (!horaElegida) return setError('Elige el día y la hora')
    if (nombre.trim().length < 2) return setError('Escribe tu nombre')
    if (telefono.replace(/\D/g, '').length < 8) return setError('Escribe un teléfono de al menos 8 dígitos')

    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/reservar/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio_ids: elegidos,
          peluquero_id: peluqueroId || null,
          inicio: horaElegida.inicio,
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim() || null,
          notas: notas.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos enviar la reserva')
        // Otra persona tomó la hora mientras se elegía: se vuelven a pedir las horas.
        if (res.status === 409) {
          setHoraElegida(null)
          setRecarga((n) => n + 1)
        }
        return
      }
      setResumen(json.reserva as ResumenReserva)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('No pudimos conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  function otraReserva() {
    setResumen(null)
    setElegidos([])
    setPeluqueroId('')
    setFecha('')
    setHoraElegida(null)
    setNotas('')
    setError('')
  }

  const ubicacion = [peluqueria.direccion, peluqueria.comuna].filter(Boolean).join(', ')
  const sinPeluqueros = peluqueria.peluqueros.length === 0
  const sinServicios = peluqueria.servicios.length === 0

  return (
    <div className="min-h-screen fondo-panel">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
        {/* Encabezado de la peluquería */}
        <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reserva tu hora</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{peluqueria.nombre}</h1>
          {ubicacion && <p className="mt-1 text-sm text-gray-500">{ubicacion}</p>}
          {peluqueria.telefono && (
            <a
              href={enlaceWhatsApp(peluqueria.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-green-600 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              Escríbenos por WhatsApp
            </a>
          )}
        </header>

        {resumen ? (
          /* Confirmación */
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-3xl">✅</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              {resumen.estado === 'confirmada' ? '¡Hora confirmada' : '¡Solicitud enviada'}, {nombre.trim().split(' ')[0]}!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {resumen.estado === 'confirmada'
                ? `Te esperamos en ${peluqueria.nombre}.`
                : `${peluqueria.nombre} revisará tu solicitud y te confirmará la hora.`}
            </p>

            <dl className="mt-5 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Cuándo</dt>
                <dd className="text-right font-medium text-gray-900 first-letter:uppercase">
                  {formatearDiaLargo(fecha)}, {horaElegida?.hora}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Con</dt>
                <dd className="font-medium text-gray-900">{resumen.peluquero}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Servicios</dt>
                <dd className="text-right font-medium text-gray-900">
                  {resumen.servicios.map((s) => s.nombre).join(' + ')}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-gray-200 pt-3">
                <dt className="text-gray-500">Total</dt>
                <dd className="font-bold text-gray-900">{formatearCLP(resumen.total_clp)}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-3">
              {peluqueria.telefono && (
                <a
                  href={enlaceWhatsApp(
                    peluqueria.telefono,
                    `Hola, soy ${nombre.trim()}. Acabo de ${resumen.estado === 'confirmada' ? 'reservar' : 'pedir'} una hora para el ${formatearDiaLargo(fecha)} a las ${horaElegida?.hora}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  Avisar por WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={otraReserva}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Hacer otra reserva
              </button>
            </div>
          </section>
        ) : !reglas.activa || sinServicios || sinPeluqueros ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            Por ahora no es posible reservar en línea en {peluqueria.nombre}.
            {peluqueria.telefono && ' Escríbenos por WhatsApp para agendar tu hora.'}
          </section>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              reservar()
            }}
          >
            {/* 1. Servicios */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className={TITULO_PASO}>1. ¿Qué te quieres hacer?</h2>
              <div className="space-y-2">
                {peluqueria.servicios.map((servicio) => {
                  const elegido = elegidos.includes(servicio.id)
                  return (
                    <button
                      key={servicio.id}
                      type="button"
                      onClick={() => alternarServicio(servicio.id)}
                      aria-pressed={elegido}
                      className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                        elegido ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          {elegido ? '✓ ' : ''}
                          {servicio.nombre}
                        </span>
                        {servicio.descripcion && (
                          <span className="mt-0.5 block text-xs text-gray-500">{servicio.descripcion}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium text-gray-900">{formatearCLP(servicio.precio_clp)}</span>
                        <span className="block text-xs text-gray-400">{servicio.duracion_minutos} min</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 2. Peluquero */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className={TITULO_PASO}>2. ¿Con quién?</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => elegirPeluquero('')}
                  aria-pressed={peluqueroId === ''}
                  className={`${OPCION} ${peluqueroId === '' ? OPCION_ACTIVA : OPCION_INACTIVA}`}
                >
                  Sin preferencia
                </button>
                {peluqueria.peluqueros.map((peluquero) => (
                  <button
                    key={peluquero.id}
                    type="button"
                    onClick={() => elegirPeluquero(peluquero.id)}
                    aria-pressed={peluqueroId === peluquero.id}
                    className={`${OPCION} ${peluqueroId === peluquero.id ? OPCION_ACTIVA : OPCION_INACTIVA}`}
                  >
                    {peluquero.nombre}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Día y hora */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className={TITULO_PASO}>3. ¿Cuándo?</h2>
              {elegidos.length === 0 ? (
                <p className="text-sm text-gray-400">Primero elige un servicio.</p>
              ) : (
                <>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                    {dias.map((dia) => {
                      const d = new Date(`${dia}T12:00:00`)
                      const activo = dia === fecha
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => elegirDia(dia)}
                          aria-pressed={activo}
                          aria-label={formatearDiaLargo(dia)}
                          className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors ${
                            activo ? OPCION_ACTIVA : OPCION_INACTIVA
                          }`}
                        >
                          <span className="text-xs capitalize opacity-70">
                            {d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className="text-lg font-bold">{d.getDate()}</span>
                          <span className="text-xs opacity-70">
                            {d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {fecha && (
                    <div className="mt-3">
                      <p className="mb-2 text-sm text-gray-500 first-letter:uppercase">
                        {formatearDiaLargo(fecha)} · {duracion} min
                      </p>
                      {cargandoHoras ? (
                        <p className="py-4 text-center text-sm text-gray-400">Buscando horas libres...</p>
                      ) : errorHoras ? (
                        <p className="py-4 text-center text-sm text-red-500">{errorHoras}</p>
                      ) : horas.length === 0 ? (
                        <p className="py-4 text-center text-sm text-gray-400">
                          No quedan horas este día. Prueba con otro.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                          {horas.map((h) => {
                            const activa = horaElegida?.inicio === h.inicio
                            return (
                              <button
                                key={h.inicio}
                                type="button"
                                onClick={() => {
                                  setHoraElegida(h)
                                  setError('')
                                }}
                                aria-pressed={activa}
                                className={`${OPCION} ${activa ? OPCION_ACTIVA : OPCION_INACTIVA}`}
                              >
                                {h.hora}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 4. Datos */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className={TITULO_PASO}>4. Tus datos</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="nombre" className={LABEL}>Nombre</label>
                  <input
                    id="nombre"
                    type="text"
                    autoComplete="name"
                    value={nombre}
                    maxLength={120}
                    onChange={(e) => setNombre(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="telefono" className={LABEL}>Teléfono (WhatsApp)</label>
                  <input
                    id="telefono"
                    type="tel"
                    autoComplete="tel"
                    value={telefono}
                    maxLength={20}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={LABEL}>Correo (opcional)</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    maxLength={120}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="notas" className={LABEL}>Comentarios (opcional)</label>
                  <textarea
                    id="notas"
                    rows={2}
                    value={notas}
                    maxLength={500}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Por ejemplo, el largo que quieres"
                    className={INPUT}
                  />
                </div>
              </div>
            </section>

            {/* Resumen y envío */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              {seleccionados.length > 0 && (
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {seleccionados.length} {seleccionados.length === 1 ? 'servicio' : 'servicios'} · {duracion} min
                    {horaElegida && fecha && (
                      <span className="block first-letter:uppercase">
                        {formatearDiaLargo(fecha)}, {horaElegida.hora}
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-bold text-gray-900">{formatearCLP(total)}</span>
                </div>
              )}
              {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : reglas.confirmacion_automatica ? 'Reservar' : 'Solicitar reserva'}
              </button>
              <p className="mt-3 text-center text-xs text-gray-400">
                {reglas.confirmacion_automatica
                  ? 'Tu hora queda confirmada al instante.'
                  : 'La peluquería confirmará tu hora.'}{' '}
                No necesitas crear una cuenta.
              </p>
            </section>
          </form>
        )}
      </div>
    </div>
  )
}
