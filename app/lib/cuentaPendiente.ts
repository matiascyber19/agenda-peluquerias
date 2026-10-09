import type { createClient } from './supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

// Con la confirmación de correo activada en Supabase, crear la cuenta no abre
// sesión: el registro de la peluquería o la aceptación de la invitación no
// alcanzan a hacerse. Por eso quedan anotados en los metadatos de la cuenta
// (`registro_pendiente` o `invitacion_pendiente`) y se terminan aquí, apenas
// hay sesión: al confirmar el correo (/auth/confirmar) o al iniciar sesión.
// Las funciones de la base validan todo (token vigente, slug libre), así que
// no hay riesgo en leer esos metadatos.

const DESACTIVADA = 'Tu cuenta fue desactivada. Habla con el dueño de la peluquería.'
const SIN_PELUQUERIA =
  'Tu cuenta no pertenece a ninguna peluquería. Si te invitaron, abre de nuevo el enlace de invitación; si es tu negocio, créalo con este mismo correo.'

/** Pasa el error de la base a un mensaje para la persona. */
function mensajeDe(error: { code?: string; message: string }, porDefecto: string) {
  // La función dice que ya pertenece a una peluquería, pero la cuenta no la
  // ve: está desactivada (RLS le oculta su propia fila).
  if (/ya (pertenece|tiene una peluquería)/.test(error.message)) return DESACTIVADA
  return error.code === 'P0001' ? error.message : porDefecto
}

/**
 * Deja lista la cuenta con sesión: si todavía no pertenece a una peluquería,
 * termina el registro o la invitación pendiente. Devuelve { lista: true } o
 * { lista: false, error } con un mensaje para mostrar. `sinPeluqueria` indica
 * que no había nada pendiente: la persona puede crear su peluquería.
 */
export async function completarCuentaPendiente(
  supabase: Supabase
): Promise<{ lista: boolean; error?: string; sinPeluqueria?: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { lista: false, error: 'No autenticado' }

  const { data: usuario } = await supabase.from('usuarios').select('id').eq('id', user.id).maybeSingle()
  if (usuario) return { lista: true }

  const meta = user.user_metadata ?? {}

  const invitacion = meta.invitacion_pendiente
  if (invitacion?.token) {
    const { error } = await supabase.rpc('invitacion_aceptar', {
      p_token: invitacion.token,
      p_nombre: invitacion.nombre ?? '',
    })
    if (error) return { lista: false, error: mensajeDe(error, 'No pudimos terminar de unirte al equipo') }
    return { lista: true }
  }

  const registro = meta.registro_pendiente
  if (registro?.slug) {
    const { error } = await supabase.rpc('registrar_peluqueria', {
      p_nombre_peluqueria: registro.nombre_peluqueria,
      p_slug: registro.slug,
      p_nombre_usuario: registro.nombre_usuario,
    })
    if (error) {
      const mensaje = /duplicate|unique|slug/i.test(error.message)
        ? 'El enlace de tu peluquería ya lo usa otra. Escríbenos para elegir otro.'
        : mensajeDe(error, 'No pudimos terminar de registrar tu peluquería')
      return { lista: false, error: mensaje }
    }
    return { lista: true }
  }

  return { lista: false, error: SIN_PELUQUERIA, sinPeluqueria: true }
}

/** Dónde vuelve el enlace de confirmación de correo que manda Supabase. */
export function urlDeConfirmacion(request: Request) {
  return `${new URL(request.url).origin}/auth/confirmar?next=/dashboard`
}
