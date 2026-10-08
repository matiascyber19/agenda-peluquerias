// Supabase (PostgREST) devuelve como máximo 1000 filas por consulta. Para los
// totales de períodos largos hay que pedir página por página.

const FILAS_POR_PAGINA = 1000

interface Respuesta<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Trae todas las filas de una consulta, de 1000 en 1000. `pedir` arma la
 * consulta para un rango de filas (con `.range(desde, hasta)` y un orden
 * estable, por ejemplo por `id`).
 */
export async function traerTodas<T>(pedir: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>) {
  const filas: T[] = []
  for (let desde = 0; ; desde += FILAS_POR_PAGINA) {
    const { data, error } = await pedir(desde, desde + FILAS_POR_PAGINA - 1)
    if (error) return { data: null, error }
    filas.push(...(data ?? []))
    if (!data || data.length < FILAS_POR_PAGINA) return { data: filas, error: null }
  }
}
