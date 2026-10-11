import { beforeEach, describe, expect, it, vi } from 'vitest';

// Acceso a las rutas de IA con el Admin SDK simulado. FRÁGIL: si falla tras tocar una ruta,
// revisar que el guard siga siendo lo primero que se ejecuta y que los módulos mockeados
// (admin-app, firebase-admin/auth, openai, lib/agents/firestore-admin) sigan siendo los mismos.
const { verifyIdToken, enforceRateLimit } = vi.hoisted(() => ({ verifyIdToken: vi.fn(), enforceRateLimit: vi.fn() }));
vi.mock('@/lib/server/rate-limit', () => ({ enforceRateLimit }));
vi.mock('@/firebase/auth/admin-app', () => ({ initializeAdminApp: async () => ({}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('openai', () => ({
  default: class { chat = { completions: { create: async () => ({ choices: [{ message: { content: '{}' } }] }) } }; },
}));
vi.mock('@/lib/agents/firestore-admin', () => ({
  getAgentBySlugAdmin: async () => null, searchKnowledgeByTagsAdmin: async () => [],
  createChatSessionAdmin: async () => 's1', appendMessageAdmin: async () => {}, getChatSessionAdmin: async () => null,
}));

import { POST as chat } from '@/app/api/chat/route';
import { POST as suggest } from '@/app/api/suggest-cutting-data/route';
import { POST as agents } from '@/app/api/agents/chat/route';

const decoded = (over: Record<string, unknown> = {}) => ({
  uid: 'u1', email: 'vendedor@secocut.com', email_verified: true,
  firebase: { sign_in_provider: 'google.com' }, ...over,
});
const post = (authorization?: string) => new Request('http://localhost/api/x', {
  method: 'POST', headers: { ...(authorization ? { authorization } : {}), 'content-type': 'application/json' }, body: '{}',
}) as never;

beforeEach(() => { vi.clearAllMocks(); enforceRateLimit.mockResolvedValue({ ok: true }); });

// Rutas de la curva de costos: cualquier cuenta verificada y no anónima (cualquier dominio).
describe.each([['/api/chat', chat], ['/api/suggest-cutting-data', suggest]] as const)('%s (requireVerifiedUser)', (_n, POST) => {
  it('401 sin token', async () => { expect((await POST(post())).status).toBe(401); });

  it('403 para una cuenta anónima', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: undefined, email_verified: false, firebase: { sign_in_provider: 'anonymous' } }));
    expect((await POST(post('Bearer t'))).status).toBe(403);
  });

  it('403 si el email no está verificado (cualquier dominio)', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: 'cliente@gmail.com', email_verified: false }));
    expect((await POST(post('Bearer t'))).status).toBe(403);
  });

  it('un usuario verificado de otro dominio PASA el guard (no se rompe a quien hoy la usa)', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: 'cliente@gmail.com' }));
    const status = (await POST(post('Bearer t'))).status;
    expect([401, 403]).not.toContain(status);
  });
});

// Agentes internos: solo @secocut.com verificado.
describe('/api/agents/chat (requireSecucutUser)', () => {
  it('401 sin token', async () => { expect((await agents(post())).status).toBe(401); });

  it('403 para un verificado de otro dominio', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: 'cliente@gmail.com' }));
    expect((await agents(post('Bearer t'))).status).toBe(403);
  });

  it('403 para un @secocut.com sin verificar', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email_verified: false }));
    expect((await agents(post('Bearer t'))).status).toBe(403);
  });

  it('un @secocut.com verificado pasa el guard (400 por body vacío)', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    expect((await agents(post('Bearer t'))).status).toBe(400);
  });
});

// El límite de uso se consulta DESPUÉS del guard y su respuesta se devuelve tal cual.
describe.each([['chat', 'chat', chat, 'u1'], ['suggest-cutting-data', 'suggest-cutting-data', suggest, 'u1'], ['agents-chat', 'agents/chat', agents, 'u1']] as const)(
  'límite de uso en %s', (key, _label, POST, uid) => {
    it('si el límite se agotó devuelve esa respuesta (429)', async () => {
      verifyIdToken.mockResolvedValue(decoded());
      enforceRateLimit.mockResolvedValue({ ok: false, response: Response.json({ error: 'límite' }, { status: 429 }) });
      expect((await POST(post('Bearer t'))).status).toBe(429);
      expect(enforceRateLimit).toHaveBeenCalledWith(key, uid);
    });

    it('si el contador falla (503) la ruta no sigue', async () => {
      verifyIdToken.mockResolvedValue(decoded());
      enforceRateLimit.mockResolvedValue({ ok: false, response: Response.json({ error: 'no disponible' }, { status: 503 }) });
      expect((await POST(post('Bearer t'))).status).toBe(503);
    });

    it('sin autenticación ni siquiera consulta el contador', async () => {
      await POST(post());
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });
  });
