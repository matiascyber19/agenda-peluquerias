'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TarjetaAcceso, { BOTON_ACCESO, INPUT_ACCESO } from '../components/TarjetaAcceso'

// Se llega desde el enlace del correo (/auth/confirmar), que ya abrió la sesión.
export default function RestablecerPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [enlaceVencido, setEnlaceVencido] = useState(false)

  async function guardar() {
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== repetida) {
      setError('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEnlaceVencido(res.status === 401)
        setError(json.error ?? 'No pudimos cambiar la contraseña')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <TarjetaAcceso titulo="Elige una contraseña nueva">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña nueva</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_ACCESO}
          />
        </div>

        <div>
          <label htmlFor="repetida" className="block text-sm font-medium text-gray-700 mb-1.5">Repite la contraseña</label>
          <input
            id="repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className={INPUT_ACCESO}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm">
            {error}
            {enlaceVencido && (
              <>
                {' '}
                <Link href="/recuperar" className="font-semibold underline">Pedir otro enlace</Link>
              </>
            )}
          </p>
        )}

        <button type="submit" disabled={guardando} className={BOTON_ACCESO}>
          {guardando ? 'Guardando...' : 'Guardar y entrar →'}
        </button>
      </form>
    </TarjetaAcceso>
  )
}
