import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

describe('/users', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', email: 'admin1@secocut.com', role: 'admin' });
      await setDoc(doc(db, 'users/admin2'), { id: 'admin2', email: 'admin2@secocut.com', role: 'admin' });
      await setDoc(doc(db, 'users/ana'), { id: 'ana', email: 'ana@secocut.com', role: 'user' });
      await setDoc(doc(db, 'users/beto'), { id: 'beto', email: 'beto@secocut.com', role: 'user' });
    });
  });

  const as = (uid: string) => env.authenticatedContext(uid, secocutVerified(`${uid}@secocut.com`)).firestore();

  describe('lectura', () => {
    it('cada usuario lee su propio perfil', async () => { await assertSucceeds(getDoc(doc(as('ana'), 'users/ana'))); });
    it('un usuario NO lee el perfil de otro', async () => { await assertFails(getDoc(doc(as('ana'), 'users/beto'))); });
    it('un admin lee cualquier perfil y lista a todos', async () => {
      await assertSucceeds(getDoc(doc(as('admin1'), 'users/ana')));
      await assertSucceeds(getDocs(collection(as('admin1'), 'users')));
    });
    it('un usuario no puede listar', async () => { await assertFails(getDocs(collection(as('ana'), 'users'))); });
    it('un usuario nuevo puede comprobar si existe su propio perfil (antes de crearlo)', async () => {
      await assertSucceeds(getDoc(doc(as('nuevo'), 'users/nuevo')));
    });
  });

  describe('creación', () => {
    const profile = (uid: string, over: Record<string, unknown> = {}) => ({ id: uid, email: `${uid}@secocut.com`, role: 'user', ...over });
    it('el propio perfil con rol user', async () => { await assertSucceeds(setDoc(doc(as('nuevo'), 'users/nuevo'), profile('nuevo'))); });
    it('el propio perfil con name (campo permitido)', async () => { await assertSucceeds(setDoc(doc(as('nuevo'), 'users/nuevo'), profile('nuevo', { name: 'Nuevo' }))); });
    it('NO con rol admin', async () => { await assertFails(setDoc(doc(as('nuevo'), 'users/nuevo'), profile('nuevo', { role: 'admin' }))); });
    it('NO el perfil de otro uid', async () => { await assertFails(setDoc(doc(as('nuevo'), 'users/otro'), profile('otro'))); });
    it('NO con campos extra (p. ej. isAdmin)', async () => { await assertFails(setDoc(doc(as('nuevo'), 'users/nuevo'), profile('nuevo', { isAdmin: true }))); });
    it('un admin tampoco crea perfiles ajenos', async () => { await assertFails(setDoc(doc(as('admin1'), 'users/otro'), profile('otro'))); });
  });

  describe('roles', () => {
    it('un admin promueve a otro usuario', async () => { await assertSucceeds(updateDoc(doc(as('admin1'), 'users/ana'), { role: 'admin' })); });
    it('un admin degrada a otro admin', async () => { await assertSucceeds(updateDoc(doc(as('admin1'), 'users/admin2'), { role: 'user' })); });
    it('un admin NO cambia su propio rol (así siempre queda al menos uno)', async () => {
      await assertFails(updateDoc(doc(as('admin1'), 'users/admin1'), { role: 'user' }));
    });
    it('un admin NO asigna un rol inventado', async () => { await assertFails(updateDoc(doc(as('admin1'), 'users/ana'), { role: 'superadmin' })); });
    it('un usuario NO se promueve a sí mismo', async () => { await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { role: 'admin' })); });
    it('un usuario NO cambia el rol de otro', async () => { await assertFails(updateDoc(doc(as('ana'), 'users/beto'), { role: 'admin' })); });
    it('un usuario edita su nombre sin tocar el rol', async () => { await assertSucceeds(updateDoc(doc(as('ana'), 'users/ana'), { name: 'Ana' })); });
    it('un usuario NO edita el nombre de otro', async () => { await assertFails(updateDoc(doc(as('ana'), 'users/beto'), { name: 'X' })); });
  });

  it('nadie borra perfiles, ni un admin', async () => {
    await assertFails(deleteDoc(doc(as('admin1'), 'users/ana')));
    await assertFails(deleteDoc(doc(as('ana'), 'users/ana')));
  });
});
