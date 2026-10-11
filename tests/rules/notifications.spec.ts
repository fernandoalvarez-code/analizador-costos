import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Cada notificación tiene un destinatario (recipientId = dueño del caso); los admins leen todas;
// solo un admin crea, edita o borra.
describe('/notifications', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', role: 'admin' });
      await setDoc(doc(db, 'users/ana'), { id: 'ana', role: 'user' });
      await setDoc(doc(db, 'users/beto'), { id: 'beto', role: 'user' });
      await setDoc(doc(db, 'notifications/n-ana'), { title: 'para Ana', recipientId: 'ana', createdAt: 2 });
      await setDoc(doc(db, 'notifications/n-beto'), { title: 'para Beto', recipientId: 'beto', createdAt: 1 });
      await setDoc(doc(db, 'notifications/n-vieja'), { title: 'anterior, sin destinatario', createdAt: 0 });
    });
  });

  const as = (uid: string) => env.authenticatedContext(uid, secocutVerified(`${uid}@secocut.com`)).firestore();

  it('el destinatario lee la suya', async () => {
    await assertSucceeds(getDoc(doc(as('ana'), 'notifications/n-ana')));
  });

  it('otro usuario NO lee la de alguien más', async () => {
    await assertFails(getDoc(doc(as('beto'), 'notifications/n-ana')));
  });

  it('la consulta del encabezado (recipientId == uid) funciona para un no admin', async () => {
    await assertSucceeds(getDocs(query(collection(as('ana'), 'notifications'), where('recipientId', '==', 'ana'), limit(50))));
  });

  it('una consulta sin filtro es rechazada para un no admin (por eso el encabezado espera el rol)', async () => {
    await assertFails(getDocs(query(collection(as('ana'), 'notifications'), orderBy('createdAt', 'desc'), limit(5))));
    await assertFails(getDocs(query(collection(as('ana'), 'notifications'), where('recipientId', '==', 'beto'))));
  });

  it('un admin lee todas, incluidas las anteriores sin destinatario', async () => {
    await assertSucceeds(getDocs(query(collection(as('admin1'), 'notifications'), orderBy('createdAt', 'desc'), limit(5))));
    await assertSucceeds(getDoc(doc(as('admin1'), 'notifications/n-vieja')));
  });

  it('las anteriores sin recipientId no las ve un no admin', async () => {
    await assertFails(getDoc(doc(as('ana'), 'notifications/n-vieja')));
  });

  it('solo un admin crea, edita y borra', async () => {
    await assertSucceeds(addDoc(collection(as('admin1'), 'notifications'), { title: 'nueva', recipientId: 'ana' }));
    await assertFails(addDoc(collection(as('ana'), 'notifications'), { title: 'x', recipientId: 'ana' }));
    await assertFails(updateDoc(doc(as('ana'), 'notifications/n-ana'), { title: 'cambiada' }));
    await assertFails(deleteDoc(doc(as('ana'), 'notifications/n-ana')));
    await assertSucceeds(updateDoc(doc(as('admin1'), 'notifications/n-ana'), { title: 'cambiada' }));
  });

  it('un usuario no autenticado no lee nada', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'notifications/n-ana')));
  });
});
