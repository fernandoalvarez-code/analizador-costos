import 'server-only';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

// Lógica de invitaciones y asignaciones del módulo de costos. Todo con el Admin SDK (las reglas cierran la colección `invitaciones` a los
// clientes y empresaId / empresasAsignadas de users/{uid} los escribe SOLO el servidor). Recibe `db` por parámetro para probarlo
// contra el emulador. Los resultados son códigos cortos: las rutas los traducen a respuestas genéricas que no revelan el motivo.

export const DIAS_VIGENCIA = 7;
const DOMINIO_SECOCUT = '@secocut.com';
const MS_DIA = 24 * 3600 * 1000;

export interface InvitacionDoc {
  email: string;
  empresaId: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usada: boolean;
  usadaPor?: string;
  usadaAt?: Timestamp;
}

export const normalizarEmail = (email: string): string => email.trim().toLowerCase();
export const esEmailValido = (email: string): boolean => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const esEmailSecocut = (email: string): boolean => normalizarEmail(email).endsWith(DOMINIO_SECOCUT);
/** Ids de documento seguros: sin "/" ni caracteres raros. */
export const esIdValido = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,80}$/.test(id);

const vigente = (i: InvitacionDoc, ahora: Date) => i.usada === false && i.expiresAt.toMillis() > ahora.getTime();

export type EstadoInvitacion = 'pendiente' | 'usada' | 'vencida';
export const estadoDe = (i: InvitacionDoc, ahora: Date): EstadoInvitacion => (i.usada ? 'usada' : i.expiresAt.toMillis() > ahora.getTime() ? 'pendiente' : 'vencida');

// ── Crear ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export type ResultadoCrear =
  | { ok: true; id: string; expiresAt: Date; existente: boolean }
  | { ok: false; motivo: 'empresa-inexistente' };

/** Crea la invitación o devuelve la pendiente que ya existe para ese email y empresa (no duplica). */
export async function crearInvitacion(db: Firestore, args: { empresaId: string; email: string; adminUid: string; ahora?: Date }): Promise<ResultadoCrear> {
  const ahora = args.ahora ?? new Date();
  const email = normalizarEmail(args.email);
  return db.runTransaction(async (tx): Promise<ResultadoCrear> => {
    const empresa = await tx.get(db.doc(`empresas/${args.empresaId}`));
    if (!empresa.exists) return { ok: false, motivo: 'empresa-inexistente' };
    const previas = await tx.get(db.collection('invitaciones').where('email', '==', email).where('empresaId', '==', args.empresaId).where('usada', '==', false));
    const pendiente = previas.docs.find((d) => vigente(d.data() as InvitacionDoc, ahora));
    if (pendiente) return { ok: true, id: pendiente.id, expiresAt: (pendiente.data() as InvitacionDoc).expiresAt.toDate(), existente: true };
    const ref = db.collection('invitaciones').doc();
    const expiresAt = new Date(ahora.getTime() + DIAS_VIGENCIA * MS_DIA);
    tx.set(ref, {
      email, empresaId: args.empresaId, createdBy: args.adminUid, createdAt: Timestamp.fromDate(ahora), expiresAt: Timestamp.fromDate(expiresAt), usada: false,
    } satisfies InvitacionDoc);
    return { ok: true, id: ref.id, expiresAt, existente: false };
  });
}

// ── Listar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface InvitacionListada {
  id: string;
  email: string;
  estado: EstadoInvitacion;
  createdAt: string;
  expiresAt: string;
  usadaAt: string | null;
}

export async function listarInvitaciones(db: Firestore, empresaId: string, ahora: Date = new Date()): Promise<InvitacionListada[]> {
  const snap = await db.collection('invitaciones').where('empresaId', '==', empresaId).get();
  return snap.docs
    .map((d) => ({ id: d.id, i: d.data() as InvitacionDoc }))
    .sort((a, b) => b.i.createdAt.toMillis() - a.i.createdAt.toMillis())
    .map(({ id, i }) => ({
      id, email: i.email, estado: estadoDe(i, ahora), createdAt: i.createdAt.toDate().toISOString(), expiresAt: i.expiresAt.toDate().toISOString(),
      usadaAt: i.usadaAt ? i.usadaAt.toDate().toISOString() : null,
    }));
}

// ── Revocar ────────────────────────────────────────────────────────────────────────────────────────────────────────
export type ResultadoRevocar = 'ok' | 'no-existe' | 'usada';

export async function revocarInvitacion(db: Firestore, id: string): Promise<ResultadoRevocar> {
  const ref = db.doc(`invitaciones/${id}`);
  return db.runTransaction(async (tx): Promise<ResultadoRevocar> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'no-existe';
    if ((snap.data() as InvitacionDoc).usada) return 'usada';
    tx.delete(ref);
    return 'ok';
  });
}

