'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, INPUT, LABEL } from '../components/estilos'
import { esRol, NOMBRE_ROL } from '../lib/roles'

interface Cuenta {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  peluquero: string | null
  esYo: boolean
}

interface Invitacion {
  id: string
  token: string
  rol: string
  peluquero: string | null
  vence_en: string
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

function enlaceInvitacion(token: string) {
  return `${window.location.origin}/unirse/${token}`
}

function formatearVence(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' })
}

export default function EquipoPage() {
  const [recarga, setRecarga] = useState(0)
  const [respuesta, setRespuesta] = useState<{ recarga: number; equipo: Equipo | null; error: string }>({
    recarga: -1,
    equipo: null,
    error: '',
  })
  const cargando = respuesta.recarga !== recarga
  const equipo = respuesta.equipo

  const [rol, setRol] = useState<'recepcionista' | 'peluquero'>('recepcionista')
  const [peluqueroId, setPeluqueroId] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState('')
  const [cambiando, setCambiando] = useState('')

  useEffect(() => {
    fetch('/api/equipo')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar el equipo')
        return json as Equipo
      })
      .then((datos) => setRespuesta({ recarga, equipo: datos, error: '' }))
      .catch((err) => setRespuesta({ recarga, equipo: null, error: err.message }))
  }, [recarga])

  async function invitar() {
    if (rol === 'peluquero' && !peluqueroId) return setError('Elige la ficha del peluquero')
    setCreando(true)
    setError('')
    try {
      const res = await fetch('/api/equipo/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rol === 'peluquero' ? { rol, peluquero_id: peluqueroId } : { rol }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos crear la invitación')
        return
      }
      setPeluqueroId('')
      setRecarga((n) => n + 1)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setCreando(false)
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(enlaceInvitacion(token))
      setCopiado(token)
      setTimeout(() => setCopiado(''), 2000)
    } catch {
      setError('No pudimos copiar el enlace')
    }
  }

  function compartir(invitacion: Invitacion) {
    const texto = `Te invito a unirte al equipo como ${invitacion.rol}. Crea tu cuenta aquí: ${enlaceInvitacion(invitacion.token)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  async function anular(id: string) {
    setError('')
    const res = await fetch(`/api/equipo/invitaciones/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      const json = await res?.json().catch(() => ({}))
      setError(json?.error ?? 'No pudimos anular la invitación')
      return
    }
    setRecarga((n) => n + 1)
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
      setRecarga((n) => n + 1)
    } finally {
      setCambiando('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            Se crea un enlace de 7 días. La persona lo abre, crea su cuenta y entra con su propio acceso.
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
                <option value="recepcionista">Recepcionista</option>
                <option value="peluquero">Peluquero</option>
              </select>
            </div>
            {rol === 'peluquero' && (
              <div>
                <label htmlFor="fichaPeluquero" className={LABEL}>Ficha de peluquero</label>
                {equipo && equipo.peluquerosSinCuenta.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Todos tienen cuenta.{' '}
                    <Link href="/peluqueros" className="font-medium text-slate-700 hover:underline">Agrega uno</Link>
                  </p>
                ) : (
                  <select id="fichaPeluquero" value={peluqueroId} onChange={(e) => setPeluqueroId(e.target.value)} className={INPUT}>
                    <option value="">Elige un peluquero</option>
                    {equipo?.peluquerosSinCuenta.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div>
              <button type="submit" disabled={creando} className={BOTON_PRIMARIO}>
                {creando ? 'Creando...' : 'Crear invitación'}
              </button>
            </div>
          </form>

          {equipo && equipo.invitaciones.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700">Invitaciones pendientes</h3>
              {equipo.invitaciones.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-800">
                      {esRol(inv.rol) ? NOMBRE_ROL[inv.rol] : inv.rol}
                      {inv.peluquero && ` · ${inv.peluquero}`}
                    </span>
                    <span className="block text-xs text-gray-400">Vence el {formatearVence(inv.vence_en)}</span>
                  </span>
                  <button type="button" onClick={() => compartir(inv)} className={BOTON_SECUNDARIO}>
                    WhatsApp
                  </button>
                  <button type="button" onClick={() => copiar(inv.token)} className={BOTON_SECUNDARIO}>
                    {copiado === inv.token ? 'Copiado ✓' : 'Copiar enlace'}
                  </button>
                  <button type="button" onClick={() => anular(inv.id)} className="text-sm text-gray-400 hover:text-red-500">
                    Anular
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cuentas */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Cuentas</h2>
          {cargando ? (
            <p className="py-6 text-center text-sm text-gray-400">Cargando equipo...</p>
          ) : respuesta.error ? (
            <p className="py-6 text-center text-sm text-red-500">{respuesta.error}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {equipo?.cuentas.map((c) => (
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
    </div>
  )
}
