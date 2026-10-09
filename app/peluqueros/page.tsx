'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ModalPeluquero, { type Peluquero } from '../components/ModalPeluquero'
import { crearInvitacion, ListaInvitaciones, ModalInvitacionCreada, type Invitacion } from '../components/Invitaciones'
import { BOTON_SECUNDARIO } from '../components/estilos'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'

const ETIQUETA_CONTRATO: Record<string, string> = {
  fijo: 'Sueldo fijo',
  comision: 'Comisión',
  arriendo_sillon: 'Arriendo de sillón',
}

// Cada cuánto se revisa si alguien se unió con su enlace, con la página a la vista.
const REFRESCO_MS = 10_000

export default function PeluquerosPage() {
  const [peluqueros, setPeluqueros] = useState<Peluquero[] | null>(null)
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Peluquero | null>(null)
  const [cambiandoId, setCambiandoId] = useState('')
  const [invitando, setInvitando] = useState('')
  const [creada, setCreada] = useState<Invitacion | null>(null)

  // Solo toca el estado cuando llega la respuesta: sirve para la primera carga
  // y para el refresco en silencio. Si un refresco falla, se queda lo último.
  const pedirPeluqueros = useCallback(() => {
    fetch('/api/peluqueros')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar los peluqueros')
        return json
      })
      .then((json) => {
        setPeluqueros(json.peluqueros ?? [])
        setErrorCarga('')
      })
      .catch((err) => setErrorCarga(err.message))

    // Invitaciones de peluquero que esperan que alguien se una
    fetch('/api/equipo')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setInvitaciones((json.invitaciones ?? []).filter((i: Invitacion) => i.rol === 'peluquero'))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    pedirPeluqueros()
  }, [pedirPeluqueros])

  // Quien se une con su enlace aparece en la lista sin recargar.
  useMantenerActualizado(pedirPeluqueros, REFRESCO_MS)

  /** Crea el enlace: sin ficha, para alguien nuevo; con ficha, para vincular a ese peluquero. */
  async function invitar(ficha?: Peluquero) {
    setInvitando(ficha?.id ?? 'nuevo')
    setError('')
    const resultado = await crearInvitacion('peluquero', ficha ? { id: ficha.id, nombre: ficha.nombre } : null)
    setInvitando('')
    if ('error' in resultado) {
      setError(resultado.error)
      return
    }
    setCreada(resultado.invitacion)
    pedirPeluqueros()
  }

  async function alternarActivo(peluquero: Peluquero) {
    setCambiandoId(peluquero.id)
    try {
      // DELETE solo desactiva; para reactivar se usa PATCH con activo: true.
      const res = peluquero.activo
        ? await fetch(`/api/peluqueros/${peluquero.id}`, { method: 'DELETE' })
        : await fetch(`/api/peluqueros/${peluquero.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: true }),
          })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cambiar el estado del peluquero')
        return
      }
      pedirPeluqueros()
    } finally {
      setCambiandoId('')
    }
  }

  function abrirNuevo() {
    setEnEdicion(null)
    setModalAbierto(true)
  }

  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Peluqueros</h1>
            <p className="mt-1 text-sm text-gray-500">
              {peluqueros ? `${peluqueros.length} en el equipo` : errorCarga ? '—' : 'Cargando...'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={abrirNuevo} className={BOTON_SECUNDARIO}>
              Agregar sin cuenta
            </button>
            <button
              type="button"
              onClick={() => invitar()}
              disabled={invitando === 'nuevo'}
              className="rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-50 bg-amber-400 text-slate-950 font-semibold shadow-sm shadow-amber-500/20 hover:bg-amber-300"
            >
              {invitando === 'nuevo' ? 'Creando enlace...' : '+ Invitar peluquero'}
            </button>
          </div>
        </div>

        <p className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Invitar peluquero</span> crea un enlace para enviar por WhatsApp: la
          persona crea su cuenta y aparece aquí sola, con acceso a sus citas y comisiones.{' '}
          <span className="font-medium text-gray-800">Agregar sin cuenta</span> es para quien no va a usar la app.
        </p>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {invitaciones.length > 0 && (
          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Invitaciones pendientes</h2>
            <ListaInvitaciones invitaciones={invitaciones} onAnulada={pedirPeluqueros} onError={setError} />
          </section>
        )}

        {!peluqueros && !errorCarga ? (
          <p className="py-12 text-center text-sm text-gray-400">Cargando peluqueros...</p>
        ) : !peluqueros ? (
          <p className="py-12 text-center text-sm text-red-500">{errorCarga}</p>
        ) : peluqueros.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm text-gray-400">
              Todavía no tienes peluqueros. Invita a tu equipo o agrega al menos uno para poder agendar citas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {peluqueros.map((peluquero) => (
              <div
                key={peluquero.id}
                className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
                  peluquero.activo ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: peluquero.color_agenda }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{peluquero.nombre}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {peluquero.telefono ?? 'Sin teléfono'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      peluquero.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {peluquero.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <p className="mt-4 text-sm text-gray-600">
                  {ETIQUETA_CONTRATO[peluquero.tipo_contrato] ?? peluquero.tipo_contrato}
                  {peluquero.tipo_contrato === 'comision' && (
                    <span className="text-gray-400"> · {peluquero.porcentaje_comision}%</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {peluquero.usuario_id ? 'Entra a la app con su cuenta' : 'Sin cuenta en la app'}
                </p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => {
                      setEnEdicion(peluquero)
                      setModalAbierto(true)
                    }}
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarActivo(peluquero)}
                    disabled={cambiandoId === peluquero.id}
                    className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50"
                  >
                    {cambiandoId === peluquero.id ? '...' : peluquero.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {!peluquero.usuario_id && peluquero.activo && invitaciones.some((i) => i.peluquero_id === peluquero.id) ? (
                    <span className="text-sm text-gray-400">Acceso enviado</span>
                  ) : !peluquero.usuario_id && peluquero.activo && (
                    <button
                      onClick={() => invitar(peluquero)}
                      disabled={invitando === peluquero.id}
                      className="text-sm font-medium text-amber-700 transition-colors hover:text-amber-800 disabled:opacity-50"
                    >
                      {invitando === peluquero.id ? 'Creando enlace...' : 'Enviarle acceso'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalPeluquero
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={pedirPeluqueros}
        peluquero={enEdicion}
      />

      <ModalInvitacionCreada invitacion={creada} onCerrar={() => setCreada(null)} />
    </div>
  )
}
