// Reserva en línea: tipos compartidos entre las rutas /api/reservar y la página
// pública, y el enlace de WhatsApp.

export interface ServicioPublico {
  id: string
  nombre: string
  descripcion: string | null
  duracion_minutos: number
  precio_clp: number
}

export interface PeluqueriaPublica {
  nombre: string
  telefono: string | null
  direccion: string | null
  comuna: string | null
  servicios: ServicioPublico[]
  peluqueros: { id: string; nombre: string }[]
}

/** `inicio` es el instante exacto que se envía al reservar; `hora` es "HH:MM" en Chile. */
export interface HoraLibre {
  inicio: string
  hora: string
}

export interface ResumenReserva {
  cita_id: string
  inicio: string
  fin: string
  peluquero: string
  servicios: { nombre: string; duracion_minutos: number; precio_clp: number }[]
  total_clp: number
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Traduce un error de las funciones de reserva a una respuesta. Los RAISE
 * EXCEPTION de la migración 003 (código P0001) son mensajes pensados para el
 * cliente; cualquier otro error se oculta tras un mensaje genérico.
 */
export function errorDeReserva(error: { code?: string; message: string }) {
  if (error.code === 'P0001') {
    const horaTomada = error.message.startsWith('Esa hora ya no está disponible')
    return { mensaje: error.message, status: horaTomada ? 409 : 400 }
  }
  return { mensaje: 'No pudimos procesar la reserva. Intenta de nuevo.', status: 500 }
}

/** Enlace de WhatsApp a un número chileno, con un mensaje opcional ya escrito. */
export function enlaceWhatsApp(telefono: string, texto?: string) {
  let digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 9) digitos = `56${digitos}` // 9 1234 5678 → 56 9 1234 5678
  if (digitos.length === 8) digitos = `569${digitos}` // celular antiguo de 8 dígitos
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
