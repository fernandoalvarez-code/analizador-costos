import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Prueba de humo de la infraestructura: caracteriza isSecocutAdmin() (que incluye isSecucutEmail())
// sobre una colección existente (ai_agents). El detalle completo está en agentes-privacidad.spec.ts.
describe('isSecocutAdmin (escritura de ai_agents)', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });

  it('permite escribir a un admin @secocut.com verificado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/u1'), { id: 'u1', role: 'admin' }); });
    const db = env.authenticatedContext('u1', secocutVerified()).firestore();
    await assertSucceeds(setDoc(doc(db, 'ai_agents/a1'), { nombre: 'x' }));
  });

  it('rechaza a un @secocut.com verificado que no es admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/u0'), { id: 'u0', role: 'user' }); });
    const db = env.authenticatedContext('u0', secocutVerified()).firestore();
    await assertFails(setDoc(doc(db, 'ai_agents/a0'), { nombre: 'x' }));
  });

  it('rechaza a un @secocut.com sin email verificado', async () => {
    const db = env.authenticatedContext('u2', { email: 'x@secocut.com', email_verified: false }).firestore();
    await assertFails(setDoc(doc(db, 'ai_agents/a2'), { nombre: 'x' }));
  });

  it('rechaza a un usuario verificado de otro dominio', async () => {
    const db = env.authenticatedContext('u3', { email: 'x@otra.com', email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'ai_agents/a3'), { nombre: 'x' }));
  });
});
