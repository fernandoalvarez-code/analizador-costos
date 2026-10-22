import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Aislamiento entre empresas clientes (módulo de costos de mecanizado). Datos COMPARTIDOS dentro de la empresa: todos sus
// usuarios leen, crean, editan y borran máquinas y piezas. TODA rama exige email verificado.
describe('empresas/{empresaId}: aislamiento y modelo compartido', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });

  const T0 = Timestamp.fromMillis(1_000);
  const audit = (uid: string) => ({ createdAt: T0, createdBy: uid, updatedAt: T0, updatedBy: uid });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Usuarios. empresaId y empresasAsignadas los escribe el servidor: acá se siembran con las reglas desactivadas.
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', role: 'admin' });
      await setDoc(doc(db, 'users/adminGmail'), { id: 'adminGmail', role: 'admin' });
      await setDoc(doc(db, 'users/a1'), { id: 'a1', role: 'user', empresaId: 'emp-a' });
      await setDoc(doc(db, 'users/a2'), { id: 'a2', role: 'user', empresaId: 'emp-a' });
      await setDoc(doc(db, 'users/aSinVerificar'), { id: 'aSinVerificar', role: 'user', empresaId: 'emp-a' });
      await setDoc(doc(db, 'users/b1'), { id: 'b1', role: 'user', empresaId: 'emp-b' });
      await setDoc(doc(db, 'users/vend1'), { id: 'vend1', role: 'user', empresasAsignadas: ['emp-a'] });
      await setDoc(doc(db, 'users/vendSinVerificar'), { id: 'vendSinVerificar', role: 'user', empresasAsignadas: ['emp-a'] });
      await setDoc(doc(db, 'users/sinEmpresa'), { id: 'sinEmpresa', role: 'user' });
      // Empresas con una máquina y una pieza cada una
      for (const e of ['emp-a', 'emp-b']) {
        await setDoc(doc(db, `empresas/${e}`), { nombre: `Empresa ${e}`, plantas: ['P1'] });
        await setDoc(doc(db, `empresas/${e}/maquinas/m1`), { nombre: 'Torno', costoHora: 30, ...audit('semilla') });
        await setDoc(doc(db, `empresas/${e}/piezas/p1`), { codigo: 'P-1', nombre: 'Pieza', volumenAnual: 1000, ...audit('semilla') });
      }
    });
  });

  const cli = (uid: string, email = `${uid}@cliente.com`) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
  const ctxs = {
    a1: () => cli('a1'),
    a2: () => cli('a2'),
    b1: () => cli('b1'),
    aSinVerificar: () => env.authenticatedContext('aSinVerificar', { email: 'x@cliente.com', email_verified: false }).firestore(),
    sinEmpresa: () => cli('sinEmpresa'),
    sinPerfil: () => cli('sinPerfil'),
    vend1: () => env.authenticatedContext('vend1', secocutVerified('vend1@secocut.com')).firestore(),
    vendSinVerificar: () => env.authenticatedContext('vendSinVerificar', { email: 'v@secocut.com', email_verified: false }).firestore(),
    admin1: () => env.authenticatedContext('admin1', secocutVerified('admin1@secocut.com')).firestore(),
    adminGmail: () => env.authenticatedContext('adminGmail', { email: 'admin@gmail.com', email_verified: true }).firestore(),
    sinSesion: () => env.unauthenticatedContext().firestore(),
  };

  const maquinaNueva = (uid: string, over: Record<string, unknown> = {}) => ({ nombre: 'Nueva', costoHora: 40, createdAt: T0, createdBy: uid, updatedAt: T0, updatedBy: uid, ...over });
  const piezaNueva = (uid: string, over: Record<string, unknown> = {}) => ({ codigo: 'P-9', nombre: 'Nueva', volumenAnual: 10, createdAt: T0, createdBy: uid, updatedAt: T0, updatedBy: uid, ...over });

  describe('una empresa no ve ni toca a otra', () => {
    it('lee lo suyo: documento raíz, máquinas y piezas', async () => {
      const db = ctxs.a1();
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a')));
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a/maquinas/m1')));
      await assertSucceeds(getDocs(collection(db, 'empresas/emp-a/maquinas')));
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a/piezas/p1')));
      await assertSucceeds(getDocs(collection(db, 'empresas/emp-a/piezas')));
    });
    it('NO lee la empresa B (raíz, máquinas ni piezas)', async () => {
      const db = ctxs.a1();
      await assertFails(getDoc(doc(db, 'empresas/emp-b')));
      await assertFails(getDoc(doc(db, 'empresas/emp-b/maquinas/m1')));
      await assertFails(getDocs(collection(db, 'empresas/emp-b/maquinas')));
      await assertFails(getDoc(doc(db, 'empresas/emp-b/piezas/p1')));
      await assertFails(getDocs(collection(db, 'empresas/emp-b/piezas')));
    });
    it('NO escribe en la empresa B (crear, editar, borrar máquinas y piezas)', async () => {
      const db = ctxs.a1();
      await assertFails(setDoc(doc(db, 'empresas/emp-b/maquinas/nueva'), maquinaNueva('a1')));
      await assertFails(updateDoc(doc(db, 'empresas/emp-b/maquinas/m1'), { costoHora: 1, updatedBy: 'a1' }));
      await assertFails(deleteDoc(doc(db, 'empresas/emp-b/maquinas/m1')));
      await assertFails(setDoc(doc(db, 'empresas/emp-b/piezas/nueva'), piezaNueva('a1')));
      await assertFails(updateDoc(doc(db, 'empresas/emp-b/piezas/p1'), { nombre: 'x', updatedBy: 'a1' }));
      await assertFails(deleteDoc(doc(db, 'empresas/emp-b/piezas/p1')));
    });
    it('la empresa B tampoco ve a la A', async () => {
      await assertFails(getDoc(doc(ctxs.b1(), 'empresas/emp-a/piezas/p1')));
      await assertSucceeds(getDoc(doc(ctxs.b1(), 'empresas/emp-b/piezas/p1')));
    });
    it('un admin de otro dominio (no es @secocut) no accede a ninguna empresa', async () => {
      await assertFails(getDoc(doc(ctxs.adminGmail(), 'empresas/emp-a')));
      await assertFails(getDoc(doc(ctxs.adminGmail(), 'empresas/emp-a/piezas/p1')));
      await assertFails(getDocs(collection(ctxs.adminGmail(), 'empresas')));
    });
    it('quien no inició sesión no accede', async () => {
      await assertFails(getDoc(doc(ctxs.sinSesion(), 'empresas/emp-a')));
      await assertFails(getDoc(doc(ctxs.sinSesion(), 'empresas/emp-a/piezas/p1')));
    });
  });

  describe('documento raíz de la empresa', () => {
    it('un usuario de la empresa lo lee pero NO lo escribe (crear, editar ni borrar)', async () => {
      const db = ctxs.a1();
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a')));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a'), { nombre: 'Otro nombre' }));
      await assertFails(setDoc(doc(db, 'empresas/emp-nueva'), { nombre: 'Nueva' }));
      await assertFails(deleteDoc(doc(db, 'empresas/emp-a')));
    });
    it('el vendedor asignado tampoco lo escribe', async () => {
      await assertFails(updateDoc(doc(ctxs.vend1(), 'empresas/emp-a'), { nombre: 'Otro nombre' }));
    });
    it('el admin SECOCUT lo crea y lo edita, pero nadie lo borra (ni el admin)', async () => {
      const db = ctxs.admin1();
      await assertSucceeds(setDoc(doc(db, 'empresas/emp-nueva'), { nombre: 'Nueva', plantas: [] }));
      await assertSucceeds(updateDoc(doc(db, 'empresas/emp-a'), { nombre: 'Renombrada' }));
      await assertFails(deleteDoc(doc(db, 'empresas/emp-a')));
    });
    it('solo el admin SECOCUT lista las empresas', async () => {
      await assertSucceeds(getDocs(collection(ctxs.admin1(), 'empresas')));
      await assertFails(getDocs(collection(ctxs.a1(), 'empresas')));
      await assertFails(getDocs(collection(ctxs.vend1(), 'empresas')));
      await assertFails(getDocs(collection(ctxs.sinEmpresa(), 'empresas')));
    });
  });

  describe('email verificado en TODAS las ramas', () => {
    it('cliente con empresaId pero SIN email verificado: no lee ni escribe', async () => {
      const db = ctxs.aSinVerificar();
      await assertFails(getDoc(doc(db, 'empresas/emp-a')));
      await assertFails(getDoc(doc(db, 'empresas/emp-a/maquinas/m1')));
      await assertFails(getDocs(collection(db, 'empresas/emp-a/piezas')));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/nueva'), maquinaNueva('aSinVerificar')));
    });
    it('@secocut SIN email verificado no accede como vendedor', async () => {
      const db = ctxs.vendSinVerificar();
      await assertFails(getDoc(doc(db, 'empresas/emp-a')));
      await assertFails(getDoc(doc(db, 'empresas/emp-a/piezas/p1')));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/nueva'), maquinaNueva('vendSinVerificar')));
    });
  });

  describe('quién accede', () => {
    it('el vendedor solo accede a sus empresas asignadas', async () => {
      const db = ctxs.vend1();
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a')));
      await assertSucceeds(getDoc(doc(db, 'empresas/emp-a/piezas/p1')));
      await assertSucceeds(setDoc(doc(db, 'empresas/emp-a/maquinas/del-vendedor'), maquinaNueva('vend1')));
      await assertFails(getDoc(doc(db, 'empresas/emp-b')));
      await assertFails(getDoc(doc(db, 'empresas/emp-b/piezas/p1')));
      await assertFails(setDoc(doc(db, 'empresas/emp-b/maquinas/nueva'), maquinaNueva('vend1')));
    });
    it('el admin SECOCUT accede a todas', async () => {
      const db = ctxs.admin1();
      for (const e of ['emp-a', 'emp-b']) {
        await assertSucceeds(getDoc(doc(db, `empresas/${e}`)));
        await assertSucceeds(getDocs(collection(db, `empresas/${e}/piezas`)));
        await assertSucceeds(setDoc(doc(db, `empresas/${e}/maquinas/del-admin`), maquinaNueva('admin1')));
      }
    });
    it('un usuario sin empresaId no accede a ninguna empresa', async () => {
      const db = ctxs.sinEmpresa();
      await assertFails(getDoc(doc(db, 'empresas/emp-a')));
      await assertFails(getDoc(doc(db, 'empresas/emp-a/piezas/p1')));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/nueva'), maquinaNueva('sinEmpresa')));
    });
    it('un usuario SIN documento en users (exists() falso) queda denegado, sin error', async () => {
      const db = ctxs.sinPerfil();
      await assertFails(getDoc(doc(db, 'empresas/emp-a')));
      await assertFails(getDoc(doc(db, 'empresas/emp-a/piezas/p1')));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/nueva'), maquinaNueva('sinPerfil')));
    });
    it('otras subcolecciones de la empresa se leen pero no se escriben (la escritura no es genérica)', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'empresas/emp-a/otra/x'), { v: 1 }); });
      await assertSucceeds(getDoc(doc(ctxs.a1(), 'empresas/emp-a/otra/x')));
      await assertFails(setDoc(doc(ctxs.a1(), 'empresas/emp-a/otra/y'), { v: 1, updatedBy: 'a1', createdBy: 'a1' }));
    });
  });

  describe('modelo compartido: dos usuarios de la misma empresa', () => {
    it('ambos leen lo que cargó el otro', async () => {
      await assertSucceeds(setDoc(doc(ctxs.a1(), 'empresas/emp-a/maquinas/de-a1'), maquinaNueva('a1')));
      await assertSucceeds(getDoc(doc(ctxs.a2(), 'empresas/emp-a/maquinas/de-a1')));
      await assertSucceeds(setDoc(doc(ctxs.a2(), 'empresas/emp-a/piezas/de-a2'), piezaNueva('a2')));
      await assertSucceeds(getDoc(doc(ctxs.a1(), 'empresas/emp-a/piezas/de-a2')));
    });
    it('ambos crean, editan y borran máquinas y piezas, también las del otro', async () => {
      // a1 crea; a2 edita (updatedBy = a2, createdBy intacto) y borra
      await assertSucceeds(setDoc(doc(ctxs.a1(), 'empresas/emp-a/maquinas/mq'), maquinaNueva('a1')));
      await assertSucceeds(updateDoc(doc(ctxs.a2(), 'empresas/emp-a/maquinas/mq'), { costoHora: 55, updatedBy: 'a2', updatedAt: T0 }));
      await assertSucceeds(deleteDoc(doc(ctxs.a2(), 'empresas/emp-a/maquinas/mq')));
      await assertSucceeds(setDoc(doc(ctxs.a2(), 'empresas/emp-a/piezas/pz'), piezaNueva('a2')));
      await assertSucceeds(updateDoc(doc(ctxs.a1(), 'empresas/emp-a/piezas/pz'), { nombre: 'Editada', updatedBy: 'a1', updatedAt: T0 }));
      await assertSucceeds(deleteDoc(doc(ctxs.a1(), 'empresas/emp-a/piezas/pz')));
    });
  });

  describe('auditoría: updatedBy / createdBy / createdAt', () => {
    it('crear con createdBy o updatedBy de otro: denegado; sin esos campos: denegado', async () => {
      const db = ctxs.a1();
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/n1'), maquinaNueva('a1', { updatedBy: 'a2' })));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/n2'), maquinaNueva('a1', { createdBy: 'a2' })));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/piezas/n3'), piezaNueva('a1', { updatedBy: 'a2' })));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/piezas/n4'), piezaNueva('a1', { createdBy: 'a2' })));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/maquinas/n5'), { nombre: 'x', costoHora: 1 }));
      await assertFails(setDoc(doc(db, 'empresas/emp-a/piezas/n6'), { codigo: 'x' }));
    });
    it('editar con updatedBy distinto del uid propio (o sin updatedBy): denegado', async () => {
      const db = ctxs.a1();
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/maquinas/m1'), { costoHora: 99, updatedBy: 'a2' }));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/piezas/p1'), { nombre: 'x', updatedBy: 'a2' }));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/maquinas/m1'), { costoHora: 99 }));
    });
    it('editar alterando createdBy o createdAt: denegado', async () => {
      const db = ctxs.a1();
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/maquinas/m1'), { costoHora: 99, updatedBy: 'a1', createdBy: 'a1' }));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/maquinas/m1'), { costoHora: 99, updatedBy: 'a1', createdAt: Timestamp.fromMillis(5) }));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/piezas/p1'), { nombre: 'x', updatedBy: 'a1', createdBy: 'a1' }));
      await assertFails(updateDoc(doc(db, 'empresas/emp-a/piezas/p1'), { nombre: 'x', updatedBy: 'a1', createdAt: Timestamp.fromMillis(5) }));
    });
    it('editar bien (updatedBy propio, createdBy/createdAt sin tocar): permitido', async () => {
      const db = ctxs.a1();
      await assertSucceeds(updateDoc(doc(db, 'empresas/emp-a/maquinas/m1'), { costoHora: 99, updatedBy: 'a1', updatedAt: T0 }));
      await assertSucceeds(updateDoc(doc(db, 'empresas/emp-a/piezas/p1'), { nombre: 'x', updatedBy: 'a1', updatedAt: T0 }));
    });
  });

  describe('writeBatch REAL contra las reglas (recálculo en lote)', () => {
    async function sembrarPiezas(n: number) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (let i = 0; i < n; i += 100) {
          const b = writeBatch(db);
          for (let j = i; j < Math.min(n, i + 100); j++) b.set(doc(db, `empresas/emp-a/piezas/lote-${j}`), { codigo: `L-${j}`, nombre: 'Lote', volumenAnual: 10, ...audit('semilla') });
          await b.commit();
        }
      });
    }
    const batchUpdate = (db: ReturnType<typeof ctxs.a1>, desde: number, cantidad: number) => {
      const b = writeBatch(db);
      for (let j = desde; j < desde + cantidad; j++) b.update(doc(db, `empresas/emp-a/piezas/lote-${j}`), { recalculada: true, updatedBy: 'a1', updatedAt: T0 });
      return b.commit();
    };

    it('un batch de 100 piezas (edición) pasa las reglas', async () => {
      await sembrarPiezas(100);
      await assertSucceeds(batchUpdate(ctxs.a1(), 0, 100));
      let d: Record<string, unknown> | undefined;
      await env.withSecurityRulesDisabled(async (ctx) => { d = (await getDoc(doc(ctx.firestore(), 'empresas/emp-a/piezas/lote-99'))).data(); });
      expect(d).toMatchObject({ recalculada: true, createdBy: 'semilla' });
    });
    it('un batch de 100 piezas nuevas (creación) pasa las reglas', async () => {
      const db = ctxs.a1();
      const b = writeBatch(db);
      for (let j = 0; j < 100; j++) b.set(doc(db, `empresas/emp-a/piezas/nueva-${j}`), piezaNueva('a1', { codigo: `N-${j}` }));
      await assertSucceeds(b.commit());
    });
    it('un batch de 100 hecho por el vendedor y por el admin también pasa', async () => {
      await sembrarPiezas(100);
      await assertSucceeds((() => { const db = ctxs.vend1(); const b = writeBatch(db); for (let j = 0; j < 100; j++) b.update(doc(db, `empresas/emp-a/piezas/lote-${j}`), { v: 1, updatedBy: 'vend1' }); return b.commit(); })());
      await assertSucceeds((() => { const db = ctxs.admin1(); const b = writeBatch(db); for (let j = 0; j < 100; j++) b.update(doc(db, `empresas/emp-a/piezas/lote-${j}`), { v: 2, updatedBy: 'admin1' }); return b.commit(); })());
    });
    it('INFORMATIVO: un batch de 400 piezas (el SDK permite 500 por batch); se reporta si el emulador marca un límite', async () => {
      await sembrarPiezas(400);
      let resultado = 'pasó';
      try { await batchUpdate(ctxs.a1(), 0, 400); } catch (e) { resultado = `falló: ${(e as Error).message}`; }
      console.info(`[informativo] batch de 400 piezas contra las reglas: ${resultado}`);
      expect(typeof resultado).toBe('string');
    });
  });
});
