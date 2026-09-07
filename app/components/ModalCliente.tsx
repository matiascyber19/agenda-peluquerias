'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { INPUT, LABEL, BOTON_CREAR, BOTON_SECUNDARIO } from './estilos'

export interface ClienteEditable {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  como_llego: string | null
  notas: string | null
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
  /** Si viene, el modal edita ese cliente (PATCH); si no, crea uno nuevo (POST). */
  cliente?: ClienteEditable | null
}

export default function ModalCliente({ abierto, onCerrar, onGuardado, cliente }: Props) {
  const editando = Boolean(cliente)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [cumpleanos, setCumpleanos] = useState('')
  const [comoLlego, setComoLlego] = useState('')
  const [notas, setNotas] = useState('')

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(cliente?.nombre ?? '')
    setTelefono(cliente?.telefono ?? '')
    setEmail(cliente?.email ?? '')
    setCumpleanos(cliente?.cumpleanos ?? '')
    setComoLlego(cliente?.como_llego ?? '')
    setNotas(cliente?.notas ?? '')
    setError('')
  }, [abierto, cliente])

  async function guardar() {
    if (!nombre.trim()) return setError('Escribe el nombre del cliente')
    if (telefono.replace(/\D/g, '').length < 8) {
      return setError('El teléfono debe tener al menos 8 dígitos')
    }

    setGuardando(true)
    setError('')

    const cuerpo = {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || null,
      cumpleanos: cumpleanos || null,
      como_llego: comoLlego.trim() || null,
      notas: notas.trim() || null,
    }

    try {
      const res = await fetch(
        editando ? `/api/clientes/${cliente!.id}` : '/api/clientes',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar el cliente')
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
      titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion={editando ? undefined : 'Agrega un cliente a tu peluquería'}
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
          <label htmlFor="nombre" className={LABEL}>Nombre</label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan González"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="telefono" className={LABEL}>Teléfono</label>
          <input
            id="telefono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+56 9 1234 5678"
            className={INPUT}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={LABEL}>Correo (opcional)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@correo.cl"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="cumpleanos" className={LABEL}>Cumpleaños (opcional)</label>
            <input
              id="cumpleanos"
              type="date"
              value={cumpleanos}
              onChange={(e) => setCumpleanos(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="comoLlego" className={LABEL}>¿Cómo llegó? (opcional)</label>
          <input
            id="comoLlego"
            type="text"
            value={comoLlego}
            onChange={(e) => setComoLlego(e.target.value)}
            placeholder="Instagram, recomendación, pasaba por fuera..."
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="notasCliente" className={LABEL}>Notas (opcional)</label>
          <textarea
            id="notasCliente"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Alergias, preferencias de corte, etc."
            className={INPUT}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={BOTON_CREAR}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
