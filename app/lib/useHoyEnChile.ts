import { useSyncExternalStore } from 'react'
import { fechaEnChile } from './fechas'

// "Hoy" no cambia mientras la página está abierta: no hace falta suscribirse.
const sinSuscripcion = () => () => {}

/**
 * Hoy (AAAA-MM-DD) en Chile. Al renderizar en el servidor devuelve '': las
 * páginas estáticas se generan al compilar, y la fecha de ese momento no
 * sirve. El navegador completa el valor al hidratar, sin desajustes.
 */
export function useHoyEnChile() {
  return useSyncExternalStore(sinSuscripcion, () => fechaEnChile(new Date()), () => '')
}
