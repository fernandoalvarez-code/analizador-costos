import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { requireVerifiedUser, type VerifyIdToken } from '@/lib/server/auth-guards';
import { requireSecocutAdmin, type ReadUserRole } from '@/lib/server/costos-guards';
import {
  asignarVendedor, canjearInvitacion, type AuthLookup, crearInvitacion, esEmailValido, esIdValido, invitacionPara, listarInvitaciones, normalizarEmail,
  revocarInvitacion,
} from '@/lib/server/costos-invitaciones';
import { enforceRateLimit, type CounterStore } from '@/lib/server/rate-limit';

// Handlers de las rutas /api/costos/**. Las rutas (route.ts) solo los llaman; `deps` se inyecta únicamente en los tests.
// Orden fijo: guard → límite de intentos → body. Los errores de negocio son SIEMPRE genéricos: no revelan el motivo interno.

export interface CostosDeps {
  verify?: VerifyIdToken;
  readRole?: ReadUserRole;
  db?: Firestore;
  auth?: AuthLookup;
  store?: CounterStore;
  now?: Date;
}

const getDb = async (deps: CostosDeps) => deps.db ?? getFirestore(await initializeAdminApp());
const getAuthLookup = async (deps: CostosDeps): Promise<AuthLookup> => deps.auth ?? getAuth(await initializeAdminApp());
const rl = (route: 'costos-admin' | 'costos-invitacion-mia' | 'costos-canjear', uid: string, deps: CostosDeps) =>
  enforceRateLimit(route, uid, { store: deps.store, now: deps.now });

const solicitudInvalida = () => Response.json({ error: 'Solicitud inválida' }, { status: 400 });
const sinPermisos = () => Response.json({ error: 'Sin permisos' }, { status: 403 });
const noEncontrado = () => Response.json({ error: 'No encontrado' }, { status: 404 });

async function leerBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function postInvitacion(req: Request, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireSecocutAdmin(req, deps.verify, deps.readRole);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-admin', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  const body = await leerBody(req);
  const email = typeof body?.email === 'string' ? normalizarEmail(body.email) : '';
  if (!body || !esIdValido(body.empresaId) || !esEmailValido(email)) return solicitudInvalida();
  const r = await crearInvitacion(await getDb(deps), { empresaId: body.empresaId, email, adminUid: auth.user.uid, ahora: deps.now });
  if (!r.ok) return noEncontrado();
  return Response.json({ id: r.id, expiresAt: r.expiresAt.toISOString() });
}

export async function getInvitaciones(req: Request, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireSecocutAdmin(req, deps.verify, deps.readRole);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-admin', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  const empresaId = new URL(req.url).searchParams.get('empresaId');
  if (!esIdValido(empresaId)) return solicitudInvalida();
  return Response.json({ invitaciones: await listarInvitaciones(await getDb(deps), empresaId, deps.now) });
}

export async function deleteInvitacion(req: Request, id: string, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireSecocutAdmin(req, deps.verify, deps.readRole);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-admin', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  if (!esIdValido(id)) return solicitudInvalida();
  return (await revocarInvitacion(await getDb(deps), id)) === 'ok' ? Response.json({ ok: true }) : noEncontrado();
}

export async function getInvitacionMia(req: Request, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireVerifiedUser(req, deps.verify);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-invitacion-mia', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  const inv = await invitacionPara(await getDb(deps), auth.user.email, deps.now);
  return Response.json({ invitacion: inv });
}

export async function postCanjear(req: Request, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireVerifiedUser(req, deps.verify);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-canjear', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  const body = await leerBody(req);
  if (!body || !esIdValido(body.invitacionId)) return sinPermisos(); // mismo 403 que cualquier otro fallo del canje
  const r = await canjearInvitacion(await getDb(deps), { invitacionId: body.invitacionId, uid: auth.user.uid, emailToken: auth.user.email, ahora: deps.now });
  return r.ok ? Response.json({ ok: true }) : sinPermisos();
}

export async function postVendedor(req: Request, deps: CostosDeps = {}): Promise<Response> {
  const auth = await requireSecocutAdmin(req, deps.verify, deps.readRole);
  if (!auth.ok) return auth.response;
  const limit = await rl('costos-admin', auth.user.uid, deps);
  if (!limit.ok) return limit.response;
  const body = await leerBody(req);
  const email = typeof body?.email === 'string' ? normalizarEmail(body.email) : '';
  if (!body || !esIdValido(body.empresaId) || !esEmailValido(email) || (body.accion !== 'asignar' && body.accion !== 'quitar')) return solicitudInvalida();
  const r = await asignarVendedor(await getDb(deps), await getAuthLookup(deps), { email, empresaId: body.empresaId, accion: body.accion });
  return r === 'ok' ? Response.json({ ok: true }) : noEncontrado();
}
