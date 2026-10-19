import { describe, expect, it } from 'vitest'
import { mensajeRecordatorio } from '@/app/lib/recordatorios'
import { enlaceWhatsApp } from '@/app/lib/reserva'

describe('enlace de WhatsApp a un número chileno', () => {
  it.each([
    ['+56 9 1234 5678', '56912345678'],
    ['9 1234 5678', '56912345678'],
    ['912345678', '56912345678'],
    ['56912345678', '56912345678'],
    ['1234 5678', '56912345678'], // celular antiguo de 8 dígitos
  ])('%s → wa.me/%s', (telefono, numero) => {
    expect(enlaceWhatsApp(telefono)).toBe(`https://wa.me/${numero}`)
  })

  it('lleva el mensaje codificado', () => {
    expect(enlaceWhatsApp('912345678', 'Hola & chao')).toBe('https://wa.me/56912345678?text=Hola%20%26%20chao')
  })
})

describe('mensaje del recordatorio', () => {
  it('trae el primer nombre, el día, la hora, el peluquero, los servicios y la dirección', () => {
    const texto = mensajeRecordatorio({
      cliente: 'Camila Rojas',
      peluqueria: 'Peluquería Test',
      direccion: 'Av. Providencia 1234',
      comuna: 'Providencia',
      dia: 'manana',
      inicio: '2026-10-18T13:00:00Z',
      hora: '10:00',
      peluquero: 'Matías',
      servicios: 'Corte + barba',
    })
    expect(texto).toBe(
      [
        'Hola Camila 👋 Te recordamos tu hora en *Peluquería Test* para mañana, domingo 18 de octubre, a las *10:00* con Matías (Corte + barba).',
        '📍 Av. Providencia 1234, Providencia',
        'Si no puedes venir, avísanos respondiendo este mensaje. ¡Te esperamos!',
      ].join('\n')
    )
  })

  it('sin peluquero, servicios ni dirección no deja huecos', () => {
    const texto = mensajeRecordatorio({
      cliente: 'Pedro',
      peluqueria: 'Barbería X',
      dia: 'hoy',
      inicio: '2026-10-17T21:30:00Z',
      hora: '18:30',
    })
    expect(texto).toBe(
      'Hola Pedro 👋 Te recordamos tu hora en *Barbería X* para hoy, sábado 17 de octubre, a las *18:30*.\n' +
        'Si no puedes venir, avísanos respondiendo este mensaje. ¡Te esperamos!'
    )
  })
})
