import { useEffect, useState } from 'react'

// Evento con el que la página de Solicitudes avisa que respondió una, para que
// el Navbar y el dashboard actualicen el contador sin esperar al minuto.
const EVENTO_SOLICITUDES = 'solicitudes-actualizadas'

export function avisarCambioEnSolicitudes() {
  window.dispatchEvent(new Event(EVENTO_SOLICITUDES))
}

/**
 * Reservas en línea que esperan respuesta. Se consulta al montar, cada minuto
 * y cuando se responde una. null mientras carga o si la consulta falla.
 */
export function useSolicitudesPendientes() {
  const [pendientes, setPendientes] = useState<number | null>(null)

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      fetch('/api/solicitudes')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (vigente && json) setPendientes(json.pendientes)
        })
        .catch(() => {})
    }

    cargar()
    const intervalo = setInterval(cargar, 60_000)
    window.addEventListener(EVENTO_SOLICITUDES, cargar)
    return () => {
      vigente = false
      clearInterval(intervalo)
      window.removeEventListener(EVENTO_SOLICITUDES, cargar)
    }
  }, [])

  return pendientes
}
