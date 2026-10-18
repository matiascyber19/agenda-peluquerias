import { createClient } from '@/app/lib/supabase/server'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { NextResponse } from 'next/server'

// ============================================
// PATCH /api/recordatorios/[id]
// Body: { enviado: boolean }
// Marca (o desmarca, si fue por error) que ya se le recordó la cita al
// cliente. La base solo deja tocar las citas que el rol puede editar.
// ============================================
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { enviado } = await request.json().catch(() => ({}))
  if (typeof enviado !== 'boolean') {
    return NextResponse.json({ error: 'Indica si el recordatorio se envió' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('citas')
    .update({ recordatorio_24h_enviado: enviado })
    .eq('id', id)
    .select('id')
  if (error) {
    return NextResponse.json({ error: 'No pudimos guardar el recordatorio' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Esa cita no existe o no es tuya' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
