// Qué puede ver cada rol. La base de datos (migración 006) es la que
// realmente impide lo que no corresponde; esto ordena el menú y las páginas.

export type Rol = 'dueño' | 'recepcionista' | 'peluquero'

export const NOMBRE_ROL: Record<Rol, string> = {
  dueño: 'Dueño',
  recepcionista: 'Recepcionista',
  peluquero: 'Peluquero',
}

const TODOS: Rol[] = ['dueño', 'recepcionista', 'peluquero']

/** Páginas del panel y quién puede entrar a cada una, en el orden del menú. */
export const PAGINAS: { href: string; label: string; roles: Rol[] }[] = [
  { href: '/dashboard', label: 'Dashboard', roles: TODOS },
  { href: '/agenda', label: 'Agenda', roles: TODOS },
  { href: '/solicitudes', label: 'Solicitudes', roles: ['dueño', 'recepcionista'] },
  { href: '/clientes', label: 'Clientes', roles: ['dueño', 'recepcionista'] },
  { href: '/servicios', label: 'Servicios', roles: ['dueño'] },
  { href: '/peluqueros', label: 'Peluqueros', roles: ['dueño'] },
  { href: '/equipo', label: 'Equipo', roles: ['dueño'] },
  { href: '/reportes', label: 'Reportes', roles: ['dueño'] },
  { href: '/gastos', label: 'Gastos', roles: ['dueño'] },
  { href: '/comisiones', label: 'Comisiones', roles: ['dueño', 'peluquero'] },
  { href: '/configuracion', label: 'Configuración', roles: ['dueño'] },
]

export function esRol(valor: unknown): valor is Rol {
  return valor === 'dueño' || valor === 'recepcionista' || valor === 'peluquero'
}

/** La página del panel a la que pertenece esa ruta, o null si no es del panel. */
export function paginaDe(ruta: string) {
  return PAGINAS.find((p) => ruta === p.href || ruta.startsWith(`${p.href}/`)) ?? null
}

export function puedeVer(rol: Rol, ruta: string) {
  return paginaDe(ruta)?.roles.includes(rol) ?? false
}
