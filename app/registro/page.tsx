'use client'

import { useState } from 'react'
import Link from 'next/link'
import Portada, { Resaltado } from '../components/Portada'
import { INPUT_ACCESO } from '../components/TarjetaAcceso'

const PASOS = [
  { titulo: 'Registra tu peluquería', texto: 'Con tu nombre, correo y la dirección de tu página de reservas.' },
  { titulo: 'Agrega servicios y horarios', texto: 'Precios, duración y los días que atiende cada peluquero.' },
  { titulo: 'Comparte tu enlace', texto: 'Tus clientes reservan solos y a tu equipo lo invitas con un enlace.' },
]

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
  const [nombrePeluqueria, setNombrePeluqueria] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditado, setSlugEditado] = useState(false)
  const [nombreDueno, setNombreDueno] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Supabase pidió confirmar el correo: la peluquería se registra sola al confirmar.
  const [revisarCorreo, setRevisarCorreo] = useState(false)

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_peluqueria: nombrePeluqueria.trim(),
          slug,
          nombre_usuario: nombreDueno.trim(),
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

      if (data.confirmar) {
        setRevisarCorreo(true)
        setLoading(false)
        return
      }

      // Carga completa: el proxy y el menú leen la sesión nueva.
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
          Tu peluquería lista <Resaltado>en 2 minutos</Resaltado>
        </>
      }
      texto="Crea tu cuenta gratis y empieza a recibir reservas hoy. No hay nada que instalar: funciona en el computador y en el celular."
      detalle={
        <ol className="space-y-3">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-950">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold text-white">{paso.titulo}</span>
                <span className="mt-0.5 block text-sm text-slate-400">{paso.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      }
    >
        <div className="rounded-2xl bg-white p-8 text-gray-900 shadow-2xl">
          <h2 className="text-xl font-semibold text-gray-800">Registra tu peluquería</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            ¿Ya creaste una cuenta antes y no quedó en ninguna peluquería? Usa el mismo correo y contraseña.
          </p>

          {revisarCorreo ? (
            <div className="space-y-3 text-sm">
              <p className="text-gray-700">
                Te enviamos un correo a <span className="font-semibold">{email.trim()}</span> para confirmar tu cuenta.
              </p>
              <p className="text-gray-500">
                Ábrelo y toca el enlace: tu peluquería queda creada y entras al panel. Si no llega en unos minutos,
                revisa la carpeta de spam.
              </p>
            </div>
          ) : (
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
                className={INPUT_ACCESO}
              />
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                URL de tu agenda
              </label>
              <div className="flex items-center border border-gray-200 bg-gray-50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-800 transition-all">
                <span className="px-4 py-3 text-sm text-gray-400 bg-gray-100 border-r border-gray-200 whitespace-nowrap">
                  …/reservar/
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
              <p className="text-xs text-gray-400 mt-1">Tu página de reservas. Solo letras minúsculas, números y guiones.</p>
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
                className={INPUT_ACCESO}
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
                className={INPUT_ACCESO}
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
                className={INPUT_ACCESO}
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
          )}

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
    </Portada>
  )
}
