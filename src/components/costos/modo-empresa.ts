import { isVerifiedSecocutUser } from '@/lib/client/secocut-user';

/** Campos de users/{uid} que usa el módulo de costos. empresaId y empresasAsignadas los escribe solo el servidor. */
export interface PerfilEmpresa {
  role?: string;
  empresaId?: string;
  empresasAsignadas?: string[];
}

/**
 * Cómo accede el usuario a las empresas:
 *  - 'admin': admin SECOCUT (rol admin + @secocut verificado): elige entre todas y puede crear.
 *  - 'cliente': tiene users/{uid}.empresaId: empresa fija, sin selector.
 *  - 'vendedor': @secocut verificado con empresasAsignadas: elige entre las suyas.
 *  - 'sin-empresas': personal SECOCUT sin empresas asignadas.
 *  - 'sin-empresa': usuario que no es de SECOCUT y no tiene empresaId.
 */
export type ModoEmpresa = 'admin' | 'cliente' | 'vendedor' | 'sin-empresas' | 'sin-empresa';

export function resolverModo(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
  perfil: PerfilEmpresa,
): ModoEmpresa {
  const personal = isVerifiedSecocutUser(user);
  if (personal && perfil.role === 'admin') return 'admin';
  if (typeof perfil.empresaId === 'string' && perfil.empresaId !== '') return 'cliente';
  if (personal && Array.isArray(perfil.empresasAsignadas) && perfil.empresasAsignadas.length > 0) return 'vendedor';
  return personal ? 'sin-empresas' : 'sin-empresa';
}

/** ¿Se muestra "Costos de mecanizado" en el menú? Personal SECOCUT verificado, o usuario con empresaId (perfil ya cargado). */
export function veCostosEnMenu(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
  perfil: { empresaId?: string } | null | undefined,
  perfilCargando: boolean,
): boolean {
  if (isVerifiedSecocutUser(user)) return true;
  return !perfilCargando && typeof perfil?.empresaId === 'string' && perfil.empresaId !== '';
}

const tieneEmpresa = (perfil: { empresaId?: string } | null | undefined) => typeof perfil?.empresaId === 'string' && perfil.empresaId !== '';

/**
 * ¿Es un "cliente de empresa"? Tiene users/{uid}.empresaId y NO es personal SECOCUT verificado. Mismo criterio que
 * requireNotEmpresaCliente en el servidor. Solo gobierna qué se muestra; la protección real está en reglas y rutas /api.
 */
export function esClienteEmpresa(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
  perfil: { empresaId?: string } | null | undefined,
): boolean {
  return !isVerifiedSecocutUser(user) && tieneEmpresa(perfil);
}

/** Rutas que un cliente de empresa puede ver: /costos y todo lo que cuelga de /costos/, y /settings. Cualquier otra lo manda a /costos. */
export function rutaPermitidaCliente(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ['/costos', '/settings'].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}
