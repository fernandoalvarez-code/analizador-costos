import 'server-only';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/firebase/auth/admin-app';

/**
 * Chequeo de acceso ÚNICO para las rutas /api (y cualquier ruta nueva). Cada ruta llama a
 * uno de los dos guards al principio y devuelve `result.response` si no pasa:
 *
 *   const auth = await requireSecucutUser(req);
 *   if (!auth.ok) return auth.response;
 *
 * - requireVerifiedUser: token válido + email verificado + cuenta no anónima (cualquier dominio).
 * - requireSecucutUser: lo anterior + email (en minúsculas) terminado en @secocut.com.
 *
 * Las respuestas son genéricas (401/403) y nunca devuelven el motivo interno.
 */

const SECOCUT_DOMAIN = '@secocut.com';

export type VerifyIdToken = (idToken: string) => Promise<DecodedIdToken>;

const defaultVerify: VerifyIdToken = async (idToken) => {
  const app = await initializeAdminApp();
  return getAuth(app).verifyIdToken(idToken);
};

export type AuthorizedUser = { uid: string; email: string; token: DecodedIdToken };
export type GuardResult = { ok: true; user: AuthorizedUser } | { ok: false; response: Response };

function deny(status: 401 | 403): GuardResult {
  return {
    ok: false,
    response: Response.json({ error: status === 401 ? 'No autorizado' : 'Sin permisos' }, { status }),
  };
}

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec((req.headers.get('authorization') ?? '').trim());
  return match ? match[1] : null;
}

/** `verify` solo se inyecta en los tests; en producción usa el Admin SDK. */
export async function requireVerifiedUser(req: Request, verify: VerifyIdToken = defaultVerify): Promise<GuardResult> {
  const idToken = bearerToken(req);
  if (!idToken) return deny(401);

  let decoded: DecodedIdToken;
  try {
    decoded = await verify(idToken);
  } catch {
    return deny(401);
  }

  if (decoded.firebase?.sign_in_provider === 'anonymous') return deny(403);
  if (decoded.email_verified !== true || !decoded.email) return deny(403);

  return { ok: true, user: { uid: decoded.uid, email: decoded.email.toLowerCase(), token: decoded } };
}

export async function requireSecucutUser(req: Request, verify: VerifyIdToken = defaultVerify): Promise<GuardResult> {
  const result = await requireVerifiedUser(req, verify);
  if (!result.ok) return result;
  if (!result.user.email.endsWith(SECOCUT_DOMAIN)) return deny(403);
  return result;
}
