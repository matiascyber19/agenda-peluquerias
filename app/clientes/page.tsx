const clientes = [
{ id: 1, nombre: "Carlos Muñoz", telefono: "+56 9 1234 5678", ultimaVisita: "01/06/2026", servicios: 12, gasto: "$144.000", bloqueado: false },
{ id: 2, nombre: "Pedro Soto", telefono: "+56 9 2345 6789", ultimaVisita: "01/06/2026", servicios: 8, gasto: "$96.000", bloqueado: false },
{ id: 3, nombre: "Luis Rojas", telefono: "+56 9 3456 7890", ultimaVisita: "31/05/2026", servicios: 5, gasto: "$60.000", bloqueado: false },
{ id: 4, nombre: "Andrés Silva", telefono: "+56 9 4567 8901", ultimaVisita: "28/05/2026", servicios: 3, gasto: "$36.000", bloqueado: false },
{ id: 5, nombre: "Felipe Torres", telefono: "+56 9 5678 9012", ultimaVisita: "20/05/2026", servicios: 15, gasto: "$180.000", bloqueado: false },
{ id: 6, nombre: "Juan Pérez", telefono: "+56 9 6789 0123", ultimaVisita: "15/05/2026", servicios: 2, gasto: "$24.000", bloqueado: false },
{ id: 7, nombre: "Roberto Díaz", telefono: "+56 9 7890 1234", ultimaVisita: "01/04/2026", servicios: 7, gasto: "$84.000", bloqueado: false },
{ id: 8, nombre: "Miguel Ángel", telefono: "+56 9 8901 2345", ultimaVisita: "15/03/2026", servicios: 1, gasto: "$12.000", bloqueado: true },
]

export default function ClientesPage() {
return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
        <img src="/logo_agenda_peluqueria.png" alt="Logo" className="w-8 h-8 object-contain" />
        <span className="font-semibold text-gray-800">Agenda Peluquerías</span>
        </div>
        <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">Peluquería Juan</span>
        <button className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
            Cerrar sesión
        </button>
        </div>
    </nav>

    <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 text-sm mt-1">{clientes.length} clientes registrados</p>
        </div>
        <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
            + Nuevo cliente
        </button>
        </div>

        {/* Buscador y filtros */}
        <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
            />
        </div>
        <select className="border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all">
            <option>Todos</option>
            <option>Activos</option>
            <option>Sin visitar 60+ días</option>
            <option>Bloqueados</option>
        </select>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
            <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Última visita</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Servicios</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Total gastado</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-6 py-4"></th>
            </tr>
            </thead>
            <tbody>
            {clientes.map((cliente, i) => (
                <tr key={cliente.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === clientes.length - 1 ? "border-0" : ""}`}>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                        {cliente.nombre.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{cliente.nombre}</span>
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{cliente.telefono}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{cliente.ultimaVisita}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{cliente.servicios}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{cliente.gasto}</td>
                <td className="px-6 py-4">
                    {cliente.bloqueado ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>
                    ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
                    )}
                </td>
                <td className="px-6 py-4">
                    <button className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                    Ver ficha →
                    </button>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>

    </div>
    </div>
)
}