'use client'

import { useEffect, useState } from 'react'
import { INPUT, LABEL, BOTON_PRIMARIO, BOTON_SECUNDARIO } from '../components/estilos'

interface Configuracion {
  peluqueria: { nombre: string; slug: string; email: string | null; telefono: string | null }
  emailCuenta: string | null
}

/** Correo de avisos, WhatsApp de la peluquería y enlace público de reservas. */
export default function SeccionContacto() {
  const [cargando, setCargando] = useState(true)
  // Si la carga falla no se muestra el formulario: guardarlo vacío borraría los datos.
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [emailCuenta, setEmailCuenta] = useState<string | null>(null)
  const [enlace, setEnlace] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No pudimos cargar la configuración')
        return json as Configuracion
      })
      .then(({ peluqueria, emailCuenta }) => {
        setEmail(peluqueria.email ?? '')
        setTelefono(peluqueria.telefono ?? '')
        setEmailCuenta(emailCuenta)
        setEnlace(`${window.location.origin}/reservar/${peluqueria.slug}`)
        setCargado(true)
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  async function guardar() {
    setGuardando(true)
    setGuardado(false)
    setError('')
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), telefono: telefono.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No pudimos guardar los datos de contacto')
        return
      }
      setGuardado(true)
    } catch {
      setError('No pudimos conectar con el servidor')
    } finally {
      setGuardando(false)
    }
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No pudimos copiar el enlace; cópialo a mano')
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-800">Contacto y reservas</h2>
      <p className="mt-1 text-sm text-gray-500">Cómo te avisamos de una reserva y cómo te contactan tus clientes</p>

      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando...</p>
      ) : !cargado ? (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="emailAvisos" className={LABEL}>Correo de avisos</label>
              <input
                id="emailAvisos"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setGuardado(false)
                }}
                placeholder={emailCuenta ?? 'avisos@tupeluqueria.cl'}
                className={INPUT}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Aquí llegan las nuevas reservas en línea.
                {!email && emailCuenta && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => setEmail(emailCuenta)}
                      className="font-medium text-slate-700 hover:underline"
                    >
                      Usar {emailCuenta}
                    </button>
                  </>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="whatsapp" className={LABEL}>WhatsApp de la peluquería</label>
              <input
                id="whatsapp"
                type="tel"
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value)
                  setGuardado(false)
                }}
                placeholder="+56 9 1234 5678"
                className={INPUT}
              />
              <p className="mt-1.5 text-xs text-gray-400">Se muestra en tu página de reservas.</p>
            </div>
          </div>

          <div>
            <span className={LABEL}>Enlace de reservas</span>
            <div className="flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                {enlace}
              </code>
              <button type="button" onClick={copiarEnlace} className={BOTON_SECUNDARIO}>
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </button>
              <a href={enlace} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}>
                Abrir
              </a>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Compártelo en Instagram o WhatsApp para que tus clientes reserven solos.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            {guardado && <span className="text-sm text-green-600">Guardado ✓</span>}
            <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
