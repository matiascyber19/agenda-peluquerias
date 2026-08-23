"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Error cargando dashboard:", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Cargando dashboard...</p>
      </div>
    )
  }

  if (!data || !data.usuario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  // Minutos hasta próxima cita
  const minutosParaProxima = data.proximaCita
    ? Math.round((new Date(data.proximaCita.inicio).getTime() - Date.now()) / 60000)
    : null

  // Cerrar sesión
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo_agenda_peluqueria.png"
            alt="Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="font-semibold text-gray-800">Agenda Peluquerías</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{data.usuario.peluqueria}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Saludo */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {saludo}, {data.usuario.nombre} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{hoy}</p>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Citas hoy</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data.resumen.totalCitas}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Completadas</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data.resumen.completadas}</p>
            <p className="text-xs text-gray-400 mt-1">{data.resumen.pendientes} pendientes</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingresos hoy</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              ${data.resumen.ingresosHoy > 1000
                ? `${Math.round(data.resumen.ingresosHoy / 1000)}k`
                : data.resumen.ingresosHoy.toLocaleString("es-CL")}
            </p>
            <p className="text-xs text-gray-400 mt-1">CLP</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">No-shows</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{data.resumen.noShowsHoy}</p>
            <p className="text-xs text-gray-400 mt-1">este mes: {data.resumen.noShowsMes}</p>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Citas del día */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">Citas de hoy</h2>
              <button onClick={()=> router.push("/agenda")}
                className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                Ver Agenda →
              </button>
            </div>
            <div className="space-y-3">
              {data.citas.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No hay citas para hoy</p>
              ) : (
                data.citas.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-mono text-gray-400 w-12">{cita.hora}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{cita.cliente}</p>
                      <p className="text-xs text-gray-400">
                        {cita.servicios || "Sin servicio"} · {cita.peluquero}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        cita.estado === "completada"
                          ? "bg-green-100 text-green-700"
                          : cita.estado === "cancelada"
                          ? "bg-red-100 text-red-700"
                          : cita.estado === "no_show"
                          ? "bg-red-100 text-red-500"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {cita.estado}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Accesos rápidos + Próxima cita */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Accesos rápidos</h2>
              <div className="space-y-2">
                {[
                  { icon: "📅", label: "Nueva cita" , ruta:"/agenda"},
                  { icon: "👤", label: "Nuevo cliente" , ruta:"/clientes"},
                  { icon: "✂️", label: "Servicios" , ruta:""},
                  { icon: "📊", label: "Reportes" , ruta:""},
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={()=>item.ruta && router.push(item.ruta)}
                    disabled={!item.ruta}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Próxima cita */}
            {data.proximaCita ? (
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Próxima cita
                </p>
                <p className="text-lg font-bold mt-1">{data.proximaCita.hora}</p>
                <p className="text-sm text-slate-300">{data.proximaCita.cliente}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.proximaCita.servicio} · {data.proximaCita.peluquero}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400">
                    {minutosParaProxima && minutosParaProxima > 0
                      ? `En ${minutosParaProxima} minutos`
                      : "Ahora"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Próxima cita
                </p>
                <p className="text-sm text-slate-300 mt-2">No hay más citas hoy</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}