// ── "Mi invitación" ────────────────────────────────────────────────────────────────────────────────────────────────
export interface InvitacionPropia { invitacionId: string; empresaNombre: string; expiresAt: string }

/** La invitación pendiente más reciente para el email DEL TOKEN: solo id, nombre de la empresa y vencimiento. */
export async function invitacionPara(db: Firestore, emailToken: string, ahora: Date = new Date()): Promise<InvitacionPropia | null> {
  const email = normalizarEmail(emailToken);
  if (esEmailSecocut(email)) return null; // el personal no entra como cliente
  const snap = await db.collection('invitaciones').where('email', '==', email).where('usada', '==', false).get();
  const ordenadas = snap.docs
    .map((d) => ({ id: d.id, i: d.data() as InvitacionDoc }))
    .filter(({ i }) => vigente(i, ahora))
    .sort((a, b) => b.i.createdAt.toMillis() - a.i.createdAt.toMillis());
  for (const { id, i } of ordenadas) {
    const empresa = await db.doc(`empresas/${i.empresaId}`).get();
    if (empresa.exists) return { invitacionId: id, empresaNombre: String(empresa.get('nombre') ?? ''), expiresAt: i.expiresAt.toDate().toISOString() };
  }
  return null;
}

// ── Canjear ────────────────────────────────────────────────────────────────────────────────────────────────────────
export type ResultadoCanje = { ok: true; empresaId: string } | { ok: false };

/**
 * Canje en UNA transacción: la invitación existe, no está usada ni vencida, es para el email del token y el usuario no tiene ya otra
 * empresa. Recién ahí escribe users/{uid}.empresaId (merge, sin tocar el rol) y marca la invitación como usada. Con dos canjes
 * simultáneos, Firestore reintenta el segundo, que ya ve la invitación usada: solo uno pasa.
 */
export async function canjearInvitacion(db: Firestore, args: { invitacionId: string; uid: string; emailToken: string; ahora?: Date }): Promise<ResultadoCanje> {
  const ahora = args.ahora ?? new Date();
  const email = normalizarEmail(args.emailToken);
  if (esEmailSecocut(email)) return { ok: false }; // el personal de SECOCUT no entra como cliente
  const invRef = db.doc(`invitaciones/${args.invitacionId}`);
  const userRef = db.doc(`users/${args.uid}`);
  return db.runTransaction(async (tx): Promise<ResultadoCanje> => {
    const [inv, usuario] = await tx.getAll(invRef, userRef);
    if (!inv.exists) return { ok: false };
    const i = inv.data() as InvitacionDoc;
    if (!vigente(i, ahora) || i.email !== email) return { ok: false };
    const empresa = await tx.get(db.doc(`empresas/${i.empresaId}`));
    if (!empresa.exists) return { ok: false };
    const actual = usuario.exists ? usuario.get('empresaId') : undefined;
    if (actual !== undefined && actual !== null && actual !== '' && actual !== i.empresaId) return { ok: false };
    if (usuario.exists) tx.set(userRef, { empresaId: i.empresaId }, { merge: true });
    else tx.set(userRef, { id: args.uid, email, role: 'user', empresaId: i.empresaId }); // mismo perfil que crea (app)/layout.tsx
    tx.update(invRef, { usada: true, usadaPor: args.uid, usadaAt: Timestamp.fromDate(ahora) });
    return { ok: true, empresaId: i.empresaId };
  });
}

// ── Vendedores ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type ResultadoVendedor = 'ok' | 'no-encontrado';

/** Asigna o quita una empresa a un usuario SECOCUT con perfil existente. Cualquier otro caso es "no-encontrado" (genérico). */
export async function asignarVendedor(db: Firestore, args: { email: string; empresaId: string; accion: 'asignar' | 'quitar' }): Promise<ResultadoVendedor> {
  const email = normalizarEmail(args.email);
  if (!esEmailSecocut(email)) return 'no-encontrado';
  if (args.accion === 'asignar') {
    const empresa = await db.doc(`empresas/${args.empresaId}`).get();
    if (!empresa.exists) return 'no-encontrado';
  }
  const snap = await db.collection('users').where('email', '==', email).limit(2).get();
  if (snap.size !== 1) return 'no-encontrado';
  await snap.docs[0].ref.update({ empresasAsignadas: args.accion === 'asignar' ? FieldValue.arrayUnion(args.empresaId) : FieldValue.arrayRemove(args.empresaId) });
  return 'ok';
}
