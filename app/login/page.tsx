export default function LoginPage() {
return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
    <div className="w-full max-w-md">

        {/* Logo sin fondo */}
        <div className="text-center mb-6">
        <img
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            className="w-36 h-36 object-contain mx-auto filter invert"
        />
        <p className="text-slate-400 text-sm mt-1">Panel de gestión para tu negocio</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

        <h2 className="text-xl font-semibold text-gray-800 mb-6">Inicia sesión</h2>

        <div className="space-y-5">

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

            {/* Password */}
            <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                Contraseña
                </label>
                <a href="#" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
                ¿Olvidaste tu contraseña?
                </a>
            </div>
            <input
                type="password"
                placeholder="••••••••"
            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
            />
            </div>

            {/* Botón */}
            <button className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-700 active:scale-95 transition-all mt-2">
            Ingresar →
            </button>

        </div>

          {/* Divider */}
        <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100"></div>
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-100"></div>
        </div>

          {/* Registro */}
        <p className="text-center text-sm text-gray-500">
            ¿No tienes cuenta?{" "}
            <a href="#" className="text-slate-800 font-semibold hover:underline">
            Regístrate gratis
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