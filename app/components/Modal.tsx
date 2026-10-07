'use client'

import { useEffect } from 'react'

interface ModalProps {
  titulo: string
  descripcion?: string
  abierto: boolean
  onCerrar: () => void
  children: React.ReactNode
  ancho?: 'md' | 'lg' | 'xl'
}

const ANCHOS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function Modal({
  titulo,
  descripcion,
  abierto,
  onCerrar,
  children,
  ancho = 'lg',
}: ModalProps) {
  useEffect(() => {
    if (!abierto) return

    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionar)

    // Evita que el fondo haga scroll mientras el modal está abierto.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${ANCHOS[ancho]} my-8 rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="font-semibold text-gray-900">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-gray-500">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-xl leading-none text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
