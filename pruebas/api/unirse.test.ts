import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post, respuesta, supabaseFalso, type Escenario, type SupabaseFalso } from './supabaseFalso'

vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/app/lib/supabase/server'
import { POST } from '@/app/api/auth/unirse/route'

// POST /api/auth/unirse: crear la cuenta con un enlace de invitación y quedar
// en el equipo. Si el correo ya tiene cuenta (por ejemplo, un intento
// anterior), entra con ella.

const TOKEN = 'b'.repeat(64)
const DATOS = { token: TOKEN, nombre: 'Diego', email: 'Diego@Correo.cl ', password: 'secreta123' }

let sb: SupabaseFalso
function escenario(e: Escenario) {
  sb = supabaseFalso(e)
  vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>)
}
const unirse = async (datos: Record<string, unknown> = DATOS) => respuesta(await POST(post('/api/auth/unirse', datos)))

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/unirse', () => {
  it.each([
    ['un token que no es de una invitación', { ...DATOS, token: 'falso' }, 'La invitación no es válida'],
    ['sin nombre', { ...DATOS, nombre: ' ' }, 'Escribe tu nombre'],
    ['un correo inválido', { ...DATOS, email: 'no-es-correo' }, 'Ingresa un correo válido'],
    ['una contraseña corta', { ...DATOS, password: '123' }, 'La contraseña debe tener entre 8 y 72 caracteres'],
  ])('rechaza %s sin crear nada', async (_caso, datos, error) => {
    escenario({})
    expect(await unirse(datos)).toEqual({ status: 400, json: { error } })
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })

  it('crea la cuenta (correo en minúsculas), anota la invitación y la acepta', async () => {
    escenario({ rpc: { invitacion_aceptar: { data: { peluqueria: 'Salón A', rol: 'peluquero' } } } })
    expect(await unirse()).toEqual({ status: 200, json: { success: true, peluqueria: 'Salón A', rol: 'peluquero' } })
    const [datos] = sb.auth.signUp.mock.calls[0]
    expect(datos.email).toBe('diego@correo.cl')
    expect(datos.options?.data).toEqual({ invitacion_pendiente: { token: TOKEN, nombre: 'Diego' } })
    expect(sb.rpc).toHaveBeenCalledWith('invitacion_aceptar', { p_token: TOKEN, p_nombre: 'Diego' })
  })

  it('si el correo ya tiene cuenta y la contraseña coincide, entra con ella y acepta la invitación', async () => {
    escenario({ errorAlRegistrarse: { code: 'user_already_exists', message: 'User already registered' } })
    expect((await unirse()).status).toBe(200)
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'diego@correo.cl', password: 'secreta123' })
    expect(sb.rpc).toHaveBeenCalledWith('invitacion_aceptar', expect.anything())
  })

  it('si el correo ya tiene cuenta y la contraseña no coincide, lo dice sin aceptar nada', async () => {
    escenario({
      errorAlRegistrarse: { code: 'user_already_exists', message: 'User already registered' },
      errorAlEntrar: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const { status, json } = await unirse()
    expect(status).toBe(409)
    expect(json.error).toMatch(/contraseña no coincide/)
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('con la confirmación de correo activada responde "revisa tu correo" (202)', async () => {
    escenario({ registroSinSesion: true, errorAlEntrar: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    expect(await unirse()).toEqual({ status: 202, json: { confirmar: true } })
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('si la base rechaza la invitación, muestra su mensaje', async () => {
    escenario({ rpc: { invitacion_aceptar: { error: { code: 'P0001', message: 'Ese peluquero ya tiene una cuenta' } } } })
    expect(await unirse()).toEqual({ status: 409, json: { error: 'Ese peluquero ya tiene una cuenta' } })
  })

  it('una contraseña débil para Supabase se explica en español', async () => {
    escenario({ errorAlRegistrarse: { code: 'weak_password', message: 'Password is too weak' } })
    const { status, json } = await unirse()
    expect(status).toBe(400)
    expect(json.error).toMatch(/muy débil/)
  })
})
