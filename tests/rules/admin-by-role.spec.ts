import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// El admin se decide SOLO por users/{uid}.role; ningún custom claim (token.admin) da permisos.
describe('admin por rol de Firestore, sin claims', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', email: 'admin@secocut.com', role: 'admin' });
      await setDoc(doc(db, 'users/user1'), { id: 'user1', email: 'user1@secocut.com', role: 'user' });
      await setDoc(doc(db, 'users/user2'), { id: 'user2', email: 'user2@secocut.com', role: 'user' });
      await setDoc(doc(db, 'simulations/s1'), { userId: 'user1', nombre: 'sim' });
    });
  });

  const as = (uid: string, claims: Record<string, unknown> = {}) =>
    env.authenticatedContext(uid, { ...secocutVerified(`${uid}@secocut.com`), ...claims }).firestore();

  describe('/simulations', () => {
    it('el dueño lee la suya', async () => { await assertSucceeds(getDoc(doc(as('user1'), 'simulations/s1'))); });
    it('otro usuario NO la lee', async () => { await assertFails(getDoc(doc(as('user2'), 'simulations/s1'))); });
    it('un admin (por rol) la lee', async () => { await assertSucceeds(getDoc(doc(as('admin1'), 'simulations/s1'))); });
    it('un claim admin:true NO da permisos si el rol no es admin (antes sí los daba)', async () => {
      await assertFails(getDoc(doc(as('user2', { admin: true }), 'simulations/s1')));
      await assertFails(setDoc(doc(as('user2', { admin: true }), 'simulations/s1'), { userId: 'user2' }));
    });
  });

  describe('pantallas de admin, solo con el rol de users/{uid}.role', () => {
    it('un admin lista usuarios; un user no', async () => {
      await assertSucceeds(getDocs(collection(as('admin1'), 'users')));
      await assertFails(getDocs(collection(as('user1'), 'users')));
    });
    it('un admin escribe settings y crea notificaciones; un user no', async () => {
      await assertSucceeds(setDoc(doc(as('admin1'), 'settings/general'), { companyLogoUrl: 'https://x/y.png' }));
      await assertFails(setDoc(doc(as('user1'), 'settings/general'), { companyLogoUrl: 'https://x/y.png' }));
      await assertSucceeds(addDoc(collection(as('admin1'), 'notifications'), { title: 't', recipientId: 'user1' }));
      await assertFails(addDoc(collection(as('user1'), 'notifications'), { title: 't', recipientId: 'user1' }));
    });
  });
});
