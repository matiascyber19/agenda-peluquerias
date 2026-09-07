'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo_agenda_peluqueria.png" alt="Agenda Peluquerías" className="w-36 h-36 object-contain mx-auto filter invert" />
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
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