import 'server-only';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/auth/admin-app';

/**
 * Límite de uso diario de las rutas /api que gastan cuota de IA.
 *
 * Por request se consume UN cupo del usuario y UNO global de la ruta (cortacircuitos), en una
 * transacción de Firestore con el Admin SDK. Colección `rate_limits` (las reglas la cierran a
 * los clientes). El día es UTC: se renueva a las 21:00 de Argentina.
 *
 * FALLA CERRADO: si el contador no responde, la ruta contesta 503 y NO llama a la IA.
 *
 * Los límites son PROVISORIOS y se configuran con variables no secretas de apphosting.yaml:
 *   RATE_LIMIT_<RUTA>_USER_DAILY y RATE_LIMIT_<RUTA>_GLOBAL_DAILY (0 = ruta bloqueada).
 * Si una variable falta o no es un entero >= 0, se usa el valor por defecto de abajo.
 */

export type RateLimitRoute = 'chat' | 'agents-chat' | 'suggest-cutting-data' | 'savings-suggestions';

const DEFAULT_LIMITS: Record<RateLimitRoute, { user: number; global: number }> = {
  'chat': { user: 40, global: 300 },
  'agents-chat': { user: 40, global: 300 },
  'suggest-cutting-data': { user: 40, global: 300 },
  'savings-suggestions': { user: 20, global: 300 },
};

const ENV_PREFIX: Record<RateLimitRoute, string> = {
  'chat': 'CHAT',
  'agents-chat': 'AGENTS_CHAT',
  'suggest-cutting-data': 'SUGGEST_CUTTING_DATA',
  'savings-suggestions': 'SAVINGS_SUGGESTIONS',
};

function envInt(name: string, fallback: number, env: Record<string, string | undefined>): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function getLimits(route: RateLimitRoute, env: Record<string, string | undefined> = process.env) {
  const d = DEFAULT_LIMITS[route];
  const p = `RATE_LIMIT_${ENV_PREFIX[route]}`;
  return { user: envInt(`${p}_USER_DAILY`, d.user, env), global: envInt(`${p}_GLOBAL_DAILY`, d.global, env) };
}

// ── Almacén de contadores ───────────────────────────────────────────────────────────────────

export type ConsumeResult = { allowed: true } | { allowed: false; scope: 'user' | 'global' };

export interface CounterStore {
  /** Consume un cupo de usuario y uno global de forma atómica, o no consume ninguno. */
  consume(args: { route: RateLimitRoute; uid: string; day: string; limits: { user: number; global: number }; expireAt: Date }): Promise<ConsumeResult>;
}

export function createFirestoreStore(db: Firestore): CounterStore {
  return {
    async consume({ route, uid, day, limits, expireAt }) {
      const userRef = db.collection('rate_limits').doc(`${route}__${uid}__${day}`);
      const globalRef = db.collection('rate_limits').doc(`${route}__GLOBAL__${day}`);
      return db.runTransaction(async (tx): Promise<ConsumeResult> => {
        const [userSnap, globalSnap] = await tx.getAll(userRef, globalRef);
        const userCount: number = userSnap.exists ? userSnap.get('count') ?? 0 : 0;
        const globalCount: number = globalSnap.exists ? globalSnap.get('count') ?? 0 : 0;
        if (userCount >= limits.user) return { allowed: false, scope: 'user' };
        if (globalCount >= limits.global) return { allowed: false, scope: 'global' };
        tx.set(userRef, { route, uid, day, count: userCount + 1, expireAt }, { merge: true });
        tx.set(globalRef, { route, uid: 'GLOBAL', day, count: globalCount + 1, expireAt }, { merge: true });
        return { allowed: true };
      });
    },
  };
}

async function defaultStore(): Promise<CounterStore> {
  return createFirestoreStore(getFirestore(await initializeAdminApp()));
}

// ── API para las rutas ──────────────────────────────────────────────────────────────────────

export type RateLimitResult = { ok: true } | { ok: false; response: Response };

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Llamar DESPUÉS del guard de acceso y ANTES de gastar cuota de IA:
 *   const limit = await enforceRateLimit('chat', auth.user.uid);
 *   if (!limit.ok) return limit.response;
 * `deps` solo se inyecta en los tests.
 */
export async function enforceRateLimit(
  route: RateLimitRoute,
  uid: string,
  deps: { store?: CounterStore; now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<RateLimitResult> {
  const now = deps.now ?? new Date();
  const limits = getLimits(route, deps.env);

  let result: ConsumeResult;
  try {
    const store = deps.store ?? (await defaultStore());
    // Los documentos se conservan 2 días de margen; un TTL sobre `expireAt` los limpia (pendiente).
    const expireAt = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    result = await store.consume({ route, uid, day: utcDay(now), limits, expireAt });
  } catch (err) {
    console.error(`[rate-limit] contador no disponible (${route}), se bloquea la request:`, err instanceof Error ? err.message : 'error');
    return { ok: false, response: Response.json({ error: 'Servicio no disponible por el momento. Probá de nuevo en unos minutos.' }, { status: 503 }) };
  }

  if (result.allowed) return { ok: true };

  const message = result.scope === 'user'
    ? `Alcanzaste el límite diario de ${limits.user} consultas para esta función. Se renueva a las 21:00 (hora de Argentina).`
    : 'Esta función alcanzó su límite diario de uso. Probá de nuevo mañana.';
  return {
    ok: false,
    response: Response.json({ error: message }, { status: 429, headers: { 'Retry-After': String(secondsUntilNextUtcDay(now)) } }),
  };
}
