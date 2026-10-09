import type { Metadata } from 'next'
import { createClient } from '@/app/lib/supabase/server'
import TarjetaAcceso from '@/app/components/TarjetaAcceso'
import FormularioUnirse from './FormularioUnirse'

type Props = { params: Promise<{ token: string }> }

interface Invitacion {
  peluqueria: string
  rol: 'peluquero' | 'recepcionista'
  peluquero: string | null
  vigente: boolean
}

export const metadata: Metadata = {
  title: 'Únete al equipo',
  // Es un enlace personal: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
}

export default async function UnirsePage({ params }: Props) {
  const { token } = await params
  let invitacion: Invitacion | null = null
  if (/^[0-9a-f]{64}$/.test(token)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('invitacion_ver', { p_token: token })
    invitacion = (data ?? null) as Invitacion | null
  }

  if (!invitacion || !invitacion.vigente) {
    return (
      <TarjetaAcceso titulo="Invitación no válida">
        <p className="text-sm text-gray-600">
          Este enlace no existe, ya se usó o venció. Pídele al dueño de la peluquería que te envíe uno nuevo.
        </p>
      </TarjetaAcceso>
    )
  }

  return (
    <TarjetaAcceso titulo={`Únete a ${invitacion.peluqueria}`}>
      <p className="mb-5 text-sm text-gray-500">
        Te invitaron como <span className="font-semibold text-gray-700">{invitacion.rol}</span>
        {invitacion.peluquero && ` (${invitacion.peluquero})`}. Crea tu cuenta para entrar.
      </p>
      <FormularioUnirse token={token} nombreSugerido={invitacion.peluquero ?? ''} />
    </TarjetaAcceso>
  )
}
