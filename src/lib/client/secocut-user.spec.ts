import { describe, expect, it } from 'vitest';
import { isVerifiedSecocutUser } from '@/lib/client/secocut-user';

describe('isVerifiedSecocutUser', () => {
  it('@secocut.com verificado: sí', () => { expect(isVerifiedSecocutUser({ email: 'a@secocut.com', emailVerified: true })).toBe(true); });
  it('con mayúsculas: sí', () => { expect(isVerifiedSecocutUser({ email: 'Fernando@SECOCUT.com', emailVerified: true })).toBe(true); });
  it('@secocut.com SIN verificar: no (antes mostraba el menú interno)', () => { expect(isVerifiedSecocutUser({ email: 'a@secocut.com', emailVerified: false })).toBe(false); });
  it('otro dominio verificado: no', () => { expect(isVerifiedSecocutUser({ email: 'a@gmail.com', emailVerified: true })).toBe(false); });
  it.each(['a@evilsecocut.com', 'a@secocut.com.ar', 'a@sub.secocut.com'])('%s: no', (email) => { expect(isVerifiedSecocutUser({ email, emailVerified: true })).toBe(false); });
  it('sin usuario, sin email o sin emailVerified: no', () => {
    expect(isVerifiedSecocutUser(null)).toBe(false);
    expect(isVerifiedSecocutUser({ email: null, emailVerified: true })).toBe(false);
    expect(isVerifiedSecocutUser({ email: 'a@secocut.com' })).toBe(false);
  });
});
