import { describe, expect, it } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { requireSecucutUser, requireVerifiedUser, type VerifyIdToken } from '@/lib/server/auth-guards';

const req = (authorization?: string) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: authorization ? { authorization } : {} });

const token = (over: Partial<DecodedIdToken> & { provider?: string } = {}): DecodedIdToken => {
  const { provider = 'google.com', ...rest } = over;
  return {
    uid: 'u1', email: 'vendedor@secocut.com', email_verified: true,
    firebase: { sign_in_provider: provider, identities: {} },
    ...rest,
  } as DecodedIdToken;
};
const verifying = (decoded: DecodedIdToken): VerifyIdToken => async () => decoded;
const rejecting: VerifyIdToken = async () => { throw new Error('token expirado (detalle interno)'); };

async function body(res: Response) { return res.json(); }

describe.each([['requireVerifiedUser', requireVerifiedUser], ['requireSecucutUser', requireSecucutUser]] as const)('%s', (_n, guard) => {
  it('401 sin header Authorization', async () => {
    const r = await guard(req(), verifying(token()));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.response.status).toBe(401); expect(await body(r.response)).toEqual({ error: 'No autorizado' }); }
  });

  it('401 con esquema que no es Bearer', async () => {
    const r = await guard(req('Basic abc'), verifying(token()));
    expect(!r.ok && r.response.status).toBe(401);
  });

  it('401 si el token no se puede verificar, sin filtrar el motivo', async () => {
    const r = await guard(req('Bearer abc'), rejecting);
    expect(!r.ok && r.response.status).toBe(401);
    if (!r.ok) expect(JSON.stringify(await body(r.response))).not.toContain('expirado');
  });

  it('403 para una cuenta anónima', async () => {
    const r = await guard(req('Bearer abc'), verifying(token({ provider: 'anonymous', email: undefined, email_verified: false })));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it('403 si el email no está verificado (aunque sea @secocut.com)', async () => {
    const r = await guard(req('Bearer abc'), verifying(token({ email_verified: false })));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it('403 si el token no trae email', async () => {
    const r = await guard(req('Bearer abc'), verifying(token({ email: undefined })));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it('la respuesta 403 es genérica y no incluye el email', async () => {
    const r = await guard(req('Bearer abc'), verifying(token({ email_verified: false })));
    if (!r.ok) expect(await body(r.response)).toEqual({ error: 'Sin permisos' });
  });
});

describe('dominio', () => {
  it('requireVerifiedUser acepta un usuario verificado de cualquier dominio', async () => {
    const r = await requireVerifiedUser(req('Bearer abc'), verifying(token({ email: 'cliente@gmail.com' })));
    expect(r.ok).toBe(true);
  });

  it('requireSecucutUser rechaza a un usuario verificado de otro dominio', async () => {
    const r = await requireSecucutUser(req('Bearer abc'), verifying(token({ email: 'cliente@gmail.com' })));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it('requireSecucutUser acepta mayúsculas y devuelve el email en minúsculas', async () => {
    const r = await requireSecucutUser(req('Bearer abc'), verifying(token({ email: 'Fernando@SECOCUT.com' })));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.email).toBe('fernando@secocut.com');
  });

  it.each(['a@evilsecocut.com', 'a@secocut.com.ar', 'a@secocut.com@gmail.com', 'secocut.com', 'a@sub.secocut.com'])(
    'requireSecucutUser rechaza %s', async (email) => {
      const r = await requireSecucutUser(req('Bearer abc'), verifying(token({ email })));
      expect(!r.ok && r.response.status).toBe(403);
    });
});
