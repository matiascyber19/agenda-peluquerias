import 'server-only'
import { clienteAdmin } from './supabase/admin'
import { uno } from './supabase/embebido'

// Aviso por correo al encargado cuando llega una reserva en línea
// (docs/plan-reserva-en-linea.md §9). Se activa al configurar:
//   RESEND_API_KEY        clave de Resend
//   SUPABASE_SECRET_KEY   clave secreta de Supabase (para leer el correo de avisos)
//   AVISOS_REMITENTE      opcional, p. ej. "Agenda Peluquerías <avisos@tudominio.cl>"
// Sin ellas no se envía nada: la solicitud igual aparece en "Solicitudes".

const REMITENTE_DE_PRUEBA = 'Agenda Peluquerías <onboarding@resend.dev>'

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatearCLP(monto: number) {
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

/**
 * Envía el aviso de una nueva solicitud. Nunca lanza: si falta configuración,
 * la peluquería no tiene correo de avisos o el envío falla, solo lo registra.
 */
export async function avisarNuevaSolicitud(citaId: string, urlBase: string) {
  const apiKey = process.env.RESEND_API_KEY
  const admin = clienteAdmin()
  if (!apiKey || !admin) {
    console.info('Aviso por correo desactivado: faltan RESEND_API_KEY o SUPABASE_SECRET_KEY')
    return
  }

  try {
    const { data: cita, error } = await admin
      .from('citas')
      .select(`
        inicio, notas, estado,
        peluquerias ( nombre, email ),
        clientes ( nombre, telefono ),
        peluqueros ( nombre ),
        cita_servicios ( precio_congelado_clp, servicios ( nombre ) )
      `)
      .eq('id', citaId)
      .maybeSingle()

    if (error || !cita) {
      console.error('Aviso por correo: no se encontró la cita', citaId, error?.message)
      return
    }

    const peluqueria = uno(cita.peluquerias)
    if (!peluqueria?.email) return // la peluquería no configuró un correo de avisos

    const cliente = uno(cita.clientes)
    const peluquero = uno(cita.peluqueros)
    const servicios = (cita.cita_servicios ?? []).map((cs) => uno(cs.servicios)?.nombre).filter(Boolean)
    const total = (cita.cita_servicios ?? []).reduce((t, cs) => t + (cs.precio_congelado_clp ?? 0), 0)
    const cuando = new Date(cita.inicio).toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    // Con confirmación automática (migración 006) la reserva ya está en la agenda.
    const confirmada = cita.estado === 'confirmada'

    const filas = [
      ['Cliente', `${cliente?.nombre ?? 'Sin nombre'}${cliente?.telefono ? ` · ${cliente.telefono}` : ''}`],
      ['Cuándo', cuando],
      ['Con', peluquero?.nombre ?? 'Sin asignar'],
      ['Servicios', servicios.join(' + ')],
      ['Total', formatearCLP(total)],
      ...(cita.notas ? [['Comentarios', cita.notas]] : []),
    ]

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:520px">
        <h2 style="margin:0 0 8px">Nueva reserva en línea</h2>
        <p style="margin:0 0 16px;color:#6b7280">${escapar(peluqueria.nombre)} ${
          confirmada ? 'recibió una reserva que ya quedó confirmada en la agenda.' : 'recibió una solicitud que espera tu respuesta.'
        }</p>
        <table style="border-collapse:collapse;width:100%">
          ${filas
            .map(
              ([etiqueta, valor]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top">${etiqueta}</td><td style="padding:6px 0;font-weight:600">${escapar(String(valor))}</td></tr>`
            )
            .join('')}
        </table>
        <p style="margin:24px 0">
          <a href="${escapar(`${urlBase}/${confirmada ? 'agenda' : 'solicitudes'}`)}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">${
            confirmada ? 'Ver la agenda' : 'Ver la solicitud'
          }</a>
        </p>
      </div>`

    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Si el envío se reintenta, Resend no manda el mismo aviso dos veces.
        'Idempotency-Key': `solicitud-${citaId}`,
      },
      body: JSON.stringify({
        from: process.env.AVISOS_REMITENTE || REMITENTE_DE_PRUEBA,
        to: [peluqueria.email],
        subject: `Nueva reserva: ${cliente?.nombre ?? 'cliente'} · ${cuando}`,
        html,
      }),
    })

    if (!respuesta.ok) {
      console.error('Aviso por correo: Resend respondió', respuesta.status, await respuesta.text())
    }
  } catch (error) {
    console.error('Aviso por correo: error inesperado', error)
  }
}
