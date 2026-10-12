'use client'

import { useEffect } from 'react'

const MAXIMO_MS = 4_000
const AL_MOVER = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

/**
 * Al abrir Configuración con un ancla (por ejemplo #horarios, desde la guía
 * del dashboard), el navegador salta a la sección antes de que las de arriba
 * carguen sus datos; al crecer, la sección queda más abajo. Mientras la página
 * cambia de alto se vuelve a llevar a la vista, hasta que la persona mueva la
 * página o pasen unos segundos.
 */
export default function IrAlAncla() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    const destino = id ? document.getElementById(id) : null
    if (!destino) return

    const observador = new ResizeObserver(() => destino.scrollIntoView({ block: 'start' }))
    observador.observe(document.body)

    function soltar() {
      observador.disconnect()
      AL_MOVER.forEach((evento) => window.removeEventListener(evento, soltar))
    }
    AL_MOVER.forEach((evento) => window.addEventListener(evento, soltar, { passive: true }))
    const tiempo = setTimeout(soltar, MAXIMO_MS)

    return () => {
      clearTimeout(tiempo)
      soltar()
    }
  }, [])

  return null
}
