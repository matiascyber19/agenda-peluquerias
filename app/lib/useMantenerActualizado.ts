import { useEffect, useEffectEvent } from 'react'

// Cambiar de pestaña dispara a la vez `focus` y `visibilitychange`: dentro de
// este margen se cuenta como una sola vuelta.
const MARGEN_MS = 2_000

/**
 * Vuelve a pedir los datos apenas la persona regresa a esta pestaña o ventana,
 * y cada `cadaMs` mientras la página está a la vista. Con la pestaña oculta no
 * consulta. Así una reserva o un cambio hecho en otro lado aparece sin recargar.
 *
 * `refrescar` debería actualizar en silencio, sin mostrar "Cargando...".
 * La primera carga sigue a cargo de cada página.
 */
export function useMantenerActualizado(refrescar: () => void, cadaMs: number) {
  const alRefrescar = useEffectEvent(refrescar)

  useEffect(() => {
    let ultima = Date.now()
    const refrescarSiSeVe = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultima < MARGEN_MS) return
      ultima = Date.now()
      alRefrescar()
    }

    const intervalo = setInterval(refrescarSiSeVe, cadaMs)
    document.addEventListener('visibilitychange', refrescarSiSeVe)
    window.addEventListener('focus', refrescarSiSeVe)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', refrescarSiSeVe)
      window.removeEventListener('focus', refrescarSiSeVe)
    }
  }, [cadaMs])
}
