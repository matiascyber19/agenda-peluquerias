import Image from 'next/image'
import Link from 'next/link'

/**
 * Marco del login y del registro: presenta la app a la izquierda y deja el
 * formulario a la derecha. En el celular va primero el titular, luego el
 * formulario (para entrar rápido) y al final el detalle.
 */
export default function Portada({
  titular,
  texto,
  acciones,
  detalle,
  children,
}: {
  titular: React.ReactNode
  texto: string
  acciones?: React.ReactNode
  detalle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Luces de fondo */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-rose-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl content-center gap-x-16 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
        <header className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <Link href="/login" className="flex w-fit items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Image src="/icono_agenda_blanco.png" alt="" width={32} height={32} loading="eager" className="h-8 w-8" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Agenda Peluquerías</span>
          </Link>

          <p className="mt-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            💈 Para peluquerías y barberías de Chile
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{titular}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">{texto}</p>
          {acciones && <div className="mt-6 flex flex-wrap items-center gap-3">{acciones}</div>}
        </header>

        <section id="formulario" className="w-full max-w-md justify-self-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          {children}
        </section>

        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">{detalle}</div>
      </div>

      <p className="relative pb-6 text-center text-xs text-slate-500">© 2026 Agenda Peluquerías · Hecho en Chile 🇨🇱</p>
    </main>
  )
}

/** Texto del titular resaltado con el degradado de la marca. */
export function Resaltado({ children }: { children: React.ReactNode }) {
  return <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-clip-text text-transparent">{children}</span>
}

/** Botón principal de la portada (crear peluquería). */
export const BOTON_PORTADA =
  'inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-300 active:scale-95'
