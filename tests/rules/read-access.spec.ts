import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Quién lee las colecciones internas: ai_agents y knowledge_entries solo empleados SECOCUT verificados;
// settings (logos del PDF) cualquier cuenta verificada y no anónima; chat_sessions solo se crea a nombre propio.
describe('lecturas de colecciones internas', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'ai_agents/a1'), { slug: 'agente', isActive: true });
      await setDoc(doc(db, 'knowledge_entries/k1'), { title: 'catálogo', content: 'interno' });
      await setDoc(doc(db, 'settings/general'), { companyLogoUrl: 'https://x/logo.png' });
    });
  });

  const ctx = {
    secocut: () => env.authenticatedContext('s1', secocutVerified()).firestore(),
    secocutSinVerificar: () => env.authenticatedContext('s2', { email: 'x@secocut.com', email_verified: false }).firestore(),
    gmailVerificado: () => env.authenticatedContext('g1', { email: 'cliente@gmail.com', email_verified: true }).firestore(),
    gmailSinVerificar: () => env.authenticatedContext('g2', { email: 'cliente@gmail.com', email_verified: false }).firestore(),
    anonimo: () => env.authenticatedContext('an1', { firebase: { sign_in_provider: 'anonymous' } }).firestore(),
    sinSesion: () => env.unauthenticatedContext().firestore(),
    mayusculas: () => env.authenticatedContext('s3', { email: 'Vendedor@SECOCUT.com', email_verified: true }).firestore(),
  };

  describe.each([['ai_agents', 'a1'], ['knowledge_entries', 'k1']])('%s (isSecucutEmail)', (col, id) => {
    it('lo lee un @secocut.com verificado', async () => { await assertSucceeds(getDoc(doc(ctx.secocut(), `${col}/${id}`))); });
    it('NO lo lee un @secocut.com sin verificar', async () => { await assertFails(getDoc(doc(ctx.secocutSinVerificar(), `${col}/${id}`))); });
    it('NO lo lee un usuario verificado de otro dominio (Gmail)', async () => { await assertFails(getDoc(doc(ctx.gmailVerificado(), `${col}/${id}`))); });
    it('NO lo lee una cuenta anónima', async () => { await assertFails(getDoc(doc(ctx.anonimo(), `${col}/${id}`))); });
    it('NO lo lee quien no inició sesión', async () => { await assertFails(getDoc(doc(ctx.sinSesion(), `${col}/${id}`))); });
  });

  // Documenta el comportamiento actual de isSecucutEmail(), que NO se modificó: el patrón de
  // `matches` distingue mayúsculas, así que un email con mayúsculas en el token queda afuera.
  // (Firebase Auth entrega el email en minúsculas, por eso no es un problema práctico hoy.)
  it('isSecucutEmail distingue mayúsculas: Vendedor@SECOCUT.com NO pasa', async () => {
    await assertFails(getDoc(doc(ctx.mayusculas(), 'ai_agents/a1')));
  });

  describe('settings (isVerifiedUser)', () => {
    it('lo lee un usuario verificado de cualquier dominio (logos del PDF de la curva de costos)', async () => {
      await assertSucceeds(getDoc(doc(ctx.gmailVerificado(), 'settings/general')));
      await assertSucceeds(getDoc(doc(ctx.secocut(), 'settings/general')));
    });
    it('NO lo lee una cuenta sin verificar, anónima o sin sesión', async () => {
      await assertFails(getDoc(doc(ctx.gmailSinVerificar(), 'settings/general')));
      await assertFails(getDoc(doc(ctx.anonimo(), 'settings/general')));
      await assertFails(getDoc(doc(ctx.sinSesion(), 'settings/general')));
    });
    it('NO lo escribe un usuario verificado que no es admin', async () => {
      await assertFails(setDoc(doc(ctx.secocut(), 'settings/general'), { companyLogoUrl: 'https://evil/x.png' }));
    });
  });

  describe('chat_sessions: crear solo a nombre propio', () => {
    it('con su propio userId: sí', async () => {
      await assertSucceeds(addDoc(collection(ctx.secocut(), 'chat_sessions'), { userId: 's1', messages: [] }));
    });
    it('con el userId de otra persona: no', async () => {
      await assertFails(addDoc(collection(ctx.secocut(), 'chat_sessions'), { userId: 'otro', messages: [] }));
    });
    it('sin userId: no', async () => {
      await assertFails(addDoc(collection(ctx.secocut(), 'chat_sessions'), { messages: [] }));
    });
  });
});
