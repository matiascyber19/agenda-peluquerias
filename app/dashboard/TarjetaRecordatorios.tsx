'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useMantenerActualizado } from '../lib/useMantenerActualizado'

/**
 * Cuántos clientes con cita mañana faltan por avisar. No se muestra si mañana
 * no hay citas. Lleva a Recordatorios.
 */
export default function TarjetaRecordatorios() {
  const [cuenta, setCuenta] = useState<{ total: number; pendientes: number } | null>(null)

  const pedir = useCallback(() => {
    fetch('/api/recordatorios?dia=manana')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { citas: { enviado: boolean }[] } | null) => {
        if (!json) return
        setCuenta({ total: json.citas.length, pendientes: json.citas.filter((c) => !c.enviado).length })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    pedir()
  }, [pedir])

  useMantenerActualizado(pedir, 60_000)

  if (!cuenta || cuenta.total === 0) return null
  const pendientes = cuenta.pendientes > 0

  return (
    <Link
      href="/recordatorios"
      className={`block rounded-2xl border p-6 shadow-sm transition-colors ${
        pendientes ? 'border-green-200 bg-green-50 hover:bg-green-100' : 'border-gray-200/70 bg-white hover:bg-gray-50'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recordatorios para mañana</p>
      <p className={`mt-1 text-3xl font-bold ${pendientes ? 'text-green-700' : 'text-gray-900'}`}>
        {pendientes ? cuenta.pendientes : '✓'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {pendientes
          ? `${cuenta.pendientes === 1 ? 'cliente por avisar' : 'clientes por avisar'} de ${cuenta.total} · Enviar por WhatsApp →`
          : `Los ${cuenta.total} clientes de mañana ya están avisados`}
      </p>
    </Link>
  )
}
