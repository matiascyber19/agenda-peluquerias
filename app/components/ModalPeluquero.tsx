'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { INPUT, LABEL, BOTON_CREAR, BOTON_SECUNDARIO } from './estilos'

export interface Peluquero {
  id: string
  nombre: string
  telefono: string | null
  tipo_contrato: string
  porcentaje_comision: number
  color_agenda: string
  activo: boolean
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
  peluquero?: Peluquero | null
}

const CONTRATOS = [
  { valor: 'fijo', label: 'Sueldo fijo' },
  { valor: 'comision', label: 'Comisión' },
  { valor: 'arriendo_sillon', label: 'Arriendo de sillón' },
]

// Paleta sugerida para distinguir peluqueros en la grilla de la agenda.
const COLORES = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#14b8a6']

export default function ModalPeluquero({ abierto, onCerrar, onGuardado, peluquero }: Props) {
  const editando = Boolean(peluquero)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [contrato, setContrato] = useState('fijo')
  const [comision, setComision] = useState('0')
  const [color, setColor] = useState(COLORES[0])

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(peluquero?.nombre ?? '')
    setTelefono(peluquero?.telefono ?? '')
    setContrato(peluquero?.tipo_contrato ?? 'fijo')
    setComision(String(peluquero?.porcentaje_comision ?? 0))
    setColor(peluquero?.color_agenda ?? COLORES[0])
    setError('')
  }, [abierto, peluquero])

  async function guardar() {
    if (!nombre.trim()) return setError('Escribe el nombre del peluquero')

    if (telefono.trim() && telefono.replace(/\D/g, '').length < 8) {
      return setError('El teléfono debe tener al menos 8 dígitos')
    }

    const comisionNum = Number(comision)
    if (!Number.isInteger(comisionNum) || comisionNum < 0 || comisionNum > 100) {
      return setError('La comisión debe ser un número entero entre 0 y 100')
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return setError('El color debe estar en formato hexadecimal, por ejemplo #3B82F6')
    }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch(
        editando ? `/api/peluqueros/${peluquero!.id}` : '/api/peluqueros',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            telefono: telefono.trim() || null,
            tipo_contrato: contrato,
            porcentaje_comision: comisionNum,
            color_agenda: color,
          }),
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar el peluquero')
        setGuardando(false)
        return
      }

      onGuardado()
      onCerrar()
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar peluquero' : 'Nuevo peluquero'}
      descripcion={editando ? undefined : 'Agrega a alguien del equipo'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div>
          <label htmlFor="nombrePeluquero" className={LABEL}>Nombre</label>
          <input
            id="nombrePeluquero"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="María Pérez"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="telefonoPeluquero" className={LABEL}>Teléfono (opcional)</label>
          <input
            id="telefonoPeluquero"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+56 9 1234 5678"
            className={INPUT}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contrato" className={LABEL}>Tipo de contrato</label>
            <select
              id="contrato"
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
              className={INPUT}
            >
              {CONTRATOS.map((c) => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="comision" className={LABEL}>Comisión (%)</label>
            <input
              id="comision"
              type="number"
              min={0}
              max={100}
              step={1}
              value={comision}
              onChange={(e) => setComision(e.target.value)}
              disabled={contrato !== 'comision'}
              className={`${INPUT} disabled:opacity-50`}
            />
            {contrato !== 'comision' && (
              <p className="mt-1 text-xs text-gray-400">Solo aplica al contrato por comisión</p>
            )}
          </div>
        </div>

        <div>
          <span className={LABEL}>Color en la agenda</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Color personalizado"
              className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"
            />
            <div className="flex gap-2">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Elegir color ${c}`}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    color.toLowerCase() === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={BOTON_CREAR}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear peluquero'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
