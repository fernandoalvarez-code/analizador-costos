import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prueba de las dos rutas de conocimiento con el Admin SDK simulado. FRÁGIL: si falla tras
// tocar las rutas, revisar (1) que sigan importando initializeAdminApp / firebase-admin con
// estas mismas rutas de módulo y (2) que el orden siga siendo guard → lectura del body.
const { verifyIdToken, batchSet, batchCommit, safeFetchText } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), batchSet: vi.fn(), batchCommit: vi.fn(async () => {}), safeFetchText: vi.fn(),
}));
vi.mock('@/firebase/auth/admin-app', () => ({ initializeAdminApp: async () => ({}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ batch: () => ({ set: batchSet, commit: batchCommit }), collection: () => ({ doc: () => ({}) }) }),
}));
vi.mock('pdf-parse/lib/pdf-parse.js', () => ({ default: vi.fn() }));
// La descarga con protección SSRF se prueba aparte (safe-fetch.spec.ts); acá se simula su resultado.
vi.mock('@/lib/server/safe-fetch', async (orig) => ({ ...(await orig<typeof import('@/lib/server/safe-fetch')>()), safeFetchText }));

import { POST as uploadUrl } from '@/app/api/knowledge/upload-url/route';
import { POST as uploadPdf } from '@/app/api/knowledge/upload-pdf/route';

const decoded = (over: Record<string, unknown> = {}) => ({
  uid: 'u1', email: 'vendedor@secocut.com', email_verified: true,
  firebase: { sign_in_provider: 'google.com' }, ...over,
});

const urlReq = (authorization?: string) => new Request('http://localhost/api/knowledge/upload-url', {
  method: 'POST', headers: { ...(authorization ? { authorization } : {}), 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/catalogo' }),
}) as never;
const pdfReq = (authorization?: string) => new Request('http://localhost/api/knowledge/upload-pdf', {
  method: 'POST', headers: authorization ? { authorization } : {}, body: new FormData(),
}) as never;

const routes = [['upload-url', uploadUrl, urlReq], ['upload-pdf', uploadPdf, pdfReq]] as const;

beforeEach(() => {
  vi.clearAllMocks();
  safeFetchText.mockResolvedValue({ kind: 'ok', status: 200, text: `<title>Catálogo</title><p>${'Inserto de torneado de alta productividad. '.repeat(10)}</p>` });
});

describe.each(routes)('/api/knowledge/%s', (_name, POST, makeReq) => {
  it('401 sin token', async () => {
    expect((await POST(makeReq())).status).toBe(401);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('403 para un @secocut.com SIN email verificado (antes pasaba)', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email_verified: false }));
    expect((await POST(makeReq('Bearer t'))).status).toBe(403);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('403 para una cuenta anónima', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: undefined, email_verified: false, firebase: { sign_in_provider: 'anonymous' } }));
    expect((await POST(makeReq('Bearer t'))).status).toBe(403);
  });

  it('403 para un usuario verificado de otro dominio', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: 'cliente@gmail.com' }));
    expect((await POST(makeReq('Bearer t'))).status).toBe(403);
    expect(batchCommit).not.toHaveBeenCalled();
  });
});

describe('usuario SECOCUT verificado (con mayúsculas en el email)', () => {
  it('upload-url guarda el contenido con createdBy en minúsculas', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: 'Vendedor@SECOCUT.com' }));
    const res = await uploadUrl(urlReq('Bearer t'));
    expect(res.status).toBe(200);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(batchSet.mock.calls[0][1].createdBy).toBe('vendedor@secocut.com');
  });

  it('upload-pdf pasa el guard (responde 400 porque no se mandó archivo)', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    expect((await uploadPdf(pdfReq('Bearer t'))).status).toBe(400);
  });
});

describe('upload-url: respuesta ante una descarga rechazada', () => {
  beforeEach(() => verifyIdToken.mockResolvedValue(decoded()));

  it('una URL no permitida devuelve 400 genérico y no guarda nada', async () => {
    const { UnsafeUrlError } = await import('@/lib/server/safe-fetch');
    safeFetchText.mockRejectedValue(new UnsafeUrlError('IP no permitida 10.0.0.5'));
    const res = await uploadUrl(urlReq('Bearer t'));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('10.0.0.5');
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('una redirección devuelve 400 y no guarda nada', async () => {
    safeFetchText.mockResolvedValue({ kind: 'redirect', status: 302 });
    const res = await uploadUrl(urlReq('Bearer t'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('redirige');
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('un error de red no filtra el detalle (no sirve para explorar la red interna)', async () => {
    safeFetchText.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:443'));
    const res = await uploadUrl(urlReq('Bearer t'));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('ECONNREFUSED');
  });

  it('una url que no es texto devuelve 400 (antes era un error 500)', async () => {
    const res = await uploadUrl(new Request('http://localhost/x', {
      method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ url: { toString: 'https://x' } }),
    }) as never);
    expect(res.status).toBe(400);
  });
});
