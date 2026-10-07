'use client'

import { useState } from 'react'
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
  /** Cliente a editar. Los clientes nuevos se crean al reservar o desde "Nueva cita". */
  cliente: ClienteEditable
}

// El formulario se monta cada vez que el modal se abre, así parte con los datos
// del cliente sin tener que resetearlo en un efecto.
export default function ModalCliente({ abierto, ...props }: Props) {
  if (!abierto) return null
  return <FormularioCliente key={props.cliente.id} {...props} />
}

function FormularioCliente({ onCerrar, onGuardado, cliente }: Omit<Props, 'abierto'>) {
  const [nombre, setNombre] = useState(cliente.nombre)
  const [telefono, setTelefono] = useState(cliente.telefono ?? '')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [cumpleanos, setCumpleanos] = useState(cliente.cumpleanos ?? '')
  const [comoLlego, setComoLlego] = useState(cliente.como_llego ?? '')
  const [notas, setNotas] = useState(cliente.notas ?? '')

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

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
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })

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
    <Modal titulo="Editar cliente" abierto onCerrar={onCerrar}>
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
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
