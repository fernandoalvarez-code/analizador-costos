import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Las dos lecturas que hace el Historial de Análisis (src/app/(app)/history/page.tsx):
//  - admin: cuttingToolAnalyses completa + UNA lectura de `users` para armar el mapa uid → nombre.
//  - usuario normal: solo cuttingToolAnalyses filtrada por userId; NO lee `users`.
describe('Historial: lecturas de admin y de usuario normal', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', email: 'admin1@secocut.com', role: 'admin', name: 'Admin Uno' });
      await setDoc(doc(db, 'users/ana'), { id: 'ana', email: 'ana@secocut.com', role: 'user' });
      await setDoc(doc(db, 'users/beto'), { id: 'beto', email: 'beto@secocut.com', role: 'user', name: 'Beto' });
      await setDoc(doc(db, 'cuttingToolAnalyses/a1'), { userId: 'ana', clientName: 'Toyota' });
      await setDoc(doc(db, 'cuttingToolAnalyses/b1'), { userId: 'beto', cliente: 'Cañiflex SA' });
    });
  });

  const as = (uid: string) => env.authenticatedContext(uid, secocutVerified(`${uid}@secocut.com`)).firestore();

  it('un admin lista cuttingToolAnalyses completa y lista users para armar el mapa uid → nombre o email', async () => {
    const casos = await assertSucceeds(getDocs(collection(as('admin1'), 'cuttingToolAnalyses')));
    expect(casos.docs.map((d) => d.id).sort()).toEqual(['a1', 'b1']);
    const usuarios = await assertSucceeds(getDocs(collection(as('admin1'), 'users')));
    const mapa = new Map(usuarios.docs.map((d) => [d.id, d.data().name || d.data().email]));
    expect(mapa.get('ana')).toBe('ana@secocut.com');
    expect(mapa.get('beto')).toBe('Beto');
  });

  it('un usuario normal NO puede listar users (por eso el Historial no la lee si no es admin)', async () => {
    await assertFails(getDocs(collection(as('ana'), 'users')));
  });

  it('un usuario normal sí lista sus análisis con el filtro por userId, y no sin él', async () => {
    const snap = await assertSucceeds(getDocs(query(collection(as('ana'), 'cuttingToolAnalyses'), where('userId', '==', 'ana'))));
    expect(snap.docs.map((d) => d.id)).toEqual(['a1']);
    await assertFails(getDocs(collection(as('ana'), 'cuttingToolAnalyses')));
  });
});
