'use client'

import { nombreDelMes, sumarMeses } from '../lib/fechas'

const BOTON =
  'rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'

/** Flechas para recorrer los meses (AAAA-MM). */
export default function SelectorMes({ mes, onCambiar }: { mes: string; onCambiar: (mes: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onCambiar(sumarMeses(mes, -1))} className={BOTON} aria-label="Mes anterior">
        ←
      </button>
      <span className="min-w-36 text-center text-sm font-semibold text-gray-800 first-letter:uppercase">
        {nombreDelMes(mes)}
      </span>
      <button type="button" onClick={() => onCambiar(sumarMeses(mes, 1))} className={BOTON} aria-label="Mes siguiente">
        →
      </button>
    </div>
  )
}
