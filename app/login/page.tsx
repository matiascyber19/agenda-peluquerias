'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import Portada, { BOTON_PORTADA, Resaltado } from '../components/Portada'
import { BOTON_ACCESO, INPUT_ACCESO } from '../components/TarjetaAcceso'

const FUNCIONES = [
  { icono: '📅', titulo: 'Agenda por peluquero', texto: 'Cada uno con su color y sin horas cruzadas.' },
  { icono: '📲', titulo: 'Reservas en línea', texto: 'Tu enlace para Instagram o WhatsApp, abierto las 24 horas.' },
  { icono: '👥', titulo: 'Tu equipo con acceso', texto: 'Los invitas con un enlace y cada uno ve sus citas y comisiones.' },
  { icono: '💰', titulo: 'Cobros y reportes', texto: 'Ingresos, gastos y comisiones del mes, sin planillas.' },
]

// Avisos que llegan en la URL:
//   ?acceso=sin-cuenta        proxy.ts: cuenta sin peluquería o desactivada
//   ?confirmado=1             /auth/confirmar: el correo quedó confirmado
//   ?confirmacion=fallida     /auth/confirmar: el enlace venció o no sirvió
//   ?error=...                /auth/confirmar: no se pudo terminar la cuenta
function avisoInicial(params: Record<string, string | string[] | undefined>) {
  if (typeof params.error === 'string' && params.error) return { tipo: 'error', texto: params.error }
  if (params.acceso === 'sin-cuenta') {
    return { tipo: 'error', texto: 'Tu cuenta no tiene acceso a ninguna peluquería o fue desactivada. Habla con el dueño.' }
  }
  if (params.confirmacion === 'fallida') {
    return { tipo: 'error', texto: 'El enlace de confirmación venció o no es válido. Intenta iniciar sesión.' }
  }
  if (params.confirmado === '1') return { tipo: 'ok', texto: 'Tu correo quedó confirmado. Inicia sesión para entrar.' }
  return null
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const inicial = avisoInicial(use(searchParams))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(inicial?.tipo === 'error' ? inicial.texto : '')
  const [aviso, setAviso] = useState(inicial?.tipo === 'ok' ? inicial.texto : '')
  const [loading, setLoading] = useState(false)
  // La cuenta existe pero no está en ninguna peluquería: puede crear la suya.
  const [sinPeluqueria, setSinPeluqueria] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    setAviso('')
    setSinPeluqueria(false)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Correo o contraseña incorrectos')
        setSinPeluqueria(json.sinPeluqueria === true)
        setLoading(false)
        return
      }

      // Carga completa: el proxy y el menú leen la sesión nueva, y si algo
      // falla la página no queda a medio navegar con el botón cargando.
      window.location.assign('/dashboard')
    } catch {
      setError('No pudimos conectar con el servidor. Revisa tu conexión.')
      setLoading(false)
    }
  }

  return (
    <Portada
      titular={
        <>
          La agenda de tu peluquería, <Resaltado>ordenada y en línea</Resaltado>
        </>
      }
      texto="Agenda, clientes, cobros y comisiones en un solo lugar. Tus clientes reservan solos desde el celular y tu equipo entra con su propia cuenta."
      acciones={
        <>
          <Link href="/registro" className={BOTON_PORTADA}>
            Crear mi peluquería gratis →
          </Link>
          <a href="#formulario" className="px-2 py-3 text-sm font-medium text-slate-300 hover:text-white lg:hidden">
            Ya tengo cuenta ↓
          </a>
        </>
      }
      detalle={
        <ul className="grid gap-3 sm:grid-cols-2">
          {FUNCIONES.map((f) => (
            <li key={f.titulo} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <span aria-hidden className="text-2xl">{f.icono}</span>
              <p className="mt-2 font-semibold text-white">{f.titulo}</p>
              <p className="mt-1 text-sm leading-snug text-slate-400">{f.texto}</p>
            </li>
          ))}
        </ul>
      }
    >
      <div className="rounded-2xl bg-white p-8 text-gray-900 shadow-2xl">
        <h2 className="text-xl font-semibold text-gray-800">Inicia sesión</h2>
        <p className="mt-1 mb-6 text-sm text-gray-500">Dueños, recepcionistas y peluqueros entran aquí.</p>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            handleLogin()
          }}
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
            <input
              id="email"
              autoComplete="email"
              type="email"
              placeholder="tu@correo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_ACCESO}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
              <Link href="/recuperar" className="text-xs text-slate-600 hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
            <input
              id="password"
              autoComplete="current-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_ACCESO}
            />
          </div>

          {aviso && <p className="text-green-600 text-sm">{aviso}</p>}
          {error && (
            <div className="space-y-2">
              <p className="text-red-500 text-sm">{error}</p>
              {sinPeluqueria && (
                <Link href="/registro" className="inline-block text-sm font-semibold text-slate-800 hover:underline">
                  Crear mi peluquería con esta cuenta →
                </Link>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} className={BOTON_ACCESO}>
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-100"></div>
          <span className="text-xs text-gray-400">¿Primera vez aquí?</span>
          <div className="flex-1 h-px bg-gray-100"></div>
        </div>

        <Link
          href="/registro"
          className="block w-full rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
        >
          Crear mi peluquería gratis
        </Link>
        <p className="mt-3 text-center text-xs text-gray-400">
          ¿Trabajas en una peluquería? Pídele al dueño tu enlace de invitación.
        </p>
      </div>
    </Portada>
  )
}
