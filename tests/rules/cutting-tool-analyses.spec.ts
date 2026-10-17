import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Consultas reales de la app sobre cuttingToolAnalyses: Historial (admin sin filtro / resto por userId),
// Gestión de Casos y Dashboard (case-stats, cases-table), stale-case-checker (admin, status == 'Pendiente')
// y las ediciones que hace un admin sobre casos de otros usuarios.
describe('/cuttingToolAnalyses', () => {
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
      await setDoc(doc(db, 'cuttingToolAnalyses/a-curva'), { userId: 'ana', taylorInputs: {}, clientName: 'Toyota', status: 'Pendiente' });
      await setDoc(doc(db, 'cuttingToolAnalyses/b-caso'), { userId: 'beto', name: 'Cañiflex', cliente: 'Cañiflex SA', status: 'Pendiente' });
      await setDoc(doc(db, 'cuttingToolAnalyses/legacy'), { name: 'Sin dueño', status: 'Exitoso' });
    });
  });

  const as = (uid: string) => env.authenticatedContext(uid, secocutVerified(`${uid}@secocut.com`)).firestore();
  const col = (uid: string) => collection(as(uid), 'cuttingToolAnalyses');
  const ids = (snap: { docs: { id: string }[] }) => snap.docs.map((d) => d.id).sort();

  describe('listados', () => {
    it('un usuario lista filtrando por su userId y recibe solo lo suyo (Historial, cases-table, case-stats)', async () => {
      const snap = await assertSucceeds(getDocs(query(col('ana'), where('userId', '==', 'ana'))));
      expect(ids(snap)).toEqual(['a-curva']);
    });
    it('un usuario NO lista sin filtro', async () => { await assertFails(getDocs(col('ana'))); });
    it('un usuario NO lista filtrando por el userId de otro', async () => {
      await assertFails(getDocs(query(col('ana'), where('userId', '==', 'beto'))));
    });
    it('un usuario NO lista por status (la consulta del stale-case-checker es solo de admin)', async () => {
      await assertFails(getDocs(query(col('ana'), where('status', '==', 'Pendiente'))));
    });
    it('un admin lista toda la colección sin filtro (Historial de admin), incluidos los sin userId', async () => {
      const snap = await assertSucceeds(getDocs(col('admin1')));
      expect(ids(snap)).toEqual(['a-curva', 'b-caso', 'legacy']);
    });
    it('un admin lista por status == Pendiente (stale-case-checker)', async () => {
      const snap = await assertSucceeds(getDocs(query(col('admin1'), where('status', '==', 'Pendiente'))));
      expect(ids(snap)).toEqual(['a-curva', 'b-caso']);
    });
    it('los documentos sin userId no aparecen en el listado de un usuario', async () => {
      const snap = await assertSucceeds(getDocs(query(col('beto'), where('userId', '==', 'beto'))));
      expect(ids(snap)).toEqual(['b-caso']);
    });
  });

  describe('lectura por id', () => {
    it('el dueño lee el suyo', async () => { await assertSucceeds(getDoc(doc(as('ana'), 'cuttingToolAnalyses/a-curva'))); });
    it('otro usuario NO lo lee', async () => { await assertFails(getDoc(doc(as('ana'), 'cuttingToolAnalyses/b-caso'))); });
    it('un usuario NO lee uno sin userId', async () => { await assertFails(getDoc(doc(as('ana'), 'cuttingToolAnalyses/legacy'))); });
    it('un admin lee cualquiera', async () => { await assertSucceeds(getDoc(doc(as('admin1'), 'cuttingToolAnalyses/b-caso'))); });
  });

  describe('creación', () => {
    const base = { name: 'Nuevo', status: 'Pendiente' };
    it('con su propio userId', async () => { await assertSucceeds(addDoc(col('ana'), { ...base, userId: 'ana' })); });
    it('con el userId de otro: no', async () => { await assertFails(addDoc(col('ana'), { ...base, userId: 'beto' })); });
    it('sin userId: no', async () => { await assertFails(addDoc(col('ana'), base)); });
  });

  describe('edición y borrado', () => {
    it('el dueño edita el suyo', async () => {
      await assertSucceeds(updateDoc(doc(as('ana'), 'cuttingToolAnalyses/a-curva'), { status: 'ok' }));
    });
    it('un usuario NO edita el de otro', async () => {
      await assertFails(updateDoc(doc(as('ana'), 'cuttingToolAnalyses/b-caso'), { status: 'ok' }));
    });
    it('un admin edita el caso de otro conservando su userId (editor de curvas)', async () => {
      await assertSucceeds(updateDoc(doc(as('admin1'), 'cuttingToolAnalyses/a-curva'), { userId: 'ana', annualSavings: 10 }));
    });
    it('el dueño borra el suyo; otro usuario no; un admin sí', async () => {
      await assertFails(deleteDoc(doc(as('ana'), 'cuttingToolAnalyses/b-caso')));
      await assertSucceeds(deleteDoc(doc(as('ana'), 'cuttingToolAnalyses/a-curva')));
      await assertSucceeds(deleteDoc(doc(as('admin1'), 'cuttingToolAnalyses/b-caso')));
    });
  });
});
