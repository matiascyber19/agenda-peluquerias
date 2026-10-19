import { describe, expect, it } from 'vitest'
import { PAGINAS, paginaDe, puedeVer, type Rol } from '@/app/lib/roles'
import { config } from '@/proxy'

// Qué páginas ve cada rol (menú y proxy). La base de datos es la que impide
// realmente lo que no corresponde; esto cuida que el menú y las páginas cuadren.

const QUE_VE: Record<Rol, string[]> = {
  dueño: PAGINAS.map((p) => p.href),
  recepcionista: ['/dashboard', '/agenda', '/recordatorios', '/solicitudes', '/clientes'],
  peluquero: ['/dashboard', '/agenda', '/recordatorios', '/comisiones'],
}

describe('páginas por rol', () => {
  it.each(Object.entries(QUE_VE) as [Rol, string[]][])('%s ve exactamente sus páginas', (rol, paginas) => {
    expect(PAGINAS.filter((p) => puedeVer(rol, p.href)).map((p) => p.href)).toEqual(paginas)
  })

  it('una ruta dentro de una página pertenece a esa página, pero no una que solo empieza igual', () => {
    expect(paginaDe('/clientes/123')?.href).toBe('/clientes')
    expect(paginaDe('/clientesx')).toBeNull()
    expect(paginaDe('/login')).toBeNull()
  })

  it('el proxy protege todas las páginas del panel (si no, se podrían abrir sin sesión)', () => {
    const protegidas = config.matcher.filter((m) => m.endsWith('/:path*')).map((m) => m.replace('/:path*', ''))
    expect(protegidas.sort()).toEqual(PAGINAS.map((p) => p.href).sort())
  })
})
