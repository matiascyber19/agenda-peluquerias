"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navbar from "../components/Navbar"
import { useSolicitudesPendientes } from "../lib/useSolicitudesPendientes"
import { useMantenerActualizado } from "../lib/useMantenerActualizado"
import { esRol, puedeVer } from "../lib/roles"
import { cuandoEs } from "../lib/fechas"

interface DashboardData {
  usuario: {
    nombre: string
    rol: string
    peluqueria: string
  }
  resumen: {
    totalCitas: number
    completadas: number
    pendientes: number
    noShowsHoy: number
    noShowsMes: number
    ingresosHoy: number
  }
  citas: {
    id: string
    hora: string
    cliente: string
    peluquero: string
    colorPeluquero: string
    servicios: string
    estado: string
  }[]
  proximaCita: {
    hora: string
    cliente: string
    peluquero: string
    servicio: string
    inicio: string
  } | null
}

// Mismos nombres que en el detalle de la cita.
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-amber-100 text-amber-800" },
  confirmada: { texto: "Confirmada", clase: "bg-sky-100 text-sky-800" },
  completada: { texto: "Completada", clase: "bg-emerald-100 text-emerald-700" },
  cancelada: { texto: "Cancelada", clase: "bg-gray-100 text-gray-500" },
  no_show: { texto: "No llegó", clase: "bg-rose-100 text-rose-700" },
}

