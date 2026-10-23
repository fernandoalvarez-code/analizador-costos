import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import type { AuthorizedUser } from '@/lib/server/auth-guards';

/**
 * Perímetro del cliente de empresa en las rutas /api de IA.
 *
 * "Cliente de empresa" = users/{uid}.empresaId existe y la cuenta NO es @secocut.com verificado. Se llama DESPUÉS de
 * requireVerifiedUser (que ya garantiza email verificado y lo normaliza a minúsculas):
 *
 *   const perimetro = await requireNotEmpresaCliente(auth.user);
 *   if (!perimetro.ok) return perimetro.response;
 *
 * El personal SECOCUT verificado pasa sin leer nada. Para el resto se lee users/{uid}.empresaId con el Admin SDK y, si existe,
 * 403 genérico. FALLA CERRADO: si la lectura falla, 403 (no se deja pasar a alguien que podría ser cliente).
 * Quien no tiene empresaId (documento inexistente o sin el campo) sigue como hoy.
 */

export type ReadEmpresaId = (uid: string) => Promise<unknown>;
export type PerimetroResult = { ok: true } | { ok: false; response: Response };

const defaultRead: ReadEmpresaId = async (uid) => {
  const db = getFirestore(await initializeAdminApp());
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.get('empresaId') : undefined;
};

const prohibido = (): PerimetroResult => ({ ok: false, response: Response.json({ error: 'Sin permisos' }, { status: 403 }) });

/** `read` solo se inyecta en los tests. */
export async function requireNotEmpresaCliente(user: Pick<AuthorizedUser, 'uid' | 'email'>, read: ReadEmpresaId = defaultRead): Promise<PerimetroResult> {
  if (user.email.toLowerCase().endsWith('@secocut.com')) return { ok: true };
  let empresaId: unknown;
  try {
    empresaId = await read(user.uid);
  } catch {
    return prohibido();
  }
  if (empresaId === undefined || empresaId === null || empresaId === '') return { ok: true };
  return prohibido();
}
