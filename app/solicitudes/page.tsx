'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import { avisarCambioEnSolicitudes } from '../lib/useSolicitudesPendientes'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'
import TarjetaSolicitud, { TarjetaRespondida, type Respondida, type Solicitud } from './TarjetaSolicitud'

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [consultadoEn, setConsultadoEn] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [peluqueros, setPeluqueros] = useState<{ id: string; nombre: string }[]>([])
  const [peluqueria, setPeluqueria] = useState('')
  // Las respondidas quedan a la vista hasta apretar "Listo", para poder avisar al cliente.
  const [respondidas, setRespondidas] = useState<Respondida[]>([])

  // Solo toca el estado cuando llega la respuesta, para poder llamarla al
  // montar y al refrescar sin provocar renders en cascada.
  const pedirSolicitudes = useCallback(() => {
    const params = new URLSearchParams({ estado: 'solicitada', desde: new Date().toISOString() })
    fetch(`/api/citas?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar las solicitudes')
        return (json.citas ?? []) as Solicitud[]
      })
      .then((lista) => {
        setSolicitudes(lista)
        setConsultadoEn(Date.now())
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  // Las solicitudes nuevas aparecen al volver a la pestaña y cada 30 segundos.
  useMantenerActualizado(pedirSolicitudes, 30_000)

  useEffect(() => {
    pedirSolicitudes()

    fetch('/api/peluqueros')
      .then((res) => (res.ok ? res.json() : { peluqueros: [] }))
      .then((json) =>
        setPeluqueros(
          ((json.peluqueros ?? []) as { id: string; nombre: string; activo: boolean }[]).filter((p) => p.activo)
        )
      )
      .catch(() => {})
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.peluqueria) setPeluqueria(json.peluqueria)
      })
      .catch(() => {})
  }, [pedirSolicitudes])

  function alResponder(respondida: Respondida) {
    setRespondidas((previas) => [respondida, ...previas])
    setSolicitudes((previas) => previas.filter((s) => s.id !== respondida.solicitud.id))
    avisarCambioEnSolicitudes()
  }

  const respondidasIds = new Set(respondidas.map((r) => r.solicitud.id))
  const pendientes = solicitudes.filter((s) => !respondidasIds.has(s.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {cargando
              ? 'Cargando...'
              : pendientes.length === 0
                ? 'Reservas en línea que esperan tu respuesta'
                : `${pendientes.length} ${pendientes.length === 1 ? 'reserva espera' : 'reservas esperan'} tu respuesta`}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {respondidas.map((respondida) => (
          <TarjetaRespondida
            key={respondida.solicitud.id}
            respondida={respondida}
            peluqueria={peluqueria}
            onListo={() =>
              setRespondidas((previas) => previas.filter((r) => r.solicitud.id !== respondida.solicitud.id))
            }
          />
        ))}

        {cargando ? (
          <p className="py-12 text-center text-sm text-gray-400">Cargando solicitudes...</p>
        ) : pendientes.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>
            <p className="mt-1 text-sm text-gray-400">
              Comparte tu enlace de reservas para recibirlas.{' '}
              <Link href="/configuracion" className="font-medium text-slate-700 hover:underline">
                Ver enlace
              </Link>
            </p>
          </div>
        ) : (
          pendientes.map((solicitud) => (
            <TarjetaSolicitud
              key={solicitud.id}
              solicitud={solicitud}
              peluqueros={peluqueros}
              consultadoEn={consultadoEn}
              onRespondida={alResponder}
            />
          ))
        )}
      </div>
    </div>
  )
}
