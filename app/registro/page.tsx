'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function generarSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function RegistroPage() {
  const router = useRouter()

  const [nombrePeluqueria, setNombrePeluqueria] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditado, setSlugEditado] = useState(false)
  const [nombreDueno, setNombreDueno] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleNombrePeluqueria(valor: string) {
    setNombrePeluqueria(valor)
    if (!slugEditado) setSlug(generarSlug(valor))
  }

  function handleSlug(valor: string) {
    setSlugEditado(true)
    setSlug(generarSlug(valor))
  }

  function validar(): string | null {
    if (!nombrePeluqueria.trim()) return 'Escribe el nombre de tu peluquería'
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return 'La URL debe tener entre 3 y 40 caracteres: letras minúsculas, números y guiones'
    if (!nombreDueno.trim()) return 'Escribe tu nombre'
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Escribe un correo válido'
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
    return null
  }

  async function handleRegistro() {
    const problema = validar()
    if (problema) {
      setError(problema)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombrePeluqueria: nombrePeluqueria.trim(),
          slug,
          nombreDueno: nombreDueno.trim(),
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No pudimos crear tu cuenta. Intenta de nuevo.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('No pudimos conectar con el servidor. Revisa tu conexión.')
      setLoading(false)
    }
  }

  const inputClass =
    'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
          <Image
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            width={144}
            height={144}
            className="w-36 h-36 object-contain mx-auto filter invert"
          />
          <p className="text-slate-400 text-sm mt-1">Crea tu cuenta gratis</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Registra tu peluquería</h2>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              handleRegistro()
            }}
          >
            {/* Nombre peluquería */}
            <div>
              <label htmlFor="nombrePeluqueria" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre de tu peluquería
              </label>
              <input
                id="nombrePeluqueria"
                type="text"
                placeholder="Ej: Barbería Juan"
                value={nombrePeluqueria}
                onChange={(e) => handleNombrePeluqueria(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                URL de tu agenda
              </label>
              <div className="flex items-center border border-gray-200 bg-gray-50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-800 transition-all">
                <span className="px-4 py-3 text-sm text-gray-400 bg-gray-100 border-r border-gray-200 whitespace-nowrap">
                  agendapeluquerias.cl/
                </span>
                <input
                  id="slug"
                  type="text"
                  placeholder="barberia-juan"
                  value={slug}
                  onChange={(e) => handleSlug(e.target.value)}
                  className="flex-1 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Solo letras minúsculas, números y guiones</p>
            </div>

            {/* Nombre dueño */}
            <div>
              <label htmlFor="nombreDueno" className="block text-sm font-medium text-gray-700 mb-1.5">
                Tu nombre
              </label>
              <input
                id="nombreDueno"
                type="text"
                placeholder="Juan González"
                value={nombreDueno}
                onChange={(e) => setNombreDueno(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all mt-2 disabled:opacity-50"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>

          {/* Login */}
          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-slate-800 font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱
        </p>
      </div>
    </div>
  )
}
