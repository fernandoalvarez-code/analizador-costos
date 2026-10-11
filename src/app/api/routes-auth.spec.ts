import { beforeEach, describe, expect, it, vi } from 'vitest';

// Acceso a las rutas de IA con el Admin SDK simulado. FRÁGIL: si falla tras tocar una ruta,
// revisar que el guard siga siendo lo primero que se ejecuta y que los módulos mockeados
// (admin-app, firebase-admin/auth, openai, lib/agents/firestore-admin) sigan siendo los mismos.
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
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

beforeEach(() => vi.clearAllMocks());

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
