import { describe, expect, it, vi } from 'vitest';
import { enforceRateLimit, getLimits, type ConsumeResult, type CounterStore } from '@/lib/server/rate-limit';

// Contador en memoria con la misma semántica que el de Firestore (el de Firestore se prueba
// contra el emulador en tests/rules/rate-limit-store.spec.ts).
function memoryStore(): CounterStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async consume({ route, uid, day, limits }): Promise<ConsumeResult> {
      const uKey = `${route}__${uid}__${day}`, gKey = `${route}__GLOBAL__${day}`;
      if ((counts.get(uKey) ?? 0) >= limits.user) return { allowed: false, scope: 'user' };
      if ((counts.get(gKey) ?? 0) >= limits.global) return { allowed: false, scope: 'global' };
      counts.set(uKey, (counts.get(uKey) ?? 0) + 1);
      counts.set(gKey, (counts.get(gKey) ?? 0) + 1);
      return { allowed: true };
    },
  };
}

const NOON = new Date('2026-10-11T12:00:00Z');
const env = (o: Record<string, string> = {}) => o;

describe('getLimits', () => {
  it('valores por defecto provisorios', () => {
    expect(getLimits('chat', env())).toEqual({ user: 40, global: 300 });
    expect(getLimits('agents-chat', env())).toEqual({ user: 40, global: 300 });
    expect(getLimits('suggest-cutting-data', env())).toEqual({ user: 40, global: 300 });
    expect(getLimits('savings-suggestions', env())).toEqual({ user: 20, global: 300 });
  });
  it('se configuran por variable de entorno', () => {
    expect(getLimits('chat', env({ RATE_LIMIT_CHAT_USER_DAILY: '5', RATE_LIMIT_CHAT_GLOBAL_DAILY: '9' }))).toEqual({ user: 5, global: 9 });
    expect(getLimits('savings-suggestions', env({ RATE_LIMIT_SAVINGS_SUGGESTIONS_USER_DAILY: '0' })).user).toBe(0);
  });
  it('una variable inválida cae al valor por defecto', () => {
    expect(getLimits('chat', env({ RATE_LIMIT_CHAT_USER_DAILY: 'abc', RATE_LIMIT_CHAT_GLOBAL_DAILY: '-3' }))).toEqual({ user: 40, global: 300 });
    expect(getLimits('chat', env({ RATE_LIMIT_CHAT_USER_DAILY: '2.5' })).user).toBe(40);
  });
});

describe('enforceRateLimit', () => {
  const cfg = env({ RATE_LIMIT_CHAT_USER_DAILY: '3', RATE_LIMIT_CHAT_GLOBAL_DAILY: '5' });

  it('deja pasar hasta el límite y después responde 429 con mensaje claro y Retry-After', async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) expect((await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg })).ok).toBe(true);
    const r = await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(429);
      expect(r.response.headers.get('Retry-After')).toBe(String(12 * 3600)); // mediodía UTC → 12 h hasta la medianoche
      expect((await r.response.json()).error).toContain('límite diario de 3');
    }
  });

  it('los usuarios no se pisan entre sí', async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg });
    expect((await enforceRateLimit('chat', 'u2', { store, now: NOON, env: cfg })).ok).toBe(true);
  });

  it('el tope global corta a todos y el mensaje no habla del usuario', async () => {
    const store = memoryStore();
    for (const uid of ['a', 'b', 'c', 'd', 'e']) expect((await enforceRateLimit('chat', uid, { store, now: NOON, env: cfg })).ok).toBe(true);
    const r = await enforceRateLimit('chat', 'f', { store, now: NOON, env: cfg });
    expect(!r.ok && r.response.status).toBe(429);
    if (!r.ok) expect((await r.response.json()).error).toContain('alcanzó su límite diario');
  });

  it('las rutas tienen contadores separados', async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg });
    expect((await enforceRateLimit('agents-chat', 'u1', { store, now: NOON, env: cfg })).ok).toBe(true);
  });

  it('al cambiar el día UTC se renueva el cupo', async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg });
    expect((await enforceRateLimit('chat', 'u1', { store, now: NOON, env: cfg })).ok).toBe(false);
    expect((await enforceRateLimit('chat', 'u1', { store, now: new Date('2026-10-12T00:00:01Z'), env: cfg })).ok).toBe(true);
  });

  it('límite 0 bloquea la ruta', async () => {
    const r = await enforceRateLimit('chat', 'u1', { store: memoryStore(), now: NOON, env: env({ RATE_LIMIT_CHAT_USER_DAILY: '0' }) });
    expect(!r.ok && r.response.status).toBe(429);
  });

  it('FALLA CERRADO: si el contador falla responde 503 y no filtra el motivo', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: CounterStore = { consume: async () => { throw new Error('credenciales internas XYZ'); } };
    const r = await enforceRateLimit('chat', 'u1', { store: broken, now: NOON, env: cfg });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(503);
      expect(JSON.stringify(await r.response.json())).not.toContain('XYZ');
    }
    spy.mockRestore();
  });
});
