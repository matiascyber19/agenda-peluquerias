import { createClient } from '@/app/lib/supabase/server'
import { exigirRol, usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/equipo
// Cuentas de la peluquería, invitaciones pendientes y fichas de peluquero
// que todavía no tienen cuenta. Solo el dueño.
// ============================================
export async function GET() {
  const supabase = await createClient()
  const sinPermiso = await exigirRol(supabase, ['dueño'])
  if (sinPermiso) return sinPermiso
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const [usuarios, peluqueros, invitaciones] = await Promise.all([
    supabase.from('usuarios').select('id, nombre, email, rol, activo').order('nombre'),
    supabase.from('peluqueros').select('id, nombre, usuario_id, activo').order('nombre'),
    supabase
      .from('invitaciones')
      .select('id, token, rol, peluquero_id, vence_en')
      .is('usada_en', null)
      .gt('vence_en', new Date().toISOString())
      .order('creado_en', { ascending: false }),
  ])

  const error = usuarios.error ?? peluqueros.error ?? invitaciones.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const fichas = peluqueros.data ?? []
  const fichaDe = (usuarioId: string) => fichas.find((p) => p.usuario_id === usuarioId)?.nombre ?? null
  const nombreFicha = (id: string | null) => fichas.find((p) => p.id === id)?.nombre ?? null

  return NextResponse.json({
    cuentas: (usuarios.data ?? []).map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo ?? true,
      peluquero: fichaDe(u.id),
      esYo: u.id === sesion.user.id,
    })),
    invitaciones: (invitaciones.data ?? []).map((i) => ({
      id: i.id,
      token: i.token,
      rol: i.rol,
      peluquero_id: i.peluquero_id,
      peluquero: nombreFicha(i.peluquero_id),
      vence_en: i.vence_en,
    })),
    peluquerosSinCuenta: fichas.filter((p) => !p.usuario_id && (p.activo ?? true)).map((p) => ({ id: p.id, nombre: p.nombre })),
  })
}
