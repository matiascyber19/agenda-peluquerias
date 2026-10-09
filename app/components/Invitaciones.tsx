'use client'

import { useState } from 'react'
import Modal from './Modal'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from './estilos'
import { esRol, NOMBRE_ROL } from '../lib/roles'

// Invitaciones al equipo: crearlas, compartir el enlace y anularlas. Las usan
// Equipo y Peluqueros.

export interface Invitacion {
  id: string
  token: string
  rol: string
  peluquero_id: string | null
  /** Nombre de la ficha de peluquero a la que se vincula; null si se crea al unirse. */
  peluquero: string | null
  vence_en: string
}

export function enlaceInvitacion(token: string) {
  return `${window.location.origin}/unirse/${token}`
}

function nombreRol(rol: string) {
  return esRol(rol) ? NOMBRE_ROL[rol] : rol
}

function formatearVence(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' })
}

/**
 * Crea una invitación. Sin `ficha`, la de peluquero crea su ficha al
 * unirse. Devuelve la invitación (con el nombre de la ficha, si la hay) o el
 * error para mostrar.
 */
export async function crearInvitacion(
  rol: 'peluquero' | 'recepcionista',
  ficha?: { id: string; nombre: string } | null
): Promise<{ invitacion: Invitacion } | { error: string }> {
  try {
    const res = await fetch('/api/equipo/invitaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rol === 'peluquero' && ficha ? { rol, peluquero_id: ficha.id } : { rol }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.invitacion) return { error: json.error ?? 'No pudimos crear la invitación' }
    return { invitacion: { ...json.invitacion, peluquero: ficha?.nombre ?? null } }
  } catch {
    return { error: 'No pudimos conectar con el servidor' }
  }
}

/** Abre WhatsApp con el mensaje de la invitación listo para enviar. */
function compartirPorWhatsApp(invitacion: Invitacion) {
  const texto = `Te invito a unirte al equipo como ${nombreRol(invitacion.rol).toLowerCase()}. Crea tu cuenta aquí: ${enlaceInvitacion(invitacion.token)}`
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
}

/** Botón que copia el enlace y avisa "Copiado" por dos segundos. */
function BotonCopiar({ token, className }: { token: string; className: string }) {
  const [estado, setEstado] = useState<'' | 'copiado' | 'error'>('')
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlaceInvitacion(token))
      setEstado('copiado')
    } catch {
      setEstado('error')
    }
    setTimeout(() => setEstado(''), 2000)
  }
  return (
    <button type="button" onClick={copiar} className={className}>
      {estado === 'copiado' ? 'Copiado ✓' : estado === 'error' ? 'No se pudo copiar' : 'Copiar enlace'}
    </button>
  )
}

/** Recién creada: el enlace a la vista, para enviarlo de inmediato. */
export function ModalInvitacionCreada({ invitacion, onCerrar }: { invitacion: Invitacion | null; onCerrar: () => void }) {
  if (!invitacion) return null
  const quien = invitacion.peluquero ?? `un ${nombreRol(invitacion.rol).toLowerCase()} nuevo`
  return (
    <Modal abierto titulo="Enlace listo para enviar" descripcion={`Invitación para ${quien}`} onCerrar={onCerrar} ancho="md">
      <div className="space-y-4">
        <input
          readOnly
          value={enlaceInvitacion(invitacion.token)}
          onFocus={(e) => e.target.select()}
          aria-label="Enlace de invitación"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => compartirPorWhatsApp(invitacion)}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Enviar por WhatsApp
          </button>
          <BotonCopiar token={invitacion.token} className={BOTON_SECUNDARIO} />
        </div>
        <ul className="space-y-1.5 text-sm text-gray-500">
          <li>• La persona abre el enlace, escribe su nombre, correo y contraseña, y entra de inmediato.</li>
          {invitacion.rol === 'peluquero' && !invitacion.peluquero && (
            <li>• Aparece sola en Peluqueros, donde puedes ajustar su comisión y su color en la agenda.</li>
          )}
          <li>• Sirve para una sola persona y vence el {formatearVence(invitacion.vence_en)}.</li>
        </ul>
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button type="button" onClick={onCerrar} className={BOTON_PRIMARIO}>
            Listo
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Invitaciones que nadie ha usado todavía, con WhatsApp, copiar y anular. */
export function ListaInvitaciones({
  invitaciones,
  onAnulada,
  onError,
}: {
  invitaciones: Invitacion[]
  onAnulada: () => void
  onError: (mensaje: string) => void
}) {
  const [anulando, setAnulando] = useState('')

  async function anular(id: string) {
    setAnulando(id)
    try {
      const res = await fetch(`/api/equipo/invitaciones/${id}`, { method: 'DELETE' }).catch(() => null)
      if (!res?.ok) {
        const json = await res?.json().catch(() => ({}))
        onError(json?.error ?? 'No pudimos anular la invitación')
        return
      }
      onAnulada()
    } finally {
      setAnulando('')
    }
  }

  return (
    <ul className="space-y-3">
      {invitaciones.map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium text-gray-800">
              {nombreRol(inv.rol)}
              {inv.peluquero ? ` · ${inv.peluquero}` : inv.rol === 'peluquero' ? ' nuevo' : ''}
            </span>
            <span className="block text-xs text-gray-400">Esperando que se una · vence el {formatearVence(inv.vence_en)}</span>
          </span>
          <button type="button" onClick={() => compartirPorWhatsApp(inv)} className={BOTON_SECUNDARIO}>
            WhatsApp
          </button>
          <BotonCopiar token={inv.token} className={BOTON_SECUNDARIO} />
          <button
            type="button"
            onClick={() => anular(inv.id)}
            disabled={anulando === inv.id}
            className="text-sm text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            {anulando === inv.id ? 'Anulando...' : 'Anular'}
          </button>
        </li>
      ))}
    </ul>
  )
}
