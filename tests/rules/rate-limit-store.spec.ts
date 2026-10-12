import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified, RULES_TEST_PROJECT_ID } from './helpers';
import { createFirestoreStore } from '@/lib/server/rate-limit';

// El almacén real de contadores contra el emulador (Admin SDK, que ignora las reglas), más la
// comprobación de que NINGÚN cliente puede leer ni escribir `rate_limits`.
describe('rate_limits', () => {
  let app: App; let db: Firestore; let env: RulesTestEnvironment;
  beforeAll(async () => {
    app = initializeApp({ projectId: RULES_TEST_PROJECT_ID }, 'rate-limit-test');
    db = getFirestore(app);
    env = await createRulesTestEnv();
  });
  afterAll(async () => { await env.cleanup(); await deleteApp(app); });

  const limits = (user: number, global: number) => ({ user, global });
  const base = { day: '2026-10-11', expireAt: new Date('2026-10-20T00:00:00Z') };

  it('corta al usuario en su límite y no toca el contador de otro', async () => {
    const store = createFirestoreStore(db);
    const args = { ...base, route: 'chat' as const, limits: limits(3, 100) };
    for (let i = 0; i < 3; i++) expect((await store.consume({ ...args, uid: 'ua' })).allowed).toBe(true);
    expect(await store.consume({ ...args, uid: 'ua' })).toEqual({ allowed: false, scope: 'user' });
    expect((await store.consume({ ...args, uid: 'ub' })).allowed).toBe(true);
  });

  it('el tope global corta y NO consume cupo del usuario cuando rechaza', async () => {
    const store = createFirestoreStore(db);
    const args = { ...base, route: 'agents-chat' as const, limits: limits(10, 2) };
    expect((await store.consume({ ...args, uid: 'u1' })).allowed).toBe(true);
    expect((await store.consume({ ...args, uid: 'u2' })).allowed).toBe(true);
    expect(await store.consume({ ...args, uid: 'u3' })).toEqual({ allowed: false, scope: 'global' });
    const u3 = await db.collection('rate_limits').doc('agents-chat__u3__2026-10-11').get();
    expect(u3.exists).toBe(false);
  });

  it('con requests simultáneas nunca se pasa del límite', async () => {
    const store = createFirestoreStore(db);
    const args = { ...base, route: 'suggest-cutting-data' as const, uid: 'uc', limits: limits(3, 100) };
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => store.consume(args)));
    const allowed = results.filter(r => r.status === 'fulfilled' && r.value.allowed).length;
    const stored = (await db.collection('rate_limits').doc('suggest-cutting-data__uc__2026-10-11').get()).get('count');
    expect(allowed).toBeLessThanOrEqual(3);
    expect(stored).toBe(allowed);
  });

  it('guarda expireAt para poder limpiar con una política TTL', async () => {
    const snap = await db.collection('rate_limits').doc('chat__ua__2026-10-11').get();
    expect(snap.get('expireAt').toDate().toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('las reglas cierran la colección a los clientes (incluido un @secocut.com verificado)', async () => {
    const client = env.authenticatedContext('u9', secocutVerified()).firestore();
    await assertFails(getDoc(doc(client, 'rate_limits/chat__ua__2026-10-11')));
    await assertFails(setDoc(doc(client, 'rate_limits/chat__u9__2026-10-11'), { count: 0 }));
  });
});
