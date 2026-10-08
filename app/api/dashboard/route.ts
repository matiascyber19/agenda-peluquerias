import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { uno } from '@/app/lib/supabase/embebido'
import { FILTRO_CITAS_DE_AGENDA } from '@/app/lib/citas'
import { fechaEnChile, inicioDelDiaEnChile, sumarDias } from '@/app/lib/fechas'

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

  // 3. Rango de hoy en horario de Chile. El servidor corre en UTC, así que
  // calcular el día con `new Date()` local desplazaría el corte 3 o 4 horas.
  const now = new Date()
  const hoy = fechaEnChile(now)
  const hoyInicio = inicioDelDiaEnChile(hoy).toISOString()
  const hoyFin = inicioDelDiaEnChile(sumarDias(hoy, 1)).toISOString()

  // Primer día del mes
  const mesInicio = inicioDelDiaEnChile(`${hoy.slice(0, 8)}01`).toISOString()

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
    .or(FILTRO_CITAS_DE_AGENDA)
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
      peluqueria: uno(usuario.peluquerias)?.nombre
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
      hora: new Date(c.inicio).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
      cliente: uno(c.clientes)?.nombre || 'Sin cliente',
      peluquero: uno(c.peluqueros)?.nombre || 'Sin asignar',
      colorPeluquero: uno(c.peluqueros)?.color_agenda,
      servicios: (c.cita_servicios || [])
        .map((cs) => uno(cs.servicios)?.nombre)
        .filter(Boolean)
        .join(' + '),
      estado: c.estado
    })),
    proximaCita: proximaCita ? {
      hora: new Date(proximaCita.inicio).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
      cliente: uno(proximaCita.clientes)?.nombre,
      peluquero: uno(proximaCita.peluqueros)?.nombre,
      servicio: (proximaCita.cita_servicios || [])
        .map((cs) => uno(cs.servicios)?.nombre)
        .filter(Boolean)
        .join(' + '),
      inicio: proximaCita.inicio
    } : null
  })
}