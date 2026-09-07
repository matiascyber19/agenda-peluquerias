'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { INPUT, LABEL, BOTON_CREAR, BOTON_SECUNDARIO } from './estilos'

export interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  duracion_minutos: number
  precio_clp: number
  activo: boolean
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
  servicio?: Servicio | null
}

export default function ModalServicio({ abierto, onCerrar, onGuardado, servicio }: Props) {
  const editando = Boolean(servicio)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [duracion, setDuracion] = useState('30')
  const [precio, setPrecio] = useState('0')

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(servicio?.nombre ?? '')
    setDescripcion(servicio?.descripcion ?? '')
    setDuracion(String(servicio?.duracion_minutos ?? 30))
    setPrecio(String(servicio?.precio_clp ?? 0))
    setError('')
  }, [abierto, servicio])

  async function guardar() {
    if (!nombre.trim()) return setError('Escribe el nombre del servicio')

    const duracionNum = Number(duracion)
    const precioNum = Number(precio)

    if (!Number.isInteger(duracionNum) || duracionNum <= 0) {
      return setError('La duración debe ser un número entero mayor que 0')
    }
    if (!Number.isInteger(precioNum) || precioNum < 0) {
      return setError('El precio debe ser un número entero mayor o igual a 0')
    }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch(
        editando ? `/api/servicios/${servicio!.id}` : '/api/servicios',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            duracion_minutos: duracionNum,
            precio_clp: precioNum,
          }),
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar el servicio')
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
      titulo={editando ? 'Editar servicio' : 'Nuevo servicio'}
      descripcion={editando ? undefined : 'Define un servicio que ofrece tu peluquería'}
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
          <label htmlFor="nombreServicio" className={LABEL}>Nombre</label>
          <input
            id="nombreServicio"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Corte de cabello"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="descripcionServicio" className={LABEL}>Descripción (opcional)</label>
          <input
            id="descripcionServicio"
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Incluye lavado y peinado"
            className={INPUT}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="duracionServicio" className={LABEL}>Duración (minutos)</label>
            <input
              id="duracionServicio"
              type="number"
              min={1}
              step={1}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="precioServicio" className={LABEL}>Precio (CLP)</label>
            <input
              id="precioServicio"
              type="number"
              min={0}
              step={1}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={BOTON_CREAR}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear servicio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
