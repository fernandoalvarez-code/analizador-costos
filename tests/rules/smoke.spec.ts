import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Prueba de humo de la infraestructura: caracteriza isSecucutEmail() sobre una
// colección existente (ai_agents), antes de agregar reglas nuevas.
describe('isSecucutEmail (ai_agents, reglas actuales)', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });

  it('permite escribir a un @secocut.com verificado', async () => {
    const db = env.authenticatedContext('u1', secocutVerified()).firestore();
    await assertSucceeds(setDoc(doc(db, 'ai_agents/a1'), { nombre: 'x' }));
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
