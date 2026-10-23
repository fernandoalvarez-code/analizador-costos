import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createRulesTestEnv, RULES_TEST_PROJECT_ID } from './helpers';
import { createFirestoreStore } from '@/lib/server/rate-limit';
import type { VerifyIdToken } from '@/lib/server/auth-guards';
import {
  deleteInvitacion, getInvitacionMia, getInvitaciones, postCanjear, postInvitacion, postVendedor, type CostosDeps,
} from '@/lib/server/costos-handlers';
import type { AuthLookup } from '@/lib/server/costos-invitaciones';
import { requireSecocutAdmin } from '@/lib/server/costos-guards';

// Rutas /api/costos/** (handlers) contra el emulador de Firestore con el Admin SDK. Los tokens se inyectan: "Bearer <clave>" → claims.
const AHORA = new Date('2026-10-20T12:00:00Z');
const DIA = 24 * 3600 * 1000;

const tokens: Record<string, Partial<DecodedIdToken>> = {
  admin: { uid: 'admin1', email: 'Admin@Secocut.com', email_verified: true },
  adminOtroDominio: { uid: 'admin2', email: 'admin@otro.com', email_verified: true },
  vendedor: { uid: 'vend1', email: 'vend@secocut.com', email_verified: true },
  cliente: { uid: 'cli1', email: 'Cli@Cliente.com', email_verified: true },
  clienteSinVerificar: { uid: 'cli1', email: 'cli@cliente.com', email_verified: false },
  otro: { uid: 'otro1', email: 'otro@cliente.com', email_verified: true },
  secocutNuevo: { uid: 'nuevo1', email: 'nuevo@secocut.com', email_verified: true },
};
const verify: VerifyIdToken = async (t) => {
  const c = tokens[t];
  if (!c) throw new Error('token inválido (detalle interno)');
  return { firebase: { sign_in_provider: 'google.com', identities: {} }, ...c } as DecodedIdToken;
};
const call = (clave?: string, init: { method?: string; body?: unknown; url?: string } = {}) =>
  new Request(init.url ?? 'http://localhost/api/costos/x', {
    method: init.method ?? 'POST',
    headers: { ...(clave ? { authorization: `Bearer ${clave}` } : {}), 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

describe('rutas /api/costos (emulador)', () => {
  let app: App; let db: Firestore; let env: RulesTestEnvironment; let deps: CostosDeps;
  // Firebase Auth simulado (solo corre el emulador de Firestore): email → cuenta.
  const cuentas: Record<string, { uid: string; email: string; emailVerified: boolean }> = {};
  const auth: AuthLookup = {
    getUserByEmail: async (email) => { const c = cuentas[email]; if (!c) throw new Error('auth/user-not-found (detalle interno)'); return c; },
  };

  beforeAll(async () => {
    app = initializeApp({ projectId: RULES_TEST_PROJECT_ID }, 'costos-invitaciones-test');
    db = getFirestore(app);
    env = await createRulesTestEnv();
  });
  afterAll(async () => { await env.cleanup(); await deleteApp(app); });

  const inv = (over: Record<string, unknown> = {}) => ({
    email: 'cli@cliente.com', empresaId: 'e1', createdBy: 'admin1', createdAt: Timestamp.fromDate(new Date(AHORA.getTime() - DIA)),
    expiresAt: Timestamp.fromDate(new Date(AHORA.getTime() + 6 * DIA)), usada: false, ...over,
  });

  beforeEach(async () => {
    await env.clearFirestore();
    deps = {
      verify, db, auth, now: AHORA, store: createFirestoreStore(db),
      readRole: async (uid) => { const s = await db.doc(`users/${uid}`).get(); return s.exists ? s.get('role') : undefined; },
    };
    for (const k of Object.keys(cuentas)) delete cuentas[k];
    cuentas['vend@secocut.com'] = { uid: 'vend1', email: 'vend@secocut.com', emailVerified: true };
    cuentas['cli@cliente.com'] = { uid: 'cli1', email: 'cli@cliente.com', emailVerified: true };
    await db.doc('empresas/e1').set({ nombre: 'Metalúrgica Uno' });
    await db.doc('empresas/e2').set({ nombre: 'Metalúrgica Dos' });
    await db.doc('users/admin1').set({ id: 'admin1', email: 'admin@secocut.com', role: 'admin' });
    await db.doc('users/admin2').set({ id: 'admin2', email: 'admin@otro.com', role: 'admin' });
    await db.doc('users/vend1').set({ id: 'vend1', email: 'vend@secocut.com', role: 'user' });
    await db.doc('users/cli1').set({ id: 'cli1', email: 'cli@cliente.com', role: 'user' });
  });

  const sinMotivo = async (r: Response) => {
    const texto = JSON.stringify(await r.clone().json());
    for (const palabra of ['invitaci', 'venc', 'usada', 'email', 'empresa', 'detalle', 'admin']) expect(texto.toLowerCase()).not.toContain(palabra);
  };

  describe('requireSecocutAdmin', () => {
    it('falla cerrado si el documento no existe o la lectura del rol falla', async () => {
      const r1 = await requireSecocutAdmin(call('secocutNuevo'), verify, deps.readRole);
      expect(!r1.ok && r1.response.status).toBe(403);
      const r2 = await requireSecocutAdmin(call('admin'), verify, async () => { throw new Error('boom interno'); });
      expect(!r2.ok && r2.response.status).toBe(403);
      if (!r2.ok) expect(JSON.stringify(await r2.response.json())).not.toContain('boom');
    });
    it('un usuario @secocut con role user es 403 y el admin pasa', async () => {
      const r1 = await requireSecocutAdmin(call('vendedor'), verify, deps.readRole);
      expect(!r1.ok && r1.response.status).toBe(403);
      const r2 = await requireSecocutAdmin(call('admin'), verify, deps.readRole);
      expect(r2.ok).toBe(true);
    });
  });

  describe('POST /invitaciones (crear)', () => {
    const crear = (clave: string | undefined, body: unknown) => postInvitacion(call(clave, { body }), deps);

    it('admin crea: email en minúsculas y recortado, vence en 7 días, usada false', async () => {
      const r = await crear('admin', { empresaId: 'e1', email: '  Nuevo@Cliente.COM ' });
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.expiresAt).toBe('2026-10-27T12:00:00.000Z');
      expect(Object.keys(j).sort()).toEqual(['expiresAt', 'id']);
      const d = (await db.doc(`invitaciones/${j.id}`).get()).data()!;
      expect(d.email).toBe('nuevo@cliente.com');
      expect(d.empresaId).toBe('e1');
      expect(d.createdBy).toBe('admin1');
      expect(d.usada).toBe(false);
      expect(d.expiresAt.toDate().toISOString()).toBe('2026-10-27T12:00:00.000Z');
      expect(d.createdAt.toDate().toISOString()).toBe('2026-10-20T12:00:00.000Z');
    });
    it('no admin → 403 y no crea nada', async () => {
      const r = await crear('vendedor', { empresaId: 'e1', email: 'a@b.com' });
      expect(r.status).toBe(403);
      await sinMotivo(r);
      expect((await db.collection('invitaciones').get()).size).toBe(0);
    });
    it('admin de otro dominio → 403; sin token → 401', async () => {
      expect((await crear('adminOtroDominio', { empresaId: 'e1', email: 'a@b.com' })).status).toBe(403);
      expect((await crear(undefined, { empresaId: 'e1', email: 'a@b.com' })).status).toBe(401);
      expect((await db.collection('invitaciones').get()).size).toBe(0);
    });
    it('pendiente duplicada → devuelve la existente, sin crear otra', async () => {
      await db.doc('invitaciones/existente').set(inv());
      const r = await crear('admin', { empresaId: 'e1', email: 'CLI@cliente.com' });
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.id).toBe('existente');
      expect(j.expiresAt).toBe('2026-10-26T12:00:00.000Z');
      expect((await db.collection('invitaciones').get()).size).toBe(1);
    });
    it('una vencida o usada no cuenta como pendiente: se crea una nueva', async () => {
      await db.doc('invitaciones/vieja').set(inv({ expiresAt: Timestamp.fromDate(new Date(AHORA.getTime() - 1000)) }));
      await db.doc('invitaciones/usada').set(inv({ usada: true }));
      const j = await (await crear('admin', { empresaId: 'e1', email: 'cli@cliente.com' })).json();
      expect(['vieja', 'usada']).not.toContain(j.id);
      expect((await db.collection('invitaciones').get()).size).toBe(3);
    });
    it('empresa inexistente → 404 genérico', async () => {
      const r = await crear('admin', { empresaId: 'no-existe', email: 'a@b.com' });
      expect(r.status).toBe(404);
      await sinMotivo(r);
      expect((await db.collection('invitaciones').get()).size).toBe(0);
    });
    it('email o empresaId inválidos → 400', async () => {
      expect((await crear('admin', { empresaId: 'e1', email: 'no-es-email' })).status).toBe(400);
      expect((await crear('admin', { empresaId: 'a/b', email: 'a@b.com' })).status).toBe(400);
      expect((await crear('admin', { email: 'a@b.com' })).status).toBe(400);
    });
  });

  describe('GET /invitaciones?empresaId (listar)', () => {
    it('admin ve pendientes, usadas y vencidas de la empresa, sin las de otra', async () => {
      await db.doc('invitaciones/p').set(inv({ email: 'p@c.com' }));
      await db.doc('invitaciones/u').set(inv({ email: 'u@c.com', usada: true, usadaPor: 'x', usadaAt: Timestamp.fromDate(AHORA) }));
      await db.doc('invitaciones/v').set(inv({ email: 'v@c.com', expiresAt: Timestamp.fromDate(new Date(AHORA.getTime() - 1000)) }));
      await db.doc('invitaciones/otra').set(inv({ email: 'o@c.com', empresaId: 'e2' }));
      const r = await getInvitaciones(call('admin', { method: 'GET', url: 'http://localhost/api/costos/invitaciones?empresaId=e1' }), deps);
      expect(r.status).toBe(200);
      const lista = (await r.json()).invitaciones as { id: string; estado: string; email: string; usadaAt: string | null }[];
      expect(lista.map((i) => [i.id, i.estado]).sort()).toEqual([['p', 'pendiente'], ['u', 'usada'], ['v', 'vencida']]);
      expect(lista.find((i) => i.id === 'u')!.usadaAt).toBe('2026-10-20T12:00:00.000Z');
      expect(lista.find((i) => i.id === 'p')!.usadaAt).toBeNull();
    });
    it('no admin → 403; sin empresaId → 400', async () => {
      const url = 'http://localhost/api/costos/invitaciones?empresaId=e1';
      expect((await getInvitaciones(call('cliente', { method: 'GET', url }), deps)).status).toBe(403);
      expect((await getInvitaciones(call('vendedor', { method: 'GET', url }), deps)).status).toBe(403);
      expect((await getInvitaciones(call('admin', { method: 'GET', url: 'http://localhost/api/costos/invitaciones' }), deps)).status).toBe(400);
    });
  });

  describe('DELETE /invitaciones/{id} (revocar)', () => {
    const revocar = (clave: string, id: string) => deleteInvitacion(call(clave, { method: 'DELETE' }), id, deps);
    it('admin revoca una no usada', async () => {
      await db.doc('invitaciones/i1').set(inv());
      expect((await revocar('admin', 'i1')).status).toBe(200);
      expect((await db.doc('invitaciones/i1').get()).exists).toBe(false);
    });
    it('una usada no se revoca; una inexistente → 404; no admin → 403', async () => {
      await db.doc('invitaciones/i1').set(inv({ usada: true }));
      expect((await revocar('admin', 'i1')).status).toBe(404);
      expect((await db.doc('invitaciones/i1').get()).exists).toBe(true);
      expect((await revocar('admin', 'nada')).status).toBe(404);
      expect((await revocar('cliente', 'i1')).status).toBe(403);
    });
  });

  describe('GET /invitaciones/mia', () => {
    const mia = (clave?: string) => getInvitacionMia(call(clave, { method: 'GET' }), deps);
    it('devuelve solo {invitacionId, empresaNombre, expiresAt} de la más reciente para el email del token', async () => {
      await db.doc('invitaciones/vieja').set(inv({ createdAt: Timestamp.fromDate(new Date(AHORA.getTime() - 3 * DIA)) }));
      await db.doc('invitaciones/nueva').set(inv({ empresaId: 'e2' }));
      await db.doc('invitaciones/ajena').set(inv({ email: 'otro@cliente.com', createdAt: Timestamp.fromDate(AHORA) }));
      const r = await mia('cliente');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({
        invitacion: { invitacionId: 'nueva', empresaNombre: 'Metalúrgica Dos', expiresAt: '2026-10-26T12:00:00.000Z' },
      });
    });
    it('sin invitación, o con la única usada/vencida → 200 {invitacion:null}', async () => {
      expect(await (await mia('cliente')).json()).toEqual({ invitacion: null });
      await db.doc('invitaciones/u').set(inv({ usada: true }));
      await db.doc('invitaciones/v').set(inv({ expiresAt: Timestamp.fromDate(new Date(AHORA.getTime() - 1000)) }));
      expect(await (await mia('cliente')).json()).toEqual({ invitacion: null });
    });
    it('un @secocut no ve invitaciones; email sin verificar o sin token no entra', async () => {
      await db.doc('invitaciones/s').set(inv({ email: 'vend@secocut.com' }));
      expect(await (await mia('vendedor')).json()).toEqual({ invitacion: null });
      expect((await mia('clienteSinVerificar')).status).toBe(403);
      expect((await mia(undefined)).status).toBe(401);
    });
  });

  describe('POST /invitaciones/canjear', () => {
    const canjear = (clave: string | undefined, body: unknown) => postCanjear(call(clave, { body }), deps);

    it('caso feliz: escribe empresaId sin tocar el rol y marca la invitación', async () => {
      await db.doc('invitaciones/i1').set(inv());
      const r = await canjear('cliente', { invitacionId: 'i1' });
      expect(r.status).toBe(200);
      const u = (await db.doc('users/cli1').get()).data()!;
      expect(u.empresaId).toBe('e1');
      expect(u.role).toBe('user');
      expect(u.email).toBe('cli@cliente.com');
      const i = (await db.doc('invitaciones/i1').get()).data()!;
      expect(i.usada).toBe(true);
      expect(i.usadaPor).toBe('cli1');
      expect(i.usadaAt.toDate().toISOString()).toBe('2026-10-20T12:00:00.000Z');
    });
    it('si el perfil todavía no existe, lo crea como role user', async () => {
      await db.doc('users/cli1').delete();
      await db.doc('invitaciones/i1').set(inv());
      expect((await canjear('cliente', { invitacionId: 'i1' })).status).toBe(200);
      expect((await db.doc('users/cli1').get()).data()).toEqual({ id: 'cli1', email: 'cli@cliente.com', role: 'user', empresaId: 'e1' });
    });
    it('es idempotente respecto de la misma empresa solo una vez: reusar la invitación falla', async () => {
      await db.doc('invitaciones/i1').set(inv());
      expect((await canjear('cliente', { invitacionId: 'i1' })).status).toBe(200);
      expect((await canjear('cliente', { invitacionId: 'i1' })).status).toBe(403);
    });

    const rechazos: [string, () => Promise<Response>][] = [
      ['email distinto al de la invitación', async () => { await db.doc('invitaciones/i1').set(inv()); await db.doc('users/otro1').set({ id: 'otro1', email: 'otro@cliente.com', role: 'user' }); return canjear('otro', { invitacionId: 'i1' }); }],
      ['email sin verificar', async () => { await db.doc('invitaciones/i1').set(inv()); return canjear('clienteSinVerificar', { invitacionId: 'i1' }); }],
      ['vencida', async () => { await db.doc('invitaciones/i1').set(inv({ expiresAt: Timestamp.fromDate(new Date(AHORA.getTime() - 1000)) })); return canjear('cliente', { invitacionId: 'i1' }); }],
      ['ya usada', async () => { await db.doc('invitaciones/i1').set(inv({ usada: true, usadaPor: 'alguien' })); return canjear('cliente', { invitacionId: 'i1' }); }],
      ['inexistente', async () => canjear('cliente', { invitacionId: 'no-existe' })],
      ['id inválido', async () => canjear('cliente', { invitacionId: 'a/b' })],
      ['usuario @secocut', async () => { await db.doc('invitaciones/i1').set(inv({ email: 'vend@secocut.com' })); return canjear('vendedor', { invitacionId: 'i1' }); }],
      ['users/{uid} con otra empresaId', async () => { await db.doc('users/cli1').set({ empresaId: 'e2' }, { merge: true }); await db.doc('invitaciones/i1').set(inv()); return canjear('cliente', { invitacionId: 'i1' }); }],
      ['empresa de la invitación borrada', async () => { await db.doc('empresas/e1').delete(); await db.doc('invitaciones/i1').set(inv()); return canjear('cliente', { invitacionId: 'i1' }); }],
    ];
    it.each(rechazos)('403 genérico: %s (y no cambia nada)', async (_n, ejecutar) => {
      const r = await ejecutar();
      expect(r.status).toBe(403);
      expect(await r.clone().json()).toEqual({ error: 'Sin permisos' });
      await sinMotivo(r);
      const despues = (await db.doc('invitaciones/i1').get()).data();
      expect(despues?.usadaPor).not.toBe('cli1'); // el rechazo no marca la invitación como usada por este usuario
      const cli = (await db.doc('users/cli1').get()).data();
      expect(cli?.empresaId === 'e1').toBe(false);
    });

    it('dos canjes simultáneos de la misma invitación: solo uno pasa', async () => {
      await db.doc('invitaciones/i1').set(inv());
      const res = await Promise.all([canjear('cliente', { invitacionId: 'i1' }), canjear('cliente', { invitacionId: 'i1' })]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 403]);
      expect((await db.doc('invitaciones/i1').get()).get('usada')).toBe(true);
    });
    it('dos usuarios distintos canjeando a la vez la misma invitación: solo uno pasa', async () => {
      // Misma invitación para el mismo email: el segundo uid con ese email también la presenta.
      tokens.clon = { uid: 'clon1', email: 'cli@cliente.com', email_verified: true };
      await db.doc('users/clon1').set({ id: 'clon1', email: 'cli@cliente.com', role: 'user' });
      await db.doc('invitaciones/i1').set(inv());
      const res = await Promise.all([canjear('cliente', { invitacionId: 'i1' }), canjear('clon', { invitacionId: 'i1' })]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 403]);
      const conEmpresa = [(await db.doc('users/cli1').get()).get('empresaId'), (await db.doc('users/clon1').get()).get('empresaId')].filter(Boolean);
      expect(conEmpresa).toEqual(['e1']);
      delete tokens.clon;
    });
    it('mismo usuario ya en la misma empresa puede canjear otra invitación a esa empresa', async () => {
      await db.doc('users/cli1').set({ empresaId: 'e1' }, { merge: true });
      await db.doc('invitaciones/i1').set(inv());
      expect((await canjear('cliente', { invitacionId: 'i1' })).status).toBe(200);
    });
    it('límite de intentos: pasados 10 canjes del día responde 429', async () => {
      for (let n = 0; n < 10; n++) expect((await canjear('cliente', { invitacionId: 'no-existe' })).status).toBe(403);
      expect((await canjear('cliente', { invitacionId: 'no-existe' })).status).toBe(429);
    });
  });

  describe('POST /vendedores', () => {
    const vend = (clave: string | undefined, body: unknown) => postVendedor(call(clave, { body }), deps);
    it('asignar y quitar con arrayUnion/arrayRemove (sin duplicar)', async () => {
      const b = { email: 'Vend@Secocut.com', empresaId: 'e1' };
      expect((await vend('admin', { ...b, accion: 'asignar' })).status).toBe(200);
      expect((await vend('admin', { ...b, accion: 'asignar' })).status).toBe(200);
      expect((await vend('admin', { email: 'vend@secocut.com', empresaId: 'e2', accion: 'asignar' })).status).toBe(200);
      expect((await db.doc('users/vend1').get()).get('empresasAsignadas').sort()).toEqual(['e1', 'e2']);
      expect((await vend('admin', { ...b, accion: 'quitar' })).status).toBe(200);
      expect((await db.doc('users/vend1').get()).get('empresasAsignadas')).toEqual(['e2']);
      expect((await db.doc('users/vend1').get()).get('role')).toBe('user');
    });
    it('no admin → 403 y no modifica', async () => {
      const r = await vend('vendedor', { email: 'vend@secocut.com', empresaId: 'e1', accion: 'asignar' });
      expect(r.status).toBe(403);
      await sinMotivo(r);
      expect((await db.doc('users/vend1').get()).get('empresasAsignadas')).toBeUndefined();
    });
    it('email que no es @secocut → 404 genérico y no toca al usuario', async () => {
      const r = await vend('admin', { email: 'cli@cliente.com', empresaId: 'e1', accion: 'asignar' });
      expect(r.status).toBe(404);
      await sinMotivo(r);
      expect((await db.doc('users/cli1').get()).get('empresasAsignadas')).toBeUndefined();
    });
    it('@secocut sin perfil, o empresa inexistente → 404 igual que los demás', async () => {
      const a = await vend('admin', { email: 'fantasma@secocut.com', empresaId: 'e1', accion: 'asignar' });
      const b = await vend('admin', { email: 'vend@secocut.com', empresaId: 'no-existe', accion: 'asignar' });
      expect([a.status, b.status]).toEqual([404, 404]);
      expect(await a.json()).toEqual(await b.json());
    });
    it('email copiado en el perfil de OTRO usuario: se asigna al dueño real de la cuenta, no al del perfil', async () => {
      await db.doc('users/impostor').set({ id: 'impostor', email: 'vend@secocut.com', role: 'user' });
      expect((await vend('admin', { email: 'vend@secocut.com', empresaId: 'e1', accion: 'asignar' })).status).toBe(200);
      expect((await db.doc('users/vend1').get()).get('empresasAsignadas')).toEqual(['e1']);
      expect((await db.doc('users/impostor').get()).get('empresasAsignadas')).toBeUndefined();
    });
    it('perfil con email @secocut copiado pero sin cuenta @secocut en Auth → 404 y no se toca', async () => {
      await db.doc('users/impostor').set({ id: 'impostor', email: 'jefe@secocut.com', role: 'user' });
      const r = await vend('admin', { email: 'jefe@secocut.com', empresaId: 'e1', accion: 'asignar' });
      expect(r.status).toBe(404);
      expect((await db.doc('users/impostor').get()).get('empresasAsignadas')).toBeUndefined();
    });
    it('cuenta @secocut sin email verificado → 404 genérico', async () => {
      cuentas['vend@secocut.com'] = { uid: 'vend1', email: 'vend@secocut.com', emailVerified: false };
      const r = await vend('admin', { email: 'vend@secocut.com', empresaId: 'e1', accion: 'asignar' });
      expect(r.status).toBe(404);
      await sinMotivo(r);
      expect((await db.doc('users/vend1').get()).get('empresasAsignadas')).toBeUndefined();
    });
    it('email inexistente en Auth → 404 genérico (igual que los demás) y sin filtrar el error de Auth', async () => {
      const r = await vend('admin', { email: 'nadie@secocut.com', empresaId: 'e1', accion: 'asignar' });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: 'No encontrado' });
    });
    it('cuenta de Auth sin perfil en users → 404 y no se crea el perfil', async () => {
      cuentas['sinperfil@secocut.com'] = { uid: 'sp1', email: 'sinperfil@secocut.com', emailVerified: true };
      expect((await vend('admin', { email: 'sinperfil@secocut.com', empresaId: 'e1', accion: 'asignar' })).status).toBe(404);
      expect((await db.doc('users/sp1').get()).exists).toBe(false);
    });
    it('acción inválida → 400', async () => {
      expect((await vend('admin', { email: 'vend@secocut.com', empresaId: 'e1', accion: 'borrar' })).status).toBe(400);
    });
  });

  it('ninguna respuesta de error de estas rutas filtra detalles internos del token', async () => {
    const r = await postCanjear(call('token-roto', { body: { invitacionId: 'i1' } }), deps);
    expect(r.status).toBe(401);
    expect(JSON.stringify(await r.json())).not.toContain('detalle');
  });
});
