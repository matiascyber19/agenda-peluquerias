import Image from 'next/image'

export const INPUT_ACCESO =
  'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all'

export const BOTON_ACCESO =
  'w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-700 active:scale-95 transition-all mt-2 disabled:opacity-50'

/** Marco de las pantallas sin sesión (recuperar y restablecer la contraseña), igual al del login. */
export default function TarjetaAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Image
            src="/logo_agenda_peluqueria.png"
            alt="Agenda Peluquerías"
            width={144}
            height={144}
            loading="eager"
            className="w-36 h-36 object-contain mx-auto filter invert"
          />
          <p className="text-slate-400 text-sm mt-1">Panel de gestión para tu negocio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{titulo}</h2>
          {children}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">© 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱</p>
      </div>
    </div>
  )
}
