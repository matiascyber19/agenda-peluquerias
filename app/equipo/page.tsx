'use client'

import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { BOTON_CREAR, INPUT, LABEL } from '../components/estilos'
import { crearInvitacion, ListaInvitaciones, ModalInvitacionCreada, type Invitacion } from '../components/Invitaciones'
import { esRol, NOMBRE_ROL } from '../lib/roles'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'

interface Cuenta {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  peluquero: string | null
  esYo: boolean
}

interface Equipo {
  cuentas: Cuenta[]
  invitaciones: Invitacion[]
  peluquerosSinCuenta: { id: string; nombre: string }[]
}

const PERMISOS = [
  { rol: 'Dueño', puede: 'Todo: agenda, solicitudes, clientes, catálogo, equipo, reportes, gastos, comisiones y configuración.' },
  { rol: 'Recepcionista', puede: 'Agenda de todos, solicitudes, clientes y cobros. No ve reportes, gastos, comisiones ni configuración.' },
  { rol: 'Peluquero', puede: 'Solo sus propias citas (agendar, atender y cobrar) y sus comisiones.' },
]

// Cada cuánto se revisa si alguien aceptó una invitación, con la página a la vista.
const REFRESCO_MS = 10_000

export default function EquipoPage() {
  const [equipo, setEquipo] = useState<Equipo | null>(null)
  const [errorCarga, setErrorCarga] = useState('')

  const [rol, setRol] = useState<'recepcionista' | 'peluquero'>('peluquero')
  const [fichaId, setFichaId] = useState('')
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState<Invitacion | null>(null)
  const [error, setError] = useState('')
  const [cambiando, setCambiando] = useState('')

  // Solo toca el estado cuando llega la respuesta: sirve para la primera carga
  // y para el refresco en silencio. Si un refresco falla, se queda lo último.
  const pedirEquipo = useCallback(() => {
    fetch('/api/equipo')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar el equipo')
        return json as Equipo
      })
      .then((datos) => {
        setEquipo(datos)
        setErrorCarga('')
      })
      .catch((err) => setErrorCarga(err.message))
  }, [])

  useEffect(() => {
    pedirEquipo()
  }, [pedirEquipo])

  // Quien acepta una invitación aparece en Cuentas sin recargar.
  useMantenerActualizado(pedirEquipo, REFRESCO_MS)

  async function invitar() {
    setCreando(true)
    setError('')
    const ficha = rol === 'peluquero' ? equipo?.peluquerosSinCuenta.find((p) => p.id === fichaId) : null
    const resultado = await crearInvitacion(rol, ficha)
    setCreando(false)
    if ('error' in resultado) {
      setError(resultado.error)
      return
    }
    setFichaId('')
    setCreada(resultado.invitacion)
    pedirEquipo()
  }

  async function cambiarEstado(cuenta: Cuenta) {
    const activar = !cuenta.activo
    if (!activar && !window.confirm(`¿Desactivar la cuenta de ${cuenta.nombre}? Pierde el acceso de inmediato.`)) return
    setCambiando(cuenta.id)
    setError('')
    try {
      const res = await fetch(`/api/equipo/${cuenta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activar }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos cambiar la cuenta')
        return
      }
      pedirEquipo()
    } finally {
      setCambiando('')
    }
  }

  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="mt-1 text-sm text-gray-500">Cuentas para tus peluqueros y recepcionistas, cada una con su acceso</p>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {/* Invitar */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">Invitar a alguien</h2>
          <p className="mt-1 text-sm text-gray-500">
            Crea un enlace y envíalo por WhatsApp. La persona crea su cuenta y entra con su propio acceso. Un peluquero
            nuevo aparece solo en Peluqueros.
          </p>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-3 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              invitar()
            }}
          >
            <div>
              <label htmlFor="rolInvitacion" className={LABEL}>Rol</label>
              <select
                id="rolInvitacion"
                value={rol}
                onChange={(e) => setRol(e.target.value as 'recepcionista' | 'peluquero')}
                className={INPUT}
              >
                <option value="peluquero">Peluquero</option>
                <option value="recepcionista">Recepcionista</option>
              </select>
            </div>
            {rol === 'peluquero' && equipo && equipo.peluquerosSinCuenta.length > 0 && (
              <div>
                <label htmlFor="fichaPeluquero" className={LABEL}>¿Quién es?</label>
                <select id="fichaPeluquero" value={fichaId} onChange={(e) => setFichaId(e.target.value)} className={INPUT}>
                  <option value="">Alguien nuevo</option>
                  {equipo.peluquerosSinCuenta.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} (ya está en Peluqueros)</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <button type="submit" disabled={creando} className={`${BOTON_CREAR} w-full`}>
                {creando ? 'Creando...' : 'Crear enlace de invitación'}
              </button>
            </div>
          </form>

          {equipo && equipo.invitaciones.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700">Invitaciones pendientes</h3>
              <ListaInvitaciones invitaciones={equipo.invitaciones} onAnulada={pedirEquipo} onError={setError} />
            </div>
          )}
        </section>

        {/* Cuentas */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Cuentas</h2>
          {!equipo && !errorCarga ? (
            <p className="py-6 text-center text-sm text-gray-400">Cargando equipo...</p>
          ) : !equipo ? (
            <p className="py-6 text-center text-sm text-red-500">{errorCarga}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {equipo.cuentas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">
                      {c.nombre}
                      {c.esYo && <span className="font-normal text-gray-400"> (tú)</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{c.email}</span>
                  </span>
                  <span className="text-gray-600">
                    {esRol(c.rol) ? NOMBRE_ROL[c.rol] : c.rol}
                    {c.peluquero && <span className="text-gray-400"> · {c.peluquero}</span>}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.activo ? 'Activa' : 'Desactivada'}
                  </span>
                  {!c.esYo && c.rol !== 'dueño' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstado(c)}
                      disabled={cambiando === c.id}
                      className={`text-sm font-medium ${c.activo ? 'text-red-500 hover:text-red-700' : 'text-slate-700 hover:underline'} disabled:opacity-50`}
                    >
                      {c.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Qué puede hacer cada rol */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">Qué puede hacer cada rol</h2>
          <dl className="space-y-2 text-sm">
            {PERMISOS.map((p) => (
              <div key={p.rol} className="flex gap-3">
                <dt className="w-28 shrink-0 font-medium text-gray-800">{p.rol}</dt>
                <dd className="text-gray-600">{p.puede}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <ModalInvitacionCreada invitacion={creada} onCerrar={() => setCreada(null)} />
    </div>
  )
}
