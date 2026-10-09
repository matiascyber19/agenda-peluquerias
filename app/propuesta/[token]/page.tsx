import { cache } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/app/lib/supabase/server'
import RespuestaPropuesta, { type Propuesta } from './RespuestaPropuesta'

type Props = { params: Promise<{ token: string }> }

// Una sola consulta por visita: la comparten generateMetadata y la página.
const obtenerPropuesta = cache(async (token: string) => {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('propuesta_ver', { p_token: token })
  return (data ?? null) as Propuesta | null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const propuesta = await obtenerPropuesta(token)
  return {
    title: propuesta ? `Tu hora en ${propuesta.peluqueria}` : 'Enlace no válido',
    // Es un enlace personal: no debe aparecer en buscadores.
    robots: { index: false, follow: false },
  }
}

export default async function PropuestaPage({ params }: Props) {
  const { token } = await params
  const propuesta = await obtenerPropuesta(token)

  if (!propuesta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <p className="max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Este enlace no es válido. Si te lo envió una peluquería, pídele que te lo mande de nuevo.
        </p>
      </div>
    )
  }

  return <RespuestaPropuesta token={token} propuesta={propuesta} />
}
