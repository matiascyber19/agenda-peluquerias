'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import ModalCliente, { type ClienteEditable } from '../../components/ModalCliente'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../../components/estilos'

interface Ficha {
  cliente: ClienteEditable & {
    bloqueado: boolean
    creado_en: string
  }
  historial: {
    citas: {
      id: string
      inicio: string
      estado: string
      notas: string | null
      peluqueros: unknown
      cita_servicios: {
        precio_congelado_clp: number
        duracion_congelada_min: number
        servicios: unknown
      }[] | null
    }[]
    ventas: {
      id: string
      total_clp: number
      medio_pago: string
      fecha: string
      peluqueros: unknown
      venta_items: { id: string; nombre: string; cantidad: number; subtotal_clp: number }[] | null
    }[]
  }
  estadisticas: {
    totalCitas: number
    completadas: number
    canceladas: number
    noShows: number
    gastoTotal: number
    promedioGasto: number
    ultimaVisita: string | null
  }
}

// Supabase entrega las relaciones embebidas como objeto o como arreglo de uno.
function uno<T>(relacion: unknown): T | null {
  if (Array.isArray(relacion)) return (relacion[0] as T) ?? null
  return (relacion as T) ?? null
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  })
}

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  })
}

function formatearFecha(iso: string | null) {
  if (!iso) return 'Sin visitas'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  })
}

const COLOR_ESTADO: Record<string, string> = {
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-500',
}

export default function FichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [bloqueando, setBloqueando] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')

    fetch(`/api/clientes/${id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar la ficha')
        return json as Ficha
      })
      .then(setFicha)
      .catch((err) => {
        setError(err.message)
        setFicha(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function alternarBloqueo() {
    if (!ficha) return
    const bloqueado = ficha.cliente.bloqueado

    setBloqueando(true)
    try {
      // DELETE bloquea; para desbloquear se usa PATCH con bloqueado: false.
      const res = bloqueado
        ? await fetch(`/api/clientes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bloqueado: false }),
          })
        : await fetch(`/api/clientes/${id}`, { method: 'DELETE' })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cambiar el estado del cliente')
        return
      }
      cargar()
    } finally {
      setBloqueando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <p className="py-20 text-center text-sm text-gray-400">Cargando ficha...</p>
      </div>
    )
  }

  if (error || !ficha) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-sm text-red-500">{error || 'Cliente no encontrado'}</p>
          <button onClick={() => router.push('/clientes')} className={`${BOTON_SECUNDARIO} mt-4`}>
            ← Volver a clientes
          </button>
        </div>
      </div>
    )
  }

  const { cliente, historial, estadisticas } = ficha

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/clientes" className="text-sm text-gray-500 transition-colors hover:text-gray-900">
          ← Clientes
        </Link>

        {/* Encabezado */}
        <div className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-600">
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {cliente.telefono ?? 'Sin teléfono'}
                {cliente.email && ` · ${cliente.email}`}
              </p>
              {cliente.bloqueado && (
                <span className="mt-2 inline-block rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                  Bloqueado
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setModalAbierto(true)} className={BOTON_PRIMARIO}>
              Editar
            </button>
            <button onClick={alternarBloqueo} disabled={bloqueando} className={BOTON_SECUNDARIO}>
              {bloqueando ? '...' : cliente.bloqueado ? 'Desbloquear' : 'Bloquear'}
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Citas totales', valor: String(estadisticas.totalCitas), extra: `${estadisticas.completadas} completadas` },
            { label: 'No-shows', valor: String(estadisticas.noShows), extra: `${estadisticas.canceladas} canceladas`, rojo: estadisticas.noShows > 0 },
            { label: 'Gasto total', valor: formatearCLP(estadisticas.gastoTotal), extra: `promedio ${formatearCLP(estadisticas.promedioGasto)}` },
            { label: 'Última visita', valor: formatearFecha(estadisticas.ultimaVisita), pequeno: true },
          ].map((tarjeta) => (
            <div key={tarjeta.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{tarjeta.label}</p>
              <p
                className={`mt-1 font-bold text-gray-900 ${tarjeta.pequeno ? 'text-lg' : 'text-2xl'} ${
                  tarjeta.rojo ? 'text-red-500' : ''
                }`}
              >
                {tarjeta.valor}
              </p>
              {tarjeta.extra && <p className="mt-1 text-xs text-gray-400">{tarjeta.extra}</p>}
            </div>
          ))}
        </div>

        {/* Datos extra */}
        {(cliente.como_llego || cliente.notas || cliente.cumpleanos) && (
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Datos</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              {cliente.cumpleanos && (
                <div>
                  <dt className="text-gray-400">Cumpleaños</dt>
                  <dd className="mt-0.5 text-gray-800">{formatearFecha(cliente.cumpleanos)}</dd>
                </div>
              )}
              {cliente.como_llego && (
                <div>
                  <dt className="text-gray-400">Cómo llegó</dt>
                  <dd className="mt-0.5 text-gray-800">{cliente.como_llego}</dd>
                </div>
              )}
              {cliente.notas && (
                <div className="sm:col-span-3">
                  <dt className="text-gray-400">Notas</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{cliente.notas}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Historial de citas */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Últimas citas</h2>
            {historial.citas.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sin citas registradas</p>
            ) : (
              <div className="space-y-3">
                {historial.citas.map((cita) => {
                  const peluquero = uno<{ nombre: string }>(cita.peluqueros)
                  const servicios = (cita.cita_servicios ?? [])
                    .map((cs) => uno<{ nombre: string }>(cs.servicios)?.nombre)
                    .filter(Boolean)
                    .join(' + ')
                  return (
                    <div key={cita.id} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{formatearFechaHora(cita.inicio)}</p>
                        <p className="text-xs text-gray-400">
                          {servicios || 'Sin servicio'}
                          {peluquero && ` · ${peluquero.nombre}`}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          COLOR_ESTADO[cita.estado] ?? 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {cita.estado}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Historial de ventas */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Últimas ventas</h2>
            {historial.ventas.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sin ventas registradas</p>
            ) : (
              <div className="space-y-3">
                {historial.ventas.map((venta) => (
                  <div key={venta.id} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{formatearFechaHora(venta.fecha)}</p>
                      <p className="text-xs text-gray-400">
                        {(venta.venta_items ?? []).map((i) => i.nombre).join(', ') || 'Sin detalle'}
                        {venta.medio_pago && ` · ${venta.medio_pago}`}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-800">{formatearCLP(venta.total_clp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalCliente
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={cargar}
        cliente={cliente}
      />
    </div>
  )
}
