export default function RegistroPage() {
return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
    <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
        <img
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            className="w-36 h-36 object-contain mx-auto filter invert"
        />
        <p className="text-slate-400 text-sm mt-1">Crea tu cuenta gratis</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

        <h2 className="text-xl font-semibold text-gray-800 mb-6">Registra tu peluquería</h2>

        <div className="space-y-5">

            {/* Nombre peluquería */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre de tu peluquería
            </label>
            <input
                type="text"
                placeholder="Ej: Barbería Juan"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
            />
            </div>

            {/* Slug */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                URL de tu agenda
            </label>
            <div className="flex items-center border border-gray-200 bg-gray-50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-800 transition-all">
                <span className="px-4 py-3 text-sm text-gray-400 bg-gray-100 border-r border-gray-200 whitespace-nowrap">
                agendapeluquerias.cl/
                </span>
                <input
                type="text"
                placeholder="barberia-juan"
                className="flex-1 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
                />
            </div>
            <p className="text-xs text-gray-400 mt-1">Solo letras minúsculas, números y guiones</p>
            </div>

            {/* Nombre dueño */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tu nombre
            </label>
            <input
                type="text"
                placeholder="Juan González"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
            />
            </div>

            {/* Email */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
            </label>
            <input
                type="email"
                placeholder="tu@correo.cl"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
            />
            </div>

            {/* Contraseña */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
            </label>
            <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
            />
            </div>

            {/* Botón */}
            <button className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all mt-2">
            Crear cuenta gratis →
            </button>

        </div>

          {/* Divider */}
        <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-100"></div>
        </div>

          {/* Login */}
        <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-slate-800 font-semibold hover:underline">
            Inicia sesión
            </a>
        </p>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
        © 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱
        </p>

    </div>
    </div>
)
}