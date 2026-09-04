'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const enlaces = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/clientes', label: 'Clientes' },
]

export default function Navbar({ peluqueria }: { peluqueria?: string }) {
  const pathname = usePathname()
  const [nombre, setNombre] = useState(peluqueria ?? '')
  const [saliendo, setSaliendo] = useState(false)

  // Si la página ya conoce el nombre de la peluquería lo usa;
  // si no, lo pide a /api/me (pendiente en backend: falla en silencio).
  useEffect(() => {
    if (peluqueria) {
      setNombre(peluqueria)
      return
    }
    let cancelado = false
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelado && json?.peluqueria) setNombre(json.peluqueria)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [peluqueria])

  async function handleLogout() {
    setSaliendo(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <span className="font-semibold text-gray-800 hidden sm:inline">Agenda Peluquerías</span>
        </Link>

        <div className="flex items-center gap-1">
          {enlaces.map((enlace) => {
            const activo = pathname === enlace.href || pathname.startsWith(`${enlace.href}/`)
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activo
                    ? 'bg-slate-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {enlace.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {nombre && <span className="text-sm text-gray-500 hidden sm:inline">{nombre}</span>}
        <button
          onClick={handleLogout}
          disabled={saliendo}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
        >
          {saliendo ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>
    </nav>
  )
}
