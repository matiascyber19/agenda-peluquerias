// Qué puede ver cada rol. La base de datos (migración 006) es la que
// realmente impide lo que no corresponde; esto ordena el menú y las páginas.

export type Rol = 'dueño' | 'recepcionista' | 'peluquero'

export const NOMBRE_ROL: Record<Rol, string> = {
  dueño: 'Dueño',
  recepcionista: 'Recepcionista',
  peluquero: 'Peluquero',
}

const TODOS: Rol[] = ['dueño', 'recepcionista', 'peluquero']

/** Grupos del menú, en orden. */
export const GRUPOS = ['Día a día', 'Negocio', 'Finanzas', 'Ajustes'] as const
export type Grupo = (typeof GRUPOS)[number]

/** Páginas del panel, quién puede entrar a cada una y su grupo, en el orden del menú. */
export const PAGINAS: { href: string; label: string; grupo: Grupo; roles: Rol[] }[] = [
  { href: '/dashboard', label: 'Dashboard', grupo: 'Día a día', roles: TODOS },
  { href: '/agenda', label: 'Agenda', grupo: 'Día a día', roles: TODOS },
  { href: '/solicitudes', label: 'Solicitudes', grupo: 'Día a día', roles: ['dueño', 'recepcionista'] },
  { href: '/clientes', label: 'Clientes', grupo: 'Día a día', roles: ['dueño', 'recepcionista'] },
  { href: '/servicios', label: 'Servicios', grupo: 'Negocio', roles: ['dueño'] },
  { href: '/peluqueros', label: 'Peluqueros', grupo: 'Negocio', roles: ['dueño'] },
  { href: '/equipo', label: 'Equipo', grupo: 'Negocio', roles: ['dueño'] },
  { href: '/reportes', label: 'Reportes', grupo: 'Finanzas', roles: ['dueño'] },
  { href: '/gastos', label: 'Gastos', grupo: 'Finanzas', roles: ['dueño'] },
  { href: '/comisiones', label: 'Comisiones', grupo: 'Finanzas', roles: ['dueño', 'peluquero'] },
  { href: '/configuracion', label: 'Configuración', grupo: 'Ajustes', roles: ['dueño'] },
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
