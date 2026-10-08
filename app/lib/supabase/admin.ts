import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con la clave secreta de Supabase: salta RLS, así que solo debe
 * usarse en el servidor y para lo indispensable. Hoy lo usa únicamente el
 * aviso por correo de una nueva solicitud, para leer el correo de la
 * peluquería sin exponerlo en una función pública.
 *
 * Devuelve null si SUPABASE_SECRET_KEY no está configurada.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY
  if (!url || !clave) return null

  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
