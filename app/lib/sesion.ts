import { NextResponse } from 'next/server'
import type { createClient } from './supabase/server'
import { esRol, type Rol } from './roles'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Usuario con sesión, su peluquería, su rol y (si es peluquero) su ficha en
 * `peluqueros`. null si no hay sesión, si la cuenta no tiene peluquería o si
 * está desactivada (la base deja de mostrarle su propia fila).
 */
export async function usuarioConPeluqueria(supabase: Supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('peluqueria_id, rol')
    .eq('id', user.id)
    .maybeSingle()

  if (!usuario?.peluqueria_id || !esRol(usuario.rol)) return null

  let peluqueroId: string | null = null
  if (usuario.rol === 'peluquero') {
    const { data: ficha } = await supabase
      .from('peluqueros')
      .select('id')
      .eq('usuario_id', user.id)
      .maybeSingle()
    peluqueroId = ficha?.id ?? null
  }

  return {
    user,
    peluqueriaId: usuario.peluqueria_id as string,
    rol: usuario.rol as Rol,
    peluqueroId,
  }
}

/**
 * Para las rutas de la API: si la cuenta no tiene uno de esos roles, la
 * respuesta 401 o 403 lista para devolver; si lo tiene, null.
 */
export async function exigirRol(supabase: Supabase, roles: Rol[]) {
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!roles.includes(sesion.rol)) {
    return NextResponse.json({ error: 'Tu cuenta no tiene permiso para hacer esto' }, { status: 403 })
  }
  return null
}
