import type { createClient } from './supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Usuario con sesión y su peluquería, o null si no hay sesión o el usuario
 * no tiene peluquería asociada.
 */
export async function usuarioConPeluqueria(supabase: Supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('peluqueria_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!usuario?.peluqueria_id) return null
  return { user, peluqueriaId: usuario.peluqueria_id as string }
}
