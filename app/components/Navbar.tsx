'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSolicitudesPendientes } from '../lib/useSolicitudesPendientes'
import { esRol, GRUPOS, NOMBRE_ROL, PAGINAS, paginaDe, type Rol } from '../lib/roles'

// Íconos de trazo, 24×24, del color del texto.
const TRAZOS: Record<string, React.ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  salir: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" />,
  campana: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9" />
      <path d="M10.3 20.5a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  '/dashboard': (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  '/agenda': (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  '/solicitudes': (
    <>
      <path d="M3.5 13h4.5l1.5 3h5l1.5-3h4.5" />
      <path d="M5.5 5h13l2 8v5.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V13z" />
    </>
  ),
  '/clientes': (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c.6-3.9 3.6-6.3 7.5-6.3s6.9 2.4 7.5 6.3" />
    </>
  ),
  '/servicios': (
    <>
      <circle cx="6.5" cy="6.5" r="2.8" />
      <circle cx="6.5" cy="17.5" r="2.8" />
      <path d="M8.8 8.2 20 19M8.8 15.8 20 5" />
    </>
  ),
  '/peluqueros': (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="9" cy="11" r="2.3" />
      <path d="M5.8 16.5c.6-1.7 1.8-2.6 3.2-2.6s2.6.9 3.2 2.6M15 10h3M15 13.5h3" />
    </>
  ),
  '/equipo': (
    <>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.8 20c.5-3.5 3-5.7 6.2-5.7s5.7 2.2 6.2 5.7" />
      <path d="M15.5 4.9a3.3 3.3 0 0 1 0 6.3M17.5 14.6c2 .7 3.3 2.6 3.7 5.4" />
    </>
  ),
  '/reportes': <path d="M5 20V11M11 20V5M17 20v-6M3 20.5h18" />,
  '/gastos': (
    <>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
    </>
  ),
  '/comisiones': (
    <>
      <path d="M18.5 5.5 5.5 18.5" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  '/configuracion': (
    <>
      <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
      <circle cx="15" cy="6.5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </>
  ),
}

function Icono({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-5 w-5 shrink-0 ${className}`}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}

/** "Diego Pérez" → "DP" */
function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

/**
 * Barra superior con un menú hamburguesa: el botón abre un panel lateral con
 * las páginas del rol agrupadas por tema. Las solicitudes pendientes se ven en
 * la barra y en el panel.
 */
export default function Navbar({ peluqueria }: { peluqueria?: string }) {
  const pathname = usePathname()
  const [me, setMe] = useState<{ nombre: string | null; peluqueria: string | null; rol: Rol | null } | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const botonMenu = useRef<HTMLButtonElement>(null)
  const botonCerrar = useRef<HTMLButtonElement>(null)

  // El rol decide qué páginas se muestran (proxy.ts protege las páginas).
  useEffect(() => {
    let cancelado = false
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelado && json) {
          setMe({ nombre: json.nombre ?? null, peluqueria: json.peluqueria ?? null, rol: esRol(json.rol) ? json.rol : null })
        }
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  // Con el panel abierto: Esc lo cierra, la página de fondo no se desplaza y
  // el foco entra al panel.
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        botonMenu.current?.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    const desplazamiento = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botonCerrar.current?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = desplazamiento
    }
  }, [abierto])

  function cerrar() {
    setAbierto(false)
    botonMenu.current?.focus()
  }

  async function handleLogout() {
    setSaliendo(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  const nombrePeluqueria = peluqueria || me?.peluqueria || ''
  const rol = me?.rol ?? null
  const pendientes = useSolicitudesPendientes(rol === 'dueño' || rol === 'recepcionista') ?? 0
  // Mientras se conoce el rol, solo las páginas que ven todos.
  const paginas = PAGINAS.filter((p) => (rol ? p.roles.includes(rol) : p.roles.length === 3)).map((p) =>
    p.href === '/comisiones' && rol === 'peluquero' ? { ...p, label: 'Mis comisiones' } : p
  )
  const actual = paginas.find((p) => p.href === paginaDe(pathname)?.href)

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={botonMenu}
              type="button"
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={abierto}
              aria-controls="menu-principal"
              className="relative rounded-xl p-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Icono nombre="menu" className="h-6 w-6" />
              {pendientes > 0 && (
                <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" />
              )}
            </button>
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
              <Image src="/logo_agenda_peluqueria.png" alt="Agenda Peluquerías" width={28} height={28} className="h-7 w-7 object-contain" />
              <span className="hidden font-semibold text-gray-800 sm:inline">Agenda Peluquerías</span>
            </Link>
            {actual && (
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
                <span aria-hidden className="text-gray-300">/</span>
                <span className="truncate font-medium text-gray-700">{actual.label}</span>
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {pendientes > 0 && (
              <Link
                href="/solicitudes"
                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Icono nombre="campana" className="h-4 w-4" />
                {pendientes}
                <span className="hidden sm:inline">por confirmar</span>
              </Link>
            )}
            {nombrePeluqueria && <span className="hidden text-sm text-gray-500 md:inline">{nombrePeluqueria}</span>}
          </div>
        </div>
      </header>

      {/* Fondo oscuro: tocarlo cierra el menú */}
      <div
        aria-hidden
        onClick={cerrar}
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="menu-principal"
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        inert={!abierto}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="flex items-center gap-2">
            <Image src="/logo_agenda_peluqueria.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-semibold text-gray-800">Agenda Peluquerías</span>
          </span>
          <button
            ref={botonCerrar}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            <Icono nombre="cerrar" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => {
            const delGrupo = paginas.filter((p) => p.grupo === grupo)
            if (delGrupo.length === 0) return null
            return (
              <div key={grupo} className="mb-5">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{grupo}</p>
                <ul className="space-y-0.5">
                  {delGrupo.map((p) => {
                    const activo = actual?.href === p.href
                    return (
                      <li key={p.href}>
                        <Link
                          href={p.href}
                          onClick={() => setAbierto(false)}
                          aria-current={activo ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            activo ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icono nombre={p.href} className={activo ? 'text-white' : 'text-gray-400'} />
                          <span className="flex-1">{p.label}</span>
                          {p.href === '/solicitudes' && pendientes > 0 && (
                            <span
                              aria-label={`${pendientes} por confirmar`}
                              className="rounded-full bg-blue-600 px-2 text-xs font-semibold leading-5 text-white"
                            >
                              {pendientes}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-gray-100 px-4 py-4">
          {me?.nombre && (
            <div className="mb-3 flex items-center gap-3 px-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {iniciales(me.nombre)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">{me.nombre}</span>
                <span className="block truncate text-xs text-gray-500">
                  {rol ? NOMBRE_ROL[rol] : ''}
                  {nombrePeluqueria && ` · ${nombrePeluqueria}`}
                </span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={saliendo}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Icono nombre="salir" />
            {saliendo ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}
