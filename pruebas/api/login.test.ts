import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post, respuesta, supabaseFalso, type Escenario, type SupabaseFalso } from './supabaseFalso'

vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/app/lib/supabase/server'
import { POST } from '@/app/api/auth/login/route'

// POST /api/auth/login. El 9 de octubre el login quedaba en "Ingresando…" con
// una cuenta sin peluquería: la ruta respondía bien y después el panel la
// rechazaba. Ahora tiene que responder el motivo y cerrar la sesión.

let sb: SupabaseFalso
function escenario(e: Escenario) {
  sb = supabaseFalso(e)
  vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>)
}
const entrar = async () => respuesta(await POST(post('/api/auth/login', { email: 'persona@correo.cl', password: 'secreta123' })))

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/login', () => {
  it('con una cuenta que pertenece a una peluquería, entra', async () => {
    escenario({ enPeluqueria: true })
    expect(await entrar()).toEqual({ status: 200, json: { ok: true } })
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })

  it('con la contraseña incorrecta responde 401 en español', async () => {
    escenario({ errorAlEntrar: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    expect(await entrar()).toEqual({ status: 401, json: { error: 'Correo o contraseña incorrectos' } })
  })

  it('con el correo sin confirmar lo dice', async () => {
    escenario({ errorAlEntrar: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    const { status, json } = await entrar()
    expect(status).toBe(401)
    expect(json.error).toMatch(/Confirma tu correo/)
  })

  it('una cuenta sin peluquería ni nada pendiente recibe el motivo, se le ofrece crear una y se cierra la sesión', async () => {
    escenario({ enPeluqueria: false })
    const { status, json } = await entrar()
    expect(status).toBe(403)
    expect(json.sinPeluqueria).toBe(true)
    expect(json.error).toMatch(/no pertenece a ninguna peluquería/)
    expect(sb.auth.signOut).toHaveBeenCalledOnce()
  })

  it('una invitación que quedó pendiente se acepta al entrar', async () => {
    escenario({
      enPeluqueria: false,
      cuenta: { id: 'c1', user_metadata: { invitacion_pendiente: { token: 'a'.repeat(64), nombre: 'Diego' } } },
    })
    expect(await entrar()).toEqual({ status: 200, json: { ok: true } })
    expect(sb.rpc).toHaveBeenCalledWith('invitacion_aceptar', { p_token: 'a'.repeat(64), p_nombre: 'Diego' })
  })

  it('si la invitación pendiente ya no sirve, lo explica y cierra la sesión', async () => {
    escenario({
      enPeluqueria: false,
      cuenta: { id: 'c1', user_metadata: { invitacion_pendiente: { token: 'a'.repeat(64), nombre: 'Diego' } } },
      rpc: { invitacion_aceptar: { error: { code: 'P0001', message: 'La invitación no es válida o ya venció. Pide una nueva.' } } },
    })
    expect(await entrar()).toMatchObject({ status: 403, json: { error: 'La invitación no es válida o ya venció. Pide una nueva.' } })
    expect(sb.auth.signOut).toHaveBeenCalledOnce()
  })

  it('una cuenta desactivada (la base ya no le muestra su fila) recibe ese motivo', async () => {
    escenario({
      enPeluqueria: false,
      cuenta: { id: 'c1', user_metadata: { invitacion_pendiente: { token: 'a'.repeat(64), nombre: 'Diego' } } },
      rpc: { invitacion_aceptar: { error: { code: 'P0001', message: 'Esta cuenta ya pertenece a una peluquería' } } },
    })
    const { json } = await entrar()
    expect(json.error).toMatch(/desactivada/)
  })

  it('un registro de peluquería pendiente se termina al entrar', async () => {
    escenario({
      enPeluqueria: false,
      cuenta: { id: 'c1', user_metadata: { registro_pendiente: { nombre_peluqueria: 'Mi Pelu', slug: 'mi-pelu', nombre_usuario: 'Ana' } } },
    })
    expect(await entrar()).toEqual({ status: 200, json: { ok: true } })
    expect(sb.rpc).toHaveBeenCalledWith('registrar_peluqueria', {
      p_nombre_peluqueria: 'Mi Pelu',
      p_slug: 'mi-pelu',
      p_nombre_usuario: 'Ana',
    })
  })
})
