'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import TarjetaAcceso, { BOTON_ACCESO, INPUT_ACCESO } from '../components/TarjetaAcceso'

export default function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  // /auth/confirmar vuelve aquí con ?error=enlace si el enlace no sirvió
  const { error: errorEnlace } = use(searchParams)
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(
    errorEnlace === 'enlace' ? 'El enlace no es válido o ya venció. Pide uno nuevo.' : ''
  )

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos enviar el correo')
        return
      }
      setEnviado(true)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <TarjetaAcceso titulo="Recupera tu contraseña">
      {enviado ? (
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            Si <span className="font-semibold">{email}</span> tiene una cuenta, te enviamos un correo con
            un enlace para elegir una contraseña nueva.
          </p>
          <p className="text-gray-500">
            Ábrelo en este mismo navegador. Si no llega en unos minutos, revisa la carpeta de spam.
          </p>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <p className="text-sm text-gray-500">
            Escribe el correo con el que te registraste y te enviaremos un enlace para elegir una
            contraseña nueva.
          </p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
            <input
              id="email"
              autoComplete="email"
              type="email"
              required
              placeholder="tu@correo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_ACCESO}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={enviando} className={BOTON_ACCESO}>
            {enviando ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/login" className="text-slate-800 font-semibold hover:underline">Volver a iniciar sesión</Link>
      </p>
    </TarjetaAcceso>
  )
}
