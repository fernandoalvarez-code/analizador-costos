import { describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

vi.mock('firebase/auth', () => ({ sendEmailVerification: vi.fn() }));

import { needsEmailVerification, refreshVerification, sendVerificationEmail } from '@/lib/client/email-verification';

const u = (emailVerified: boolean, providers: string[]) =>
  ({ emailVerified, providerData: providers.map((providerId) => ({ providerId })) }) as unknown as User;

describe('needsEmailVerification', () => {
  it('cuenta de email y contraseña sin verificar: sí', () => { expect(needsEmailVerification(u(false, ['password']))).toBe(true); });
  it('cuenta de email y contraseña ya verificada: no', () => { expect(needsEmailVerification(u(true, ['password']))).toBe(false); });
  it('cuenta de Google: no (llega verificada y no se muestra el aviso)', () => { expect(needsEmailVerification(u(false, ['google.com']))).toBe(false); });
  it('sin usuario: no', () => { expect(needsEmailVerification(null)).toBe(false); });
});

describe('sendVerificationEmail', () => {
  it('envía a la cuenta recibida', async () => {
    const send = vi.fn(async () => {});
    const user = u(false, ['password']);
    await sendVerificationEmail(user, send);
    expect(send).toHaveBeenCalledWith(user);
  });
  it('propaga el error (el banner lo muestra)', async () => {
    await expect(sendVerificationEmail(u(false, ['password']), vi.fn(async () => { throw new Error('too-many-requests'); }))).rejects.toThrow();
  });
});

describe('refreshVerification', () => {
  it('si ya está verificada refresca el token y devuelve true', async () => {
    const user = { emailVerified: false, reload: vi.fn(async function (this: { emailVerified: boolean }) { user.emailVerified = true; }), getIdToken: vi.fn(async () => 't') };
    expect(await refreshVerification(user)).toBe(true);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
  it('si todavía no, devuelve false y no refresca el token', async () => {
    const user = { emailVerified: false, reload: vi.fn(async () => {}), getIdToken: vi.fn(async () => 't') };
    expect(await refreshVerification(user)).toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
