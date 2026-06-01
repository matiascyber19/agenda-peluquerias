export default function DashboardPage() {
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
        <span className="text-sm text-gray-500">Peluquería Juan</span>
        <button className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
            Cerrar sesión
        </button>
        </div>
    </nav>

        <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Saludo */}
        <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Buenos días, Juan 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Domingo 1 de junio, 2026</p>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Citas hoy</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">8</p>
            <p className="text-xs text-green-600 mt-1">↑ 2 más que ayer</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Completadas</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">3</p>
            <p className="text-xs text-gray-400 mt-1">5 pendientes</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingresos hoy</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">$42k</p>
            <p className="text-xs text-gray-400 mt-1">CLP</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">No-shows</p>
            <p className="text-3xl font-bold text-red-500 mt-1">1</p>
            <p className="text-xs text-gray-400 mt-1">este mes: 3</p>
        </div>
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Citas del día */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Citas de hoy</h2>
            <button className="text-sm text-slate-600 hover:text-slate-900 font-medium">Ver agenda →</button>
            </div>
            <div className="space-y-3">
            {[
                { hora: "09:00", cliente: "Carlos Muñoz", servicio: "Corte + barba", peluquero: "Diego", estado: "completada" },
                { hora: "10:30", cliente: "Pedro Soto", servicio: "Corte clásico", peluquero: "Matias", estado: "completada" },
                { hora: "11:00", cliente: "Luis Rojas", servicio: "Degradado", peluquero: "Diego", estado: "completada" },
                { hora: "12:00", cliente: "Andrés Silva", servicio: "Corte + barba", peluquero: "Matias", estado: "pendiente" },
                { hora: "14:00", cliente: "Felipe Torres", servicio: "Corte clásico", peluquero: "Diego", estado: "pendiente" },
            ].map((cita, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="text-sm font-mono text-gray-400 w-12">{cita.hora}</span>
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{cita.cliente}</p>
                    <p className="text-xs text-gray-400">{cita.servicio} · {cita.peluquero}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    cita.estado === "completada"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                    {cita.estado}
                </span>
                </div>
            ))}
            </div>
        </div>

          {/* Accesos rápidos */}
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Accesos rápidos</h2>
            <div className="space-y-2">
                {[
                { icon: "📅", label: "Nueva cita" },
                { icon: "👤", label: "Nuevo cliente" },
                { icon: "✂️", label: "Servicios" },
                { icon: "📊", label: "Reportes" },
                ].map((item, i) => (
                <button key={i} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </button>
                ))}
            </div>
            </div>

            {/* Próxima cita */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Próxima cita</p>
            <p className="text-lg font-bold mt-1">12:00</p>
            <p className="text-sm text-slate-300">Andrés Silva</p>
            <p className="text-xs text-slate-400 mt-1">Corte + barba · Matias</p>
            <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">En 47 minutos</p>
            </div>
            </div>
        </div>

        </div>
    </div>
    </div>
)
}