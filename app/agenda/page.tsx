const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const horas = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

const citas = [
{ dia: 0, hora: "09:00", cliente: "Carlos Muñoz", servicio: "Corte + barba", peluquero: "Diego", color: "bg-blue-100 border-blue-300 text-blue-800" },
{ dia: 0, hora: "11:00", cliente: "Pedro Soto", servicio: "Corte clásico", peluquero: "Matias", color: "bg-purple-100 border-purple-300 text-purple-800" },
{ dia: 1, hora: "10:00", cliente: "Luis Rojas", servicio: "Degradado", peluquero: "Diego", color: "bg-blue-100 border-blue-300 text-blue-800" },
{ dia: 1, hora: "14:00", cliente: "Andrés Silva", servicio: "Corte + barba", peluquero: "Matias", color: "bg-purple-100 border-purple-300 text-purple-800" },
{ dia: 2, hora: "09:00", cliente: "Felipe Torres", servicio: "Corte clásico", peluquero: "Diego", color: "bg-blue-100 border-blue-300 text-blue-800" },
{ dia: 2, hora: "12:00", cliente: "Juan Pérez", servicio: "Barba", peluquero: "Matias", color: "bg-purple-100 border-purple-300 text-purple-800" },
{ dia: 4, hora: "11:00", cliente: "Roberto Díaz", servicio: "Degradado", peluquero: "Diego", color: "bg-blue-100 border-blue-300 text-blue-800" },
{ dia: 5, hora: "10:00", cliente: "Miguel Ángel", servicio: "Corte + barba", peluquero: "Matias", color: "bg-purple-100 border-purple-300 text-purple-800" },
]

export default function AgendaPage() {
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

    <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500 text-sm mt-1">Semana del 2 al 8 de junio, 2026</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            ← Anterior
            </button>
            <button className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors">
            Hoy
            </button>
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Siguiente →
            </button>
            <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
            + Nueva cita
            </button>
        </div>
        </div>

        {/* Leyenda peluqueros */}
        <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-sm text-gray-600">Diego</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-sm text-gray-600">Matias</span>
        </div>
        </div>

        {/* Calendario semanal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Header días */}
        <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="p-4 text-xs text-gray-400 font-medium"></div>
            {diasSemana.map((dia, i) => (
            <div key={i} className={`p-4 text-center border-l border-gray-100 ${i === 0 ? "bg-slate-900 text-white" : ""}`}>
                <p className={`text-xs font-medium ${i === 0 ? "text-slate-300" : "text-gray-400"}`}>{dia}</p>
                <p className={`text-lg font-bold mt-0.5 ${i === 0 ? "text-white" : "text-gray-700"}`}>{2 + i}</p>
            </div>
            ))}
        </div>

          {/* Grid horas */}
        {horas.map((hora) => (
            <div key={hora} className="grid grid-cols-8 border-b border-gray-100 min-h-16">
            <div className="p-3 text-xs text-gray-400 font-mono border-r border-gray-100 flex items-start">
                {hora}
            </div>
            {diasSemana.map((_, diaIndex) => {
                const cita = citas.find(c => c.dia === diaIndex && c.hora === hora)
                return (
                <div key={diaIndex} className="border-l border-gray-100 p-1 relative">
                    {cita && (
                    <div className={`rounded-lg border p-2 cursor-pointer hover:opacity-80 transition-opacity ${cita.color}`}>
                        <p className="text-xs font-semibold truncate">{cita.cliente}</p>
                        <p className="text-xs opacity-70 truncate">{cita.servicio}</p>
                    </div>
                    )}
                </div>
                )
            })}
            </div>
        ))}

        </div>
    </div>
    </div>
)
}