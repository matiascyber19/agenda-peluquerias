import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import type { PeluqueriaPublica } from '@/app/lib/reserva'
import ReservaCliente from './ReservaCliente'

type Props = { params: Promise<{ slug: string }> }

// Una sola consulta por visita: la comparten generateMetadata y la página.
const obtenerPeluqueria = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('reserva_peluqueria', { p_slug: slug })
  return (data ?? null) as PeluqueriaPublica | null
})

// El título y la descripción aparecen al compartir el enlace por WhatsApp o Instagram.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const peluqueria = await obtenerPeluqueria(slug)
  if (!peluqueria) return { title: 'Peluquería no encontrada' }
  return {
    title: `Reserva en ${peluqueria.nombre}`,
    description: `Elige tu servicio y tu hora en ${peluqueria.nombre}.`,
  }
}

export default async function ReservarPage({ params }: Props) {
  const { slug } = await params
  const peluqueria = await obtenerPeluqueria(slug)
  if (!peluqueria) notFound()

  return <ReservaCliente slug={slug} peluqueria={peluqueria} />
}
