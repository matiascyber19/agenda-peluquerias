// Sin tipos generados de la base, supabase-js tipa toda relación embebida como
// arreglo, pero las de muchos-a-uno (cita → cliente, usuario → peluquería)
// llegan como objeto. Las rutas declaran la forma real con `Embebido<T>` y la
// leen con `uno()`, en vez de recurrir a `any`.

export type Embebido<T> = T | T[] | null

/** Deja una relación embebida siempre en un solo registro (o null). */
export function uno<T>(relacion: Embebido<T>): T | null {
  return Array.isArray(relacion) ? relacion[0] ?? null : relacion ?? null
}