const accesosRapidos: { icon: string; label: string; href?: string }[] = [
  { icon: "📅", label: "Nueva cita", href: "/agenda?nueva=1" },
  { icon: "👤", label: "Clientes", href: "/clientes" },
  { icon: "✂️", label: "Servicios", href: "/servicios" },
  { icon: "📊", label: "Reportes", href: "/reportes" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  // Momento en que llegaron los datos: Date.now() no puede leerse durante el render.
  const [cargadoEn, setCargadoEn] = useState(0)
  const [loading, setLoading] = useState(true)
  // El rol llega con los datos: los peluqueros no responden solicitudes.
  const rol = esRol(data?.usuario?.rol) ? data.usuario.rol : null
  const solicitudesPendientes = useSolicitudesPendientes(rol === "dueño" || rol === "recepcionista")

  // Solo toca el estado cuando llega la respuesta: sirve para la primera carga
  // y para el refresco en silencio.
  const pedirDashboard = useCallback(() => {
    fetch("/api/dashboard")
      .then((res) => {
        // La sesión pudo expirar con la página abierta: el proxy solo protege la navegación.
        if (res.status === 401) {
          router.replace("/login")
          return null
        }
        return res.json()
      })
      .then((json) => {
        if (json) {
          setData(json)
          setCargadoEn(Date.now())
        }
      })
      .catch((err) => console.error("Error cargando dashboard:", err))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    pedirDashboard()
  }, [pedirDashboard])

  // Citas e ingresos de hoy al día: al volver a la pestaña y cada 30 segundos.
  useMantenerActualizado(pedirDashboard, 30_000)

  if (loading) {
    return (
      <div className="min-h-screen fondo-panel flex items-center justify-center">
        <p className="text-gray-400 text-sm">Cargando dashboard...</p>
      </div>
    )
  }

  if (!data || !data.usuario) {
    return (
      <div className="min-h-screen fondo-panel flex items-center justify-center">
        <p className="text-red-500 text-sm">Error: no se pudo cargar el dashboard</p>
      </div>
    )
  }

  // Saludo según la hora
  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches"

  // Fecha formateada
  const hoy = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // "Hoy" / "Mañana" / "viernes 16 de octubre" y cuánto falta, desde la última carga
  const proxima = data.proximaCita ? cuandoEs(data.proximaCita.inicio, new Date(cargadoEn)) : null
  const { totalCitas, completadas, pendientes, ingresosHoy, noShowsHoy, noShowsMes } = data.resumen

  const tarjetas = [
    { titulo: "Citas hoy", valor: String(totalCitas), detalle: `${pendientes} por atender`, icono: "📅", fondo: "bg-amber-100" },
    { titulo: "Completadas", valor: String(completadas), detalle: `de ${totalCitas} de hoy`, icono: "✅", fondo: "bg-emerald-100" },
    { titulo: "Ingresos hoy", valor: `$${ingresosHoy.toLocaleString("es-CL")}`, detalle: "CLP cobrados", icono: "💰", fondo: "bg-sky-100" },
    { titulo: "No llegaron", valor: String(noShowsHoy), detalle: `este mes: ${noShowsMes}`, icono: "🚫", fondo: "bg-rose-100" },
  ]

  return (
    <div className="min-h-screen fondo-panel">

      <Navbar peluqueria={data.usuario.peluqueria} />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">

        {/* Bienvenida */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-amber-500/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm text-slate-400 first-letter:uppercase">{hoy}</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                {saludo}, {data.usuario.nombre} 👋
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                {totalCitas === 0
                  ? "Hoy no hay citas agendadas."
                  : `Hoy hay ${totalCitas} ${totalCitas === 1 ? "cita" : "citas"} y ${pendientes} por atender.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/agenda?nueva=1"
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300"
              >
                + Nueva cita
              </Link>
              <Link
                href="/agenda"
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Ver agenda
              </Link>
            </div>
          </div>
        </section>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tarjetas.map((t) => (
            <div key={t.titulo} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t.titulo}</p>
                <span aria-hidden className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${t.fondo}`}>
                  {t.icono}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{t.valor}</p>
              <p className="mt-1 text-xs text-gray-400">{t.detalle}</p>
            </div>
          ))}
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Citas del día */}
          <div className="md:col-span-2 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">Citas de hoy</h2>
              <Link href="/agenda" className="text-sm font-medium text-amber-700 hover:text-amber-800">
                Ver agenda →
              </Link>
            </div>
            <div className="space-y-2">
              {data.citas.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-3xl" aria-hidden>☕</p>
                  <p className="mt-2 text-sm text-gray-400">No hay citas para hoy</p>
                </div>
              ) : (
                data.citas.map((cita) => {
                  const estado = ESTADOS[cita.estado] ?? { texto: cita.estado, clase: "bg-gray-100 text-gray-600" }
                  return (
                    <div
                      key={cita.id}
                      className="flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-gray-100 hover:bg-gray-50"
                    >
                      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-gray-700">{cita.hora}</span>
                      <span
                        aria-hidden
                        className="h-9 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: cita.colorPeluquero || "#cbd5e1" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{cita.cliente}</p>
                        <p className="truncate text-xs text-gray-400">
                          {cita.servicios || "Sin servicio"} · {cita.peluquero}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
                        {estado.texto}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Próxima cita + Solicitudes + Accesos rápidos */}
          <div className="space-y-4">
            {/* Próxima cita */}
            <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-amber-500/25 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Próxima cita</p>
                  {proxima && proxima.falta !== proxima.dia && (
                    <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950">
                      {proxima.falta}
                    </span>
                  )}
                </div>
                {data.proximaCita && proxima ? (
                  <>
                    <p className="mt-3 text-sm text-slate-400 first-letter:uppercase">{proxima.dia}</p>
                    <p className="text-3xl font-bold">{data.proximaCita.hora}</p>
                    <p className="mt-2 font-medium">{data.proximaCita.cliente}</p>
                    <p className="text-sm text-slate-400">
                      {data.proximaCita.servicio || "Sin servicio"} · {data.proximaCita.peluquero}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">No hay citas agendadas por delante.</p>
                )}
              </div>
            </div>

            {/* Reservas en línea que esperan respuesta; se actualiza sola. Solo para quien las responde. */}
            {rol && puedeVer(rol, "/solicitudes") && (
            <Link
              href="/solicitudes"
              className={`block rounded-2xl border p-6 shadow-sm transition-colors ${
                solicitudesPendientes
                  ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                  : "border-gray-200/70 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Solicitudes por confirmar
              </p>
              <p className={`mt-1 text-3xl font-bold ${solicitudesPendientes ? "text-amber-700" : "text-gray-900"}`}>
                {solicitudesPendientes ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {solicitudesPendientes ? "Ver y responder →" : "Nada pendiente"}
              </p>
            </Link>
            )}

            <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Accesos rápidos</h2>
              <div className="grid grid-cols-2 gap-3">
                {accesosRapidos.filter((item) => !item.href || (rol && puedeVer(rol, item.href))).map((item) =>
                  item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex flex-col items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 transition-colors hover:border-amber-200 hover:bg-amber-50"
                    >
                      <span className="text-xl" aria-hidden>{item.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </Link>
                  ) : (
                    <div
                      key={item.label}
                      title="Próximamente"
                      className="flex flex-col items-start gap-2 rounded-xl border border-gray-100 p-3 opacity-40 cursor-not-allowed"
                    >
                      <span className="text-xl" aria-hidden>{item.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
