'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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

  async function handleLogin() {
    setLoading(true)
    setError('')
    setAviso('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Correo o contraseña incorrectos')
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Image
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            width={144}
            height={144}
            loading="eager"
            className="w-36 h-36 object-contain mx-auto filter invert"
          />
          <p className="text-slate-400 text-sm mt-1">Panel de gestión para tu negocio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Inicia sesión</h2>

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
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
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
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
              />
            </div>

            {aviso && <p className="text-green-600 text-sm">{aviso}</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-700 active:scale-95 transition-all mt-2 disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>

          <p className="text-center text-sm text-gray-500">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="text-slate-800 font-semibold hover:underline">Regístrate gratis</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">© 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱</p>
      </div>
    </div>
  )
}