import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
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
    // Payload EXACTO de src/app/(app)/layout.tsx en el primer ingreso: { id, email, role: 'user' } con setDoc(..., { merge: true }).
    it('el payload real de layout.tsx (id, email, role) con setDoc merge:true se acepta como creación', async () => {
      await assertSucceeds(setDoc(doc(as('nuevo'), 'users/nuevo'), { id: 'nuevo', email: 'nuevo@secocut.com', role: 'user' }, { merge: true }));
    });
    it('el mismo payload con email null (cuenta sin email) también', async () => {
      await assertSucceeds(setDoc(doc(as('nuevo'), 'users/nuevo'), { id: 'nuevo', email: null, role: 'user' }, { merge: true }));
    });
    it('si el perfil ya existe, repetir el payload de layout.tsx NO pisa un rol admin (carrera entre dos pestañas)', async () => {
      await assertFails(setDoc(doc(as('admin1'), 'users/admin1'), { id: 'admin1', email: 'admin1@secocut.com', role: 'user' }, { merge: true }));
    });
    it('el nombre se agrega después con un update que solo trae name (src/app/(app)/settings/page.tsx)', async () => {
      await assertSucceeds(updateDoc(doc(as('ana'), 'users/ana'), { name: 'Ana' }));
    });
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

  // empresaId y empresasAsignadas definen a qué empresa cliente accede cada usuario: SOLO las escribe el servidor (Admin SDK).
  // Ni el dueño ni un admin desde el cliente. El dueño solo cambia id/email/name; el admin, solo role.
  describe('empresaId y empresasAsignadas: solo el servidor', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/cliente'), { id: 'cliente', email: 'cliente@cliente.com', role: 'user', empresaId: 'emp-a' });
        await setDoc(doc(ctx.firestore(), 'users/vendedor'), { id: 'vendedor', email: 'vendedor@secocut.com', role: 'user', empresasAsignadas: ['emp-a'] });
      });
    });
    const perfil = (uid: string, over: Record<string, unknown> = {}) => ({ id: uid, email: `${uid}@secocut.com`, role: 'user', ...over });

    it('crear el propio perfil con empresaId: denegado', async () => {
      await assertFails(setDoc(doc(as('nuevo'), 'users/nuevo'), perfil('nuevo', { empresaId: 'emp-a' })));
    });
    it('crear el propio perfil con empresasAsignadas: denegado', async () => {
      await assertFails(setDoc(doc(as('nuevo'), 'users/nuevo'), perfil('nuevo', { empresasAsignadas: ['emp-a'] })));
    });
    it('un usuario sin empresa NO se escribe una empresaId ni empresasAsignadas', async () => {
      await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { empresaId: 'emp-a' }));
      await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { empresasAsignadas: ['emp-a'] }));
    });
    it('un cliente NO cambia su empresaId a la de otro, ni la borra, ni se asigna empresas', async () => {
      await assertFails(updateDoc(doc(as('cliente'), 'users/cliente'), { empresaId: 'emp-b' }));
      await assertFails(updateDoc(doc(as('cliente'), 'users/cliente'), { empresasAsignadas: ['emp-a', 'emp-b'] }));
      await assertFails(updateDoc(doc(as('cliente'), 'users/cliente'), { empresaId: deleteField() }));
    });
    it('un vendedor NO se amplía sus empresasAsignadas', async () => {
      await assertFails(updateDoc(doc(as('vendedor'), 'users/vendedor'), { empresasAsignadas: ['emp-a', 'emp-b'] }));
    });
    it('mezclar un campo permitido con empresaId tampoco pasa', async () => {
      await assertFails(updateDoc(doc(as('cliente'), 'users/cliente'), { name: 'Cliente', empresaId: 'emp-b' }));
    });
    it('el dueño no puede escribir campos fuera de id, email y name', async () => {
      await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { isAdmin: true }));
    });
    it('el dueño sigue editando id, email y name', async () => {
      await assertSucceeds(updateDoc(doc(as('cliente'), 'users/cliente'), { name: 'Cliente Uno' }));
      await assertSucceeds(updateDoc(doc(as('cliente'), 'users/cliente'), { email: 'otro@cliente.com' }));
    });
    it('el merge de layout.tsx sobre un perfil que ya tiene empresaId (no cambia valores) sigue pasando', async () => {
      await assertSucceeds(setDoc(doc(as('cliente'), 'users/cliente'), { id: 'cliente', email: 'cliente@cliente.com', role: 'user' }, { merge: true }));
    });
    it('un admin NO asigna empresaId ni empresasAsignadas desde el cliente', async () => {
      await assertFails(updateDoc(doc(as('admin1'), 'users/ana'), { empresaId: 'emp-a' }));
      await assertFails(updateDoc(doc(as('admin1'), 'users/ana'), { empresasAsignadas: ['emp-a'] }));
      await assertFails(updateDoc(doc(as('admin1'), 'users/cliente'), { empresaId: 'emp-b' }));
    });
    it('un admin NO cambia el rol y la empresa en la misma escritura', async () => {
      await assertFails(updateDoc(doc(as('admin1'), 'users/ana'), { role: 'admin', empresaId: 'emp-a' }));
    });
    it('un admin sigue cambiando SOLO el rol de otro usuario, y no otros campos', async () => {
      await assertSucceeds(updateDoc(doc(as('admin1'), 'users/cliente'), { role: 'admin' }));
      await assertFails(updateDoc(doc(as('admin1'), 'users/ana'), { name: 'Cambiado por el admin' }));
    });
  });

  it('nadie borra perfiles, ni un admin', async () => {
    await assertFails(deleteDoc(doc(as('admin1'), 'users/ana')));
    await assertFails(deleteDoc(doc(as('ana'), 'users/ana')));
  });
});
