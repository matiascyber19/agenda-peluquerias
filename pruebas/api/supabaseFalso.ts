import { vi } from 'vitest'

// Supabase simulado para probar las rutas de la API sin conectarse a nada.
// Cada prueba dice cómo responde Auth y la base; las rutas corren tal cual.

type ErrorSupabase = { code?: string; message: string }
type Credenciales = { email: string; password: string }
type DatosRegistro = Credenciales & { options?: { data?: Record<string, unknown> } }

export interface Escenario {
  /** La cuenta con sesión después de entrar (null: no hay sesión). */
  cuenta?: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null
  /** La cuenta ya tiene su fila en `usuarios` (pertenece a una peluquería y está activa). */
  enPeluqueria?: boolean
  /** Error de signInWithPassword; sin él, entra. */
  errorAlEntrar?: ErrorSupabase
  /** Error de signUp; sin él, crea la cuenta. */
  errorAlRegistrarse?: ErrorSupabase
  /** signUp sin sesión (con la confirmación de correo activada). */
  registroSinSesion?: boolean
  /** Respuestas de las funciones de la base, por nombre. */
  rpc?: Record<string, { data?: unknown; error?: ErrorSupabase }>
}

export function supabaseFalso(e: Escenario = {}) {
  const cuenta = e.cuenta === undefined ? { id: 'cuenta-1', email: 'persona@correo.cl', user_metadata: {} } : e.cuenta

  // Solo se consulta `usuarios` (para saber si la cuenta ya tiene peluquería)
  const usuarios = {
    select: vi.fn(() => usuarios),
    eq: vi.fn(() => usuarios),
    maybeSingle: vi.fn(async () => ({ data: e.enPeluqueria && cuenta ? { id: cuenta.id } : null, error: null })),
  }

  return {
    auth: {
      signInWithPassword: vi.fn<(credenciales: Credenciales) => Promise<unknown>>(async () =>
        e.errorAlEntrar
          ? { data: { user: null, session: null }, error: e.errorAlEntrar }
          : { data: { user: cuenta, session: {} }, error: null }
      ),
      signUp: vi.fn<(datos: DatosRegistro) => Promise<unknown>>(async () =>
        e.errorAlRegistrarse
          ? { data: { user: null, session: null }, error: e.errorAlRegistrarse }
          : { data: { user: cuenta, session: e.registroSinSesion ? null : {} }, error: null }
      ),
      getUser: vi.fn(async () => ({ data: { user: cuenta }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((tabla: string) => {
      if (tabla !== 'usuarios') throw new Error(`Consulta no prevista en la prueba: ${tabla}`)
      return usuarios
    }),
    rpc: vi.fn<(nombre: string, args?: Record<string, unknown>) => Promise<unknown>>(async (nombre) => ({
      data: e.rpc?.[nombre]?.data ?? null,
      error: e.rpc?.[nombre]?.error ?? null,
    })),
  }
}

export type SupabaseFalso = ReturnType<typeof supabaseFalso>

/** POST con cuerpo JSON a una ruta de la app. */
export function post(ruta: string, cuerpo: unknown) {
  return new Request(`http://localhost:3000${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

/** Estado y JSON de la respuesta de una ruta. */
export async function respuesta(res: Response) {
  return { status: res.status, json: await res.json() }
}
