import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Política: cada usuario ve lo que creó; el admin SECOCUT ve todo; gestionar agentes y conocimiento es solo del
// admin SECOCUT (users/{uid}.role == 'admin' Y email verificado @secocut.com = isSecocutAdmin()).
describe('agentes, conocimiento y sesiones de chat: privacidad', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/adm1'), { id: 'adm1', role: 'admin' });       // admin SECOCUT
      await setDoc(doc(db, 'users/adm2'), { id: 'adm2', role: 'admin' });       // admin de otro dominio
      await setDoc(doc(db, 'users/adm3'), { id: 'adm3', role: 'admin' });       // admin @secocut sin verificar
      await setDoc(doc(db, 'users/ana'), { id: 'ana', role: 'user' });
      await setDoc(doc(db, 'users/beto'), { id: 'beto', role: 'user' });
      await setDoc(doc(db, 'ai_agents/a1'), { slug: 'agente', isActive: true });
      await setDoc(doc(db, 'knowledge_entries/k1'), { title: 'catálogo', content: 'interno' });
      await setDoc(doc(db, 'chat_sessions/s-ana'), { userId: 'ana', messages: [] });
      await setDoc(doc(db, 'chat_sessions/s-beto'), { userId: 'beto', messages: [] });
      await setDoc(doc(db, 'chat_sessions/s-vieja'), { messages: [] });          // sin campo userId
    });
  });

  const as = {
    adminSecocut: () => env.authenticatedContext('adm1', secocutVerified('admin@secocut.com')).firestore(),
    adminOtroDominio: () => env.authenticatedContext('adm2', { email: 'admin@gmail.com', email_verified: true }).firestore(),
    adminSinVerificar: () => env.authenticatedContext('adm3', { email: 'admin3@secocut.com', email_verified: false }).firestore(),
    ana: () => env.authenticatedContext('ana', secocutVerified('ana@secocut.com')).firestore(),
    beto: () => env.authenticatedContext('beto', secocutVerified('beto@secocut.com')).firestore(),
    sinPerfil: () => env.authenticatedContext('nuevo', secocutVerified('nuevo@secocut.com')).firestore(),
    sinSesion: () => env.unauthenticatedContext().firestore(),
  };

  describe.each([['ai_agents', 'a1'], ['knowledge_entries', 'k1']])('%s', (col, id) => {
    describe('lectura: cualquier @secocut verificado', () => {
      it('la lee un @secocut verificado que no es admin', async () => { await assertSucceeds(getDoc(doc(as.ana(), `${col}/${id}`))); });
      it('la lee el admin SECOCUT', async () => { await assertSucceeds(getDoc(doc(as.adminSecocut(), `${col}/${id}`))); });
      it('NO la lee un admin de OTRO dominio (no es @secocut)', async () => { await assertFails(getDoc(doc(as.adminOtroDominio(), `${col}/${id}`))); });
      it('NO la lee quien no inició sesión', async () => { await assertFails(getDoc(doc(as.sinSesion(), `${col}/${id}`))); });
    });

    describe('escritura: solo el admin SECOCUT', () => {
      it('el admin SECOCUT crea, edita y borra', async () => {
        const db = as.adminSecocut();
        await assertSucceeds(setDoc(doc(db, `${col}/nuevo`), { title: 'x' }));
        await assertSucceeds(updateDoc(doc(db, `${col}/${id}`), { isActive: false }));
        await assertSucceeds(deleteDoc(doc(db, `${col}/${id}`)));
      });
      it('un @secocut verificado NO admin lee pero NO escribe', async () => {
        const db = as.ana();
        await assertSucceeds(getDoc(doc(db, `${col}/${id}`)));
        await assertFails(setDoc(doc(db, `${col}/nuevo`), { title: 'x' }));
        await assertFails(updateDoc(doc(db, `${col}/${id}`), { isActive: false }));
        await assertFails(deleteDoc(doc(db, `${col}/${id}`)));
      });
      it('un admin de OTRO dominio NO escribe', async () => {
        const db = as.adminOtroDominio();
        await assertFails(setDoc(doc(db, `${col}/nuevo`), { title: 'x' }));
        await assertFails(updateDoc(doc(db, `${col}/${id}`), { isActive: false }));
        await assertFails(deleteDoc(doc(db, `${col}/${id}`)));
      });
      it('un admin @secocut con el email SIN verificar NO escribe ni lee', async () => {
        const db = as.adminSinVerificar();
        await assertFails(setDoc(doc(db, `${col}/nuevo`), { title: 'x' }));
        await assertFails(getDoc(doc(db, `${col}/${id}`)));
      });
      it('un @secocut verificado SIN perfil en users NO escribe (exists antes del get)', async () => {
        await assertFails(setDoc(doc(as.sinPerfil(), `${col}/nuevo`), { title: 'x' }));
      });
      it('quien no inició sesión NO escribe', async () => { await assertFails(setDoc(doc(as.sinSesion(), `${col}/nuevo`), { title: 'x' })); });
    });
  });

  describe('chat_sessions', () => {
    it('el dueño lee, edita y borra la suya', async () => {
      const db = as.ana();
      await assertSucceeds(getDoc(doc(db, 'chat_sessions/s-ana')));
      await assertSucceeds(updateDoc(doc(db, 'chat_sessions/s-ana'), { messages: [{ role: 'user', content: 'hola' }] }));
      await assertSucceeds(deleteDoc(doc(db, 'chat_sessions/s-ana')));
    });
    it('el dueño lista las suyas filtrando por userId (consulta de la pantalla de pruebas)', async () => {
      await assertSucceeds(getDocs(query(collection(as.ana(), 'chat_sessions'), where('userId', '==', 'ana'))));
    });
    it('el dueño NO lista sin filtro ni filtrando por otro userId', async () => {
      await assertFails(getDocs(collection(as.ana(), 'chat_sessions')));
      await assertFails(getDocs(query(collection(as.ana(), 'chat_sessions'), where('userId', '==', 'beto'))));
    });
    it('otro @secocut verificado (no dueño, no admin) NO tiene acceso', async () => {
      const db = as.beto();
      await assertFails(getDoc(doc(db, 'chat_sessions/s-ana')));
      await assertFails(updateDoc(doc(db, 'chat_sessions/s-ana'), { messages: [] }));
      await assertFails(deleteDoc(doc(db, 'chat_sessions/s-ana')));
    });
    it('el admin SECOCUT lee, edita y borra las de cualquiera, y lista todas', async () => {
      const db = as.adminSecocut();
      await assertSucceeds(getDoc(doc(db, 'chat_sessions/s-ana')));
      await assertSucceeds(updateDoc(doc(db, 'chat_sessions/s-beto'), { messages: [] }));
      await assertSucceeds(getDocs(collection(db, 'chat_sessions')));
      await assertSucceeds(deleteDoc(doc(db, 'chat_sessions/s-ana')));
    });
    it('un admin de OTRO dominio NO tiene acceso', async () => {
      const db = as.adminOtroDominio();
      await assertFails(getDoc(doc(db, 'chat_sessions/s-ana')));
      await assertFails(updateDoc(doc(db, 'chat_sessions/s-ana'), { messages: [] }));
      await assertFails(deleteDoc(doc(db, 'chat_sessions/s-ana')));
      await assertFails(getDocs(collection(db, 'chat_sessions')));
    });
    it('una sesión SIN userId solo la ve el admin SECOCUT', async () => {
      await assertFails(getDoc(doc(as.ana(), 'chat_sessions/s-vieja')));
      await assertFails(getDoc(doc(as.beto(), 'chat_sessions/s-vieja')));
      await assertFails(getDoc(doc(as.adminOtroDominio(), 'chat_sessions/s-vieja')));
      await assertFails(updateDoc(doc(as.ana(), 'chat_sessions/s-vieja'), { messages: [] }));
      await assertFails(deleteDoc(doc(as.ana(), 'chat_sessions/s-vieja')));
      await assertSucceeds(getDoc(doc(as.adminSecocut(), 'chat_sessions/s-vieja')));
      await assertSucceeds(updateDoc(doc(as.adminSecocut(), 'chat_sessions/s-vieja'), { messages: [] }));
      await assertSucceeds(deleteDoc(doc(as.adminSecocut(), 'chat_sessions/s-vieja')));
    });
    it('quien no inició sesión NO tiene acceso', async () => {
      await assertFails(getDoc(doc(as.sinSesion(), 'chat_sessions/s-ana')));
      await assertFails(deleteDoc(doc(as.sinSesion(), 'chat_sessions/s-ana')));
    });
  });
});
