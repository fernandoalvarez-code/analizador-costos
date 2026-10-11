export type UserRole = 'user' | 'admin';
export const USER_ROLES: readonly UserRole[] = ['user', 'admin'];

export type ManagedUser = { id: string; email?: string; name?: string; role?: string };

export type RoleChangeCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validación de interfaz para cambiar el rol de otro usuario. Espeja la regla de Firestore
 * (un admin cambia el rol de OTRO, solo a 'user' o 'admin') y agrega que siempre quede al menos
 * un administrador. La regla es la que protege de verdad; esto evita ofrecer acciones que fallarían.
 */
export function validateRoleChange(args: { actorUid: string; targetUid: string; newRole: string; users: ManagedUser[] }): RoleChangeCheck {
  const { actorUid, targetUid, newRole, users } = args;
  if (!USER_ROLES.includes(newRole as UserRole)) return { ok: false, reason: 'Rol inválido.' };
  if (targetUid === actorUid) return { ok: false, reason: 'No podés cambiar tu propio rol.' };
  if (!users.some((u) => u.id === targetUid)) return { ok: false, reason: 'El usuario ya no existe.' };
  const adminsAfter = users.filter((u) => (u.id === targetUid ? newRole : u.role) === 'admin').length;
  if (adminsAfter < 1) return { ok: false, reason: 'Debe quedar al menos un administrador.' };
  return { ok: true };
}
