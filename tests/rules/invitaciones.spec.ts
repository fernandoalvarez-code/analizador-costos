import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// `invitaciones` está CERRADA a todos los clientes: solo el servidor (Admin SDK) la lee y escribe.
describe('invitaciones (reglas)', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', email: 'admin@secocut.com', role: 'admin' });
      await setDoc(doc(db, 'users/vend1'), { id: 'vend1', email: 'vend@secocut.com', role: 'user', empresasAsignadas: ['e1'] });
      await setDoc(doc(db, 'users/cli1'), { id: 'cli1', email: 'cli@cliente.com', role: 'user', empresaId: 'e1' });
      await setDoc(doc(db, 'invitaciones/i1'), { email: 'cli@cliente.com', empresaId: 'e1', createdBy: 'admin1', usada: false });
    });
  });

  const actores = {
    'cliente de la empresa': () => env.authenticatedContext('cli1', { email: 'cli@cliente.com', email_verified: true }),
    'vendedor asignado': () => env.authenticatedContext('vend1', secocutVerified('vend@secocut.com')),
    'admin SECOCUT': () => env.authenticatedContext('admin1', secocutVerified('admin@secocut.com')),
    'sin autenticar': () => env.unauthenticatedContext(),
  } as const;

  describe.each(Object.entries(actores))('%s', (_n, ctx) => {
    it('no puede leer ni listar invitaciones', async () => {
      const db = ctx().firestore();
      await assertFails(getDoc(doc(db, 'invitaciones/i1')));
      await assertFails(getDocs(collection(db, 'invitaciones')));
    });
    it('no puede crear, modificar ni borrar invitaciones', async () => {
      const db = ctx().firestore();
      await assertFails(addDoc(collection(db, 'invitaciones'), { email: 'x@y.com', empresaId: 'e1', usada: false }));
      await assertFails(setDoc(doc(db, 'invitaciones/i2'), { email: 'x@y.com', empresaId: 'e1', usada: false }));
      await assertFails(updateDoc(doc(db, 'invitaciones/i1'), { usada: true }));
      await assertFails(deleteDoc(doc(db, 'invitaciones/i1')));
    });
  });
});
