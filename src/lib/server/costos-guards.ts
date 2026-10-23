import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { requireSecucutUser, type GuardResult, type VerifyIdToken } from '@/lib/server/auth-guards';

/**
 * Guard de las rutas de administración del módulo de costos: admin SECOCUT.
 *
 *   const auth = await requireSecocutAdmin(req);
 *   if (!auth.ok) return auth.response;
 *
 * = requireSecucutUser (token válido, email verificado @secocut.com) + users/{uid}.role === 'admin' leído con el Admin SDK
 * (el rol vive SOLO ahí; no hay custom claims). FALLA CERRADO: documento inexistente, rol distinto o error de lectura → 403
 * genérico, sin revelar el motivo.
 */

export type ReadUserRole = (uid: string) => Promise<unknown>;

const defaultReadRole: ReadUserRole = async (uid) => {
  const db = getFirestore(await initializeAdminApp());
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.get('role') : undefined;
};

/** `verify` y `readRole` solo se inyectan en los tests. */
export async function requireSecocutAdmin(
  req: Request,
  verify?: VerifyIdToken,
  readRole: ReadUserRole = defaultReadRole,
): Promise<GuardResult> {
  const result = verify ? await requireSecucutUser(req, verify) : await requireSecucutUser(req);
  if (!result.ok) return result;
  let role: unknown;
  try {
    role = await readRole(result.user.uid);
  } catch {
    return { ok: false, response: Response.json({ error: 'Sin permisos' }, { status: 403 }) };
  }
  if (role !== 'admin') return { ok: false, response: Response.json({ error: 'Sin permisos' }, { status: 403 }) };
  return result;
}
