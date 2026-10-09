'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSolicitudesPendientes } from '../lib/useSolicitudesPendientes'
import { esRol, PAGINAS, type Rol } from '../lib/roles'

export default function Navbar({ peluqueria }: { peluqueria?: string }) {
  const pathname = usePathname()
  const [me, setMe] = useState<{ peluqueria: string | null; rol: Rol | null } | null>(null)
  const [saliendo, setSaliendo] = useState(false)

  // El rol decide qué enlaces se muestran (proxy.ts protege las páginas).
  useEffect(() => {
    let cancelado = false
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelado && json) setMe({ peluqueria: json.peluqueria ?? null, rol: esRol(json.rol) ? json.rol : null })
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  const nombre = peluqueria || me?.peluqueria || ''
  const rol = me?.rol ?? null
  const pendientes = useSolicitudesPendientes(rol === 'dueño' || rol === 'recepcionista')
  // Mientras se conoce el rol, solo las páginas que ven todos.
  const enlaces = PAGINAS.filter((p) => (rol ? p.roles.includes(rol) : p.roles.length === 3)).map((p) =>
    p.href === '/comisiones' && rol === 'peluquero' ? { ...p, label: 'Mis comisiones' } : p
  )

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
        <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
          <Image
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <span className="font-semibold text-gray-800 hidden lg:inline">Agenda Peluquerías</span>
        </Link>

        {/* Con tantos enlaces la fila no cabe en pantallas angostas: se desplaza en horizontal. */}
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {enlaces.map((enlace) => {
            const activo = pathname === enlace.href || pathname.startsWith(`${enlace.href}/`)
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activo
                    ? 'bg-slate-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {enlace.label}
                {enlace.href === '/solicitudes' && pendientes !== null && pendientes > 0 && (
                  <span
                    aria-label={`${pendientes} por confirmar`}
                    className="rounded-full bg-blue-600 px-1.5 text-xs font-semibold leading-5 text-white"
                  >
                    {pendientes}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {nombre && <span className="hidden text-sm text-gray-500 xl:inline">{nombre}</span>}
        <button
          onClick={handleLogout}
          disabled={saliendo}
          className="whitespace-nowrap text-sm font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
        >
          {saliendo ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>
    </nav>
  )
}
