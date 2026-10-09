'use client'

import { useState } from 'react'
import { BOTON_ACCESO, INPUT_ACCESO } from '@/app/components/TarjetaAcceso'

/** Crea la cuenta de la persona invitada y la deja dentro del panel. */
export default function FormularioUnirse({ token, nombreSugerido }: { token: string; nombreSugerido: string }) {
  const [nombre, setNombre] = useState(nombreSugerido)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  // Supabase pidió confirmar el correo: la invitación se acepta sola al confirmar.
  const [revisarCorreo, setRevisarCorreo] = useState(false)

  async function unirse() {
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/unirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nombre, email, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos crear tu cuenta')
        return
      }
      if (json.confirmar) {
        setRevisarCorreo(true)
        return
      }
      // Carga completa: el menú y el proxy leen la sesión nueva.
      window.location.href = '/dashboard'
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  if (revisarCorreo) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-gray-700">
          Te enviamos un correo a <span className="font-semibold">{email.trim()}</span> para confirmar tu cuenta.
        </p>
        <p className="text-gray-500">
          Ábrelo y toca el enlace: quedas en el equipo y entras al panel. Si no llega en unos minutos, revisa la
          carpeta de spam.
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        unirse()
      }}
    >
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1.5">Tu nombre</label>
        <input id="nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT_ACCESO} required />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_ACCESO}
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Al menos 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_ACCESO}
          required
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" disabled={enviando} className={BOTON_ACCESO}>
        {enviando ? 'Creando tu cuenta...' : 'Crear cuenta y entrar →'}
      </button>
    </form>
  )
}
