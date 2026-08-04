"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string | null
  cumpleanos: string | null
  como_llego: string | null
  notas: string | null
  bloqueado: boolean
  ultimaVisita: string | null
  servicios: number
  gasto: number
}

interface DatosDashboard {
  usuario: {
    nombre: string
    rol: string
    peluqueria: string
  }
}

export default function ClientesPage() {
  const router = useRouter()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [peluqueria, setPeluqueria] = useState("")
  const [buscar, setBuscar] = useState("")
  const [filtro, setFiltro] = useState("todos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [clientesResponse, dashboardResponse] = await Promise.all([
          fetch("/api/clientes"),
          fetch("/api/dashboard"),
        ])

        const clientesJson = await clientesResponse.json()
        const dashboardJson: DatosDashboard = await dashboardResponse.json()

        if (!clientesResponse.ok) {
          throw new Error(
            clientesJson.error || "No se pudieron cargar los clientes"
          )
        }

        if (!dashboardResponse.ok) {
          throw new Error(
            (dashboardJson as any).error ||
              "No se pudo cargar la información de la peluquería"
          )
        }

        setClientes(clientesJson.clientes || [])
        setPeluqueria(dashboardJson.usuario.peluqueria)
      } catch (error) {
        console.error("Error cargando clientes:", error)

        setError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los clientes"
        )
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  const clientesFiltrados = useMemo(() => {
    const texto = buscar.trim().toLowerCase()

    return clientes.filter((cliente) => {
      const coincideBusqueda =
        cliente.nombre.toLowerCase().includes(texto) ||
        cliente.telefono.toLowerCase().includes(texto)

      if (!coincideBusqueda) {
        return false
      }

      if (filtro === "activos") {
        return !cliente.bloqueado
      }

      if (filtro === "bloqueados") {
        return cliente.bloqueado
      }

      if (filtro === "sin-visitar") {
        if (!cliente.ultimaVisita) {
          return true
        }

        const ultimaVisita = new Date(cliente.ultimaVisita)
        const haceSesentaDias = new Date()
        haceSesentaDias.setDate(haceSesentaDias.getDate() - 60)

        return ultimaVisita < haceSesentaDias
      }

      return true
    })
  }, [clientes, buscar, filtro])

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) {
      return "Sin visitas"
    }

    return new Date(fecha).toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
    })
  }

  const formatearDinero = (monto: number) => {
    return monto.toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    })
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    })

    router.push("/login")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Cargando clientes...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-3"
        >
        <img
            src="/logo_agenda_peluqueria.png"
            alt="Logo"
            className="w-8 h-8 object-contain"
          />

          <span className="font-semibold text-gray-800">
            Agenda Peluquerías
          </span>
        </button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {peluqueria}
          </span>

          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Clientes
            </h1>

            <p className="text-gray-500 text-sm mt-1">
              {clientes.length} clientes registrados
            </p>
          </div>

          <button
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
          >
            + Nuevo cliente
          </button>
        </div>

        {/* Buscador y filtros */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>

            <input
              type="text"
              value={buscar}
              onChange={(event) => setBuscar(event.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
            />
          </div>

          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            className="border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="sin-visitar">Sin visitar 60+ días</option>
            <option value="bloqueados">Bloqueados</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Cliente
                </th>

                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Teléfono
                </th>

                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Última visita
                </th>

                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Servicios
                </th>

                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total gastado
                </th>

                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estado
                </th>

                <th className="px-6 py-4"></th>
              </tr>
            </thead>

            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-gray-400"
                  >
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente, i) => (
                  <tr
                    key={cliente.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      i === clientesFiltrados.length - 1
                        ? "border-0"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                          {cliente.nombre.charAt(0).toUpperCase()}
                        </div>

                        <span className="text-sm font-medium text-gray-800">
                          {cliente.nombre}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">
                      {cliente.telefono}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatearFecha(cliente.ultimaVisita)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">
                      {cliente.servicios}
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {formatearDinero(cliente.gasto)}
                    </td>

                    <td className="px-6 py-4">
                      {cliente.bloqueado ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                          Activo
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          router.push(`/clientes/${cliente.id}`)
                        }
                        className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                      >
                        Ver ficha →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}