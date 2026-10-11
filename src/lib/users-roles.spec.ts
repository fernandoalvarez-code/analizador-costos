import { describe, expect, it } from 'vitest';
import { validateRoleChange, type ManagedUser } from '@/lib/users-roles';

const users: ManagedUser[] = [
  { id: 'admin1', role: 'admin' }, { id: 'admin2', role: 'admin' }, { id: 'ana', role: 'user' },
];

describe('validateRoleChange', () => {
  it('un admin promueve a otro usuario', () => { expect(validateRoleChange({ actorUid: 'admin1', targetUid: 'ana', newRole: 'admin', users }).ok).toBe(true); });
  it('un admin degrada a otro admin', () => { expect(validateRoleChange({ actorUid: 'admin1', targetUid: 'admin2', newRole: 'user', users }).ok).toBe(true); });
  it('no puede cambiar su propio rol', () => {
    const r = validateRoleChange({ actorUid: 'admin1', targetUid: 'admin1', newRole: 'user', users });
    expect(r).toEqual({ ok: false, reason: 'No podés cambiar tu propio rol.' });
  });
  it('rechaza un rol que no existe', () => { expect(validateRoleChange({ actorUid: 'admin1', targetUid: 'ana', newRole: 'superadmin', users }).ok).toBe(false); });
  it('rechaza un usuario inexistente', () => { expect(validateRoleChange({ actorUid: 'admin1', targetUid: 'nadie', newRole: 'admin', users }).ok).toBe(false); });
  it('siempre debe quedar al menos un admin', () => {
    const solo: ManagedUser[] = [{ id: 'admin1', role: 'admin' }, { id: 'zeta', role: 'admin' }];
    // el actor (admin1) no figura como admin en la lista (dato desactualizado) y degrada al único admin restante
    const r = validateRoleChange({ actorUid: 'otro', targetUid: 'zeta', newRole: 'user', users: [{ id: 'zeta', role: 'admin' }, { id: 'ana', role: 'user' }] });
    expect(r).toEqual({ ok: false, reason: 'Debe quedar al menos un administrador.' });
    expect(validateRoleChange({ actorUid: 'admin1', targetUid: 'zeta', newRole: 'user', users: solo }).ok).toBe(true);
  });
});
