import { useCallback, useEffect, useState } from 'react'
import { useMantenerActualizado } from './useMantenerActualizado'

// Evento con el que la página de Solicitudes avisa que respondió una, para que
// el Navbar y el dashboard actualicen el contador sin esperar.
const EVENTO_SOLICITUDES = 'solicitudes-actualizadas'

export function avisarCambioEnSolicitudes() {
  window.dispatchEvent(new Event(EVENTO_SOLICITUDES))
}

/**
 * Reservas en línea que esperan respuesta. Se consulta al montar, al volver a
 * la pestaña, cada 30 segundos y cuando se responde una. null mientras carga,
 * si la consulta falla o si `activo` es false (los peluqueros no responden
 * solicitudes).
 */
export function useSolicitudesPendientes(activo = true) {
  const [pendientes, setPendientes] = useState<number | null>(null)

  const cargar = useCallback(() => {
    if (!activo) return
    fetch('/api/solicitudes')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setPendientes(json.pendientes)
      })
      .catch(() => {})
  }, [activo])

  useEffect(() => {
    if (!activo) return
    cargar()
    window.addEventListener(EVENTO_SOLICITUDES, cargar)
    return () => window.removeEventListener(EVENTO_SOLICITUDES, cargar)
  }, [activo, cargar])

  useMantenerActualizado(cargar, 30_000)

  return activo ? pendientes : null
}
