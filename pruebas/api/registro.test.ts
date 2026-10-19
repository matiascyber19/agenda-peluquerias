import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post, respuesta, supabaseFalso, type Escenario, type SupabaseFalso } from './supabaseFalso'

vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/app/lib/supabase/server'
import { POST } from '@/app/api/auth/register/route'

// POST /api/auth/register: crear la cuenta del dueño y su peluquería. Una
// cuenta que ya existe sin peluquería (una invitación que no terminó, un
// intento anterior) puede registrar la suya con la misma contraseña.

const DATOS = {
  nombre_peluqueria: 'Barbería Juan',
  slug: 'barberia-juan',
  nombre_usuario: 'Juan',
  email: 'Juan@Correo.cl',
  password: 'secreta123',
}

let sb: SupabaseFalso
function escenario(e: Escenario) {
  sb = supabaseFalso(e)
  vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>)
}
const registrar = async (datos: Record<string, unknown> = DATOS) => respuesta(await POST(post('/api/auth/register', datos)))

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/register', () => {
  it.each([
    ['faltan campos', { ...DATOS, nombre_peluqueria: '' }, /Complete los campos/],
    ['la dirección tiene mayúsculas o espacios', { ...DATOS, slug: 'Barbería Juan' }, /minúsculas, números y guiones/],
    ['la contraseña es corta', { ...DATOS, password: '123' }, /al menos 8 caracteres/],
  ])('rechaza si %s, sin crear la cuenta', async (_caso, datos, error) => {
    escenario({})
    const { status, json } = await registrar(datos)
    expect(status).toBe(400)
    expect(json.error).toMatch(error)
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })

  it('crea la cuenta con el correo en minúsculas y registra la peluquería', async () => {
    escenario({ rpc: { registrar_peluqueria: { data: 'pel-1' } } })
    expect(await registrar()).toMatchObject({ status: 200, json: { success: true, peluqueria_id: 'pel-1' } })
    expect(sb.auth.signUp.mock.calls[0][0].email).toBe('juan@correo.cl')
    expect(sb.rpc).toHaveBeenCalledWith('registrar_peluqueria', {
      p_nombre_peluqueria: 'Barbería Juan',
      p_slug: 'barberia-juan',
      p_nombre_usuario: 'Juan',
    })
  })

  it('una cuenta ya creada sin peluquería entra con su contraseña y registra la suya', async () => {
    escenario({
      errorAlRegistrarse: { code: 'user_already_exists', message: 'User already registered' },
      rpc: { registrar_peluqueria: { data: 'pel-2' } },
    })
    expect((await registrar()).status).toBe(200)
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'juan@correo.cl', password: 'secreta123' })
    expect(sb.rpc).toHaveBeenCalledWith('registrar_peluqueria', expect.anything())
  })

  it('una cuenta ya creada con otra contraseña no registra nada', async () => {
    escenario({
      errorAlRegistrarse: { code: 'user_already_exists', message: 'User already registered' },
      errorAlEntrar: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const { status, json } = await registrar()
    expect(status).toBe(409)
    expect(json.error).toMatch(/contraseña no coincide/)
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('una cuenta que ya tiene peluquería recibe un mensaje claro', async () => {
    escenario({
      errorAlRegistrarse: { code: 'user_already_exists', message: 'User already registered' },
      rpc: { registrar_peluqueria: { error: { code: 'P0001', message: 'El usuario ya tiene una peluquería asociada' } } },
    })
    expect(await registrar()).toEqual({
      status: 409,
      json: { error: 'Esa cuenta ya pertenece a una peluquería. Entra con ella desde el inicio de sesión.' },
    })
  })

  it('una dirección que ya usa otra peluquería se explica en español', async () => {
    escenario({ rpc: { registrar_peluqueria: { error: { code: '23505', message: 'duplicate key value violates unique constraint' } } } })
    expect(await registrar()).toEqual({ status: 409, json: { error: 'Esa dirección ya la usa otra peluquería. Prueba con otra.' } })
  })

  it('con la confirmación de correo activada responde "revisa tu correo" (202)', async () => {
    escenario({ registroSinSesion: true, errorAlEntrar: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    expect(await registrar()).toEqual({ status: 202, json: { confirmar: true } })
    expect(sb.auth.signUp.mock.calls[0][0].options?.data).toEqual({
      registro_pendiente: { nombre_peluqueria: 'Barbería Juan', slug: 'barberia-juan', nombre_usuario: 'Juan' },
    })
  })
})
