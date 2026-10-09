import Image from 'next/image'
import Link from 'next/link'

export const INPUT_ACCESO =
  'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all'

export const BOTON_ACCESO =
  'w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-800 active:scale-95 transition-all mt-2 disabled:opacity-50'

/**
 * Marco de las pantallas sin sesión (recuperar y restablecer la contraseña,
 * unirse al equipo), con el mismo fondo y la misma marca que la portada.
 */
export default function TarjetaAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-rose-500/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link href="/login" className="mx-auto mb-6 flex w-fit items-center gap-2.5 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Image src="/icono_agenda_blanco.png" alt="" width={32} height={32} loading="eager" className="h-8 w-8" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Agenda Peluquerías</span>
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="mb-6 text-xl font-semibold text-gray-800">{titulo}</h2>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">© 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱</p>
      </div>
    </main>
  )
}
