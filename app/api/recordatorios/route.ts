import { createClient } from '@/app/lib/supabase/server'
import { type Embebido, uno } from '@/app/lib/supabase/embebido'
import { usuarioConPeluqueria } from '@/app/lib/sesion'
import { fechaEnChile, inicioDelDiaEnChile, sumarDias } from '@/app/lib/fechas'
import { NextResponse } from 'next/server'

interface CitaRow {
  id: string
  inicio: string
  estado: string
  recordatorio_24h_enviado: boolean | null
  clientes: Embebido<{ nombre: string; telefono: string | null }>
  peluqueros: Embebido<{ nombre: string }>
  cita_servicios: { servicios: Embebido<{ nombre: string }> }[] | null
}

// ============================================
// GET /api/recordatorios?dia=manana|hoy
// Citas por recordar de ese día (en Chile): las pendientes y confirmadas,
// con el teléfono del cliente y si ya se le envió el recordatorio. Cada rol
// ve las citas que le corresponden (el peluquero, solo las suyas).
// Devuelve { fecha, peluqueria: { nombre, direccion, comuna }, citas }
// Un solo recordatorio por cita: se marca en recordatorio_24h_enviado, se
// envíe el día antes o el mismo día.
// ============================================
export async function GET(request: Request) {
  const supabase = await createClient()
  const sesion = await usuarioConPeluqueria(supabase)
  if (!sesion) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const dia = new URL(request.url).searchParams.get('dia') === 'hoy' ? 'hoy' : 'manana'
  const hoy = fechaEnChile(new Date())
  const fecha = dia === 'hoy' ? hoy : sumarDias(hoy, 1)

  const [peluqueria, citas] = await Promise.all([
    supabase.from('peluquerias').select('nombre, direccion, comuna').eq('id', sesion.peluqueriaId).maybeSingle(),
    supabase
      .from('citas')
      .select(`
        id, inicio, estado, recordatorio_24h_enviado,
        clientes(nombre, telefono),
        peluqueros(nombre),
        cita_servicios(servicios(nombre))
      `)
      .eq('peluqueria_id', sesion.peluqueriaId)
      .gte('inicio', inicioDelDiaEnChile(fecha).toISOString())
      .lt('inicio', inicioDelDiaEnChile(sumarDias(fecha, 1)).toISOString())
      .in('estado', ['pendiente', 'confirmada'])
      .order('inicio', { ascending: true }),
  ])

  if (peluqueria.error || citas.error || !peluqueria.data) {
    return NextResponse.json({ error: 'No pudimos cargar las citas' }, { status: 500 })
  }

  return NextResponse.json({
    fecha,
    peluqueria: peluqueria.data,
    citas: ((citas.data ?? []) as unknown as CitaRow[]).map((c) => ({
      id: c.id,
      inicio: c.inicio,
      // 24 horas ("15:30"): así va en el mensaje de WhatsApp
      hora: new Date(c.inicio).toLocaleTimeString('es-CL', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
      cliente: uno(c.clientes)?.nombre ?? 'Cliente',
      telefono: uno(c.clientes)?.telefono ?? null,
      peluquero: uno(c.peluqueros)?.nombre ?? null,
      servicios: (c.cita_servicios ?? [])
        .map((cs) => uno(cs.servicios)?.nombre)
        .filter(Boolean)
        .join(' + '),
      enviado: c.recordatorio_24h_enviado === true,
    })),
  })
}
