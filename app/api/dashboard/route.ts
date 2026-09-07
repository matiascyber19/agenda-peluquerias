import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

const ZONA = 'America/Santiago'

/** Offset de la zona respecto a UTC, en ms, para ese instante (contempla horario de verano). */
function offsetZona(instante: Date) {
  const etiqueta = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    timeZoneName: 'longOffset',
  })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value

  const partes = /GMT([+-])(\d{2}):(\d{2})/.exec(etiqueta ?? '')
  if (!partes) return 0

  const signo = partes[1] === '-' ? -1 : 1
  return signo * (Number(partes[2]) * 60 + Number(partes[3])) * 60_000
}

/**
 * Instante UTC de la medianoche en Chile.
 * `dias` desplaza respecto de hoy; `desdeElPrimero` ancla al día 1 del mes.
 * El servidor corre en UTC, así que calcular el día con `new Date()` local
 * desplazaría el corte 3 o 4 horas.
 */
function medianocheEnChile(dias = 0, desdeElPrimero = false) {
  const ahora = new Date()
  const [anio, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(ahora)
    .split('-')
    .map(Number)

  const candidato = Date.UTC(anio, mes - 1, (desdeElPrimero ? 1 : dia) + dias)
  return new Date(candidato - offsetZona(new Date(candidato)))
}

export async function GET() {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Datos del usuario y su peluquería
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, rol, peluqueria_id, peluquerias(nombre)')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario sin peluquería' }, { status: 403 })
  }

  // 3. Rango de hoy en horario de Chile
  const now = new Date()
  const hoyInicio = medianocheEnChile().toISOString()
  const hoyFin = medianocheEnChile(1).toISOString()

  // Primer día del mes
  const mesInicio = medianocheEnChile(0, true).toISOString()

  // 4. Citas de hoy con cliente, peluquero y servicios
  const { data: citasHoy } = await supabase
    .from('citas')
    .select(`
      id, inicio, fin, estado, notas,
      clientes(id, nombre, telefono),
      peluqueros(id, nombre, color_agenda),
      cita_servicios(precio_congelado_clp, duracion_congelada_min, servicios(nombre))
    `)
    .gte('inicio', hoyInicio)
    .lt('inicio', hoyFin)
    .order('inicio', { ascending: true })

  const citas = citasHoy || []

  // 5. Estadísticas de citas
  const totalCitas = citas.length
  const completadas = citas.filter(c => c.estado === 'completada').length
  const pendientes = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').length
  const noShowsHoy = citas.filter(c => c.estado === 'no_show').length

  // 6. No-shows del mes
  const { count: noShowsMes } = await supabase
    .from('citas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'no_show')
    .gte('inicio', mesInicio)
    .lt('inicio', hoyFin)

  // 7. Ingresos de hoy
  const { data: ventasHoy } = await supabase
    .from('ventas')
    .select('total_clp')
    .gte('fecha', hoyInicio)
    .lt('fecha', hoyFin)

  const ingresosHoy = (ventasHoy || []).reduce((sum, v) => sum + v.total_clp, 0)

  // 8. Próxima cita (desde ahora en adelante)
  const { data: proximaCita } = await supabase
    .from('citas')
    .select(`
      id, inicio, estado,
      clientes(nombre),
      peluqueros(nombre),
      cita_servicios(servicios(nombre))
    `)
    .gte('inicio', now.toISOString())
    .in('estado', ['pendiente', 'confirmada'])
    .order('inicio', { ascending: true })
    .limit(1)
    .maybeSingle()

  // 9. Respuesta
  return NextResponse.json({
    usuario: {
      nombre: usuario.nombre,
      rol: usuario.rol,
      peluqueria: (usuario as any).peluquerias?.nombre
    },
    resumen: {
      totalCitas,
      completadas,
      pendientes,
      noShowsHoy,
      noShowsMes: noShowsMes || 0,
      ingresosHoy
    },
    citas: citas.map(c => ({
      id: c.id,
      hora: new Date(c.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      cliente: (c as any).clientes?.nombre || 'Sin cliente',
      peluquero: (c as any).peluqueros?.nombre || 'Sin asignar',
      colorPeluquero: (c as any).peluqueros?.color_agenda,
      servicios: ((c as any).cita_servicios || [])
        .map((cs: any) => cs.servicios?.nombre)
        .filter(Boolean)
        .join(' + '),
      estado: c.estado
    })),
    proximaCita: proximaCita ? {
      hora: new Date(proximaCita.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      cliente: (proximaCita as any).clientes?.nombre,
      peluquero: (proximaCita as any).peluqueros?.nombre,
      servicio: ((proximaCita as any).cita_servicios || [])
        .map((cs: any) => cs.servicios?.nombre)
        .filter(Boolean)
        .join(' + '),
      inicio: proximaCita.inicio
    } : null
  })
}