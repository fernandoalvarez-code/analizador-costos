import https from 'node:https';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Con safe-fetch REAL (sin simular): las URL internas se rechazan antes de abrir ninguna conexión.
const { verifyIdToken, batchCommit } = vi.hoisted(() => ({ verifyIdToken: vi.fn(), batchCommit: vi.fn(async () => {}) }));
vi.mock('@/firebase/auth/admin-app', () => ({ initializeAdminApp: async () => ({}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ batch: () => ({ set: vi.fn(), commit: batchCommit }), collection: () => ({ doc: () => ({}) }) }),
}));

import { POST } from '@/app/api/knowledge/upload-url/route';

const reqFor = (url: string) => new Request('http://localhost/api/knowledge/upload-url', {
  method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ url }),
}) as never;

beforeEach(() => {
  vi.restoreAllMocks();
  verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'vendedor@secocut.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } });
});

describe('/api/knowledge/upload-url bloquea destinos internos', () => {
  it.each([
    'https://169.254.169.254/computeMetadata/v1/', 'https://127.0.0.1/', 'https://localhost/admin', 'https://10.0.0.8/', 'https://192.168.1.1/',
    'https://[::1]/', 'https://metadata.google.internal/', 'https://2130706433/', 'https://example.com:8443/', 'http://example.com/',
  ])('%s → 400 y no se abre ninguna conexión', async (url) => {
    const requestSpy = vi.spyOn(https, 'request');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await POST(reqFor(url));
    expect(res.status).toBe(400);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
