import { beforeEach, describe, expect, it, vi } from 'vitest';

// FRÁGIL: si falla tras tocar la ruta, revisar el orden guard → límite → validación → IA y que
// los módulos mockeados (admin-app, firebase-admin/auth, rate-limit, el flujo de IA) sigan igual.
const { verifyIdToken, enforceRateLimit, suggestToolingChanges, leerPerfil } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), enforceRateLimit: vi.fn(), suggestToolingChanges: vi.fn(), leerPerfil: vi.fn(),
}));
// Admin SDK de Firestore simulado: users/{uid} lo resuelve leerPerfil (perímetro del cliente de empresa).
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: (path: string) => ({ get: async () => leerPerfil(path) }) }),
}));
vi.mock('@/firebase/auth/admin-app', () => ({ initializeAdminApp: async () => ({}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('@/lib/server/rate-limit', () => ({ enforceRateLimit }));
vi.mock('@/ai/flows/suggest-tooling-changes', () => ({ suggestToolingChanges }));

import { POST } from '@/app/api/savings-suggestions/route';

const valid = {
  currentTool: 'End Mill Genérico', currentToolCost: 85, proposedTool: 'End Mill V-Plus', proposedToolCost: 140,
  cycleTimeReduction: 15, partsProducedPerShift: 120, shiftsPerDay: 3, daysPerWeek: 6, weeksPerYear: 50, machineHourlyRate: 95,
};
const decoded = (over: Record<string, unknown> = {}) => ({
  uid: 'u1', email: 'cliente@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...over,
});
const post = (authorization?: string, body: unknown = valid) => new Request('http://localhost/api/savings-suggestions', {
  method: 'POST', headers: { ...(authorization ? { authorization } : {}), 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  leerPerfil.mockResolvedValue({ exists: false, get: () => undefined });
  enforceRateLimit.mockResolvedValue({ ok: true });
  suggestToolingChanges.mockResolvedValue({ suggestions: '### Análisis General' });
});

describe('/api/savings-suggestions', () => {
  it('401 sin token y no llama a la IA', async () => {
    expect((await POST(post())).status).toBe(401);
    expect(suggestToolingChanges).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it('403 para anónimo o sin email verificado', async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: undefined, email_verified: false, firebase: { sign_in_provider: 'anonymous' } }));
    expect((await POST(post('Bearer t'))).status).toBe(403);
    verifyIdToken.mockResolvedValue(decoded({ email_verified: false }));
    expect((await POST(post('Bearer t'))).status).toBe(403);
    expect(suggestToolingChanges).not.toHaveBeenCalled();
  });

  it('429 si se agotó el límite, sin llamar a la IA', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    enforceRateLimit.mockResolvedValue({ ok: false, response: Response.json({ error: 'límite' }, { status: 429 }) });
    expect((await POST(post('Bearer t'))).status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith('savings-suggestions', 'u1');
    expect(suggestToolingChanges).not.toHaveBeenCalled();
  });

  it('400 con un body inválido o que no es JSON', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    expect((await POST(post('Bearer t', { ...valid, currentToolCost: -5 }))).status).toBe(400);
    expect((await POST(post('Bearer t', 'no es json'))).status).toBe(400);
    expect(suggestToolingChanges).not.toHaveBeenCalled();
  });

  it('200 con un usuario verificado de cualquier dominio', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    const res = await POST(post('Bearer t'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { suggestions: '### Análisis General' } });
  });

  it('502 con mensaje genérico si falla la IA', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    suggestToolingChanges.mockRejectedValue(new Error('clave interna ABC'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post('Bearer t'));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('ABC');
  });

  it('403 genérico a un cliente de empresa (users/{uid}.empresaId, no @secocut), sin límite ni IA', async () => {
    verifyIdToken.mockResolvedValue(decoded({ uid: 'cli1' }));
    leerPerfil.mockResolvedValue({ exists: true, get: (c: string) => (c === 'empresaId' ? 'emp-a' : undefined) });
    const res = await POST(post('Bearer t'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Sin permisos' });
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(suggestToolingChanges).not.toHaveBeenCalled();
  });

  it('falla cerrado: si no se puede leer el perfil, 403 y no llama a la IA', async () => {
    verifyIdToken.mockResolvedValue(decoded());
    leerPerfil.mockRejectedValue(new Error('caído'));
    expect((await POST(post('Bearer t'))).status).toBe(403);
    expect(suggestToolingChanges).not.toHaveBeenCalled();
  });
});
