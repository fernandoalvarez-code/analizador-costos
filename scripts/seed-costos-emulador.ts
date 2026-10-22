/**
 * Seed del módulo de costos de mecanizado en los EMULADORES locales (Auth y Firestore, proyecto demo-costos).
 * Se corre con `npm run costos:emuladores` (levanta los emuladores y corre esto), o a mano con las variables del emulador:
 *   GCLOUD_PROJECT=demo-costos FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     npx tsx scripts/seed-costos-emulador.ts [--piezas-aleatorias]
 * ABORTA si no están las variables del emulador o si el proyecto no es demo-costos. Escribe con Admin SDK (no pasa por las reglas),
 * así empresaId y empresasAsignadas los pone el "servidor". Las contraseñas de prueba se leen de docs/analisis-costos/README-LOCAL.md.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { leerCredenciales } from './costos-seed/credenciales';
import {
  ADMIN_UID, EMPRESAS, EMPRESA_A, EMPRESA_B, MAQUINAS_A, MAQUINAS_B, USUARIOS,
  documentoMaquina, documentoPieza, generarPiezasAleatorias, piezaBrida, piezaCarcasa,
} from './costos-seed/datos';
import { PROJECT_ID_EMULADOR, verificarEntornoSeed } from './costos-seed/guardas';

async function main() {
  verificarEntornoSeed(process.env);
  const conAleatorias = process.argv.includes('--piezas-aleatorias');
  const credenciales = leerCredenciales(readFileSync('docs/analisis-costos/README-LOCAL.md', 'utf8'));

  // projectId explícito: no depende de lo que haya en el entorno.
  const app = initializeApp({ projectId: PROJECT_ID_EMULADOR });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ahora = Timestamp.now();

  // Usuarios de Auth con email verificado + su documento users/{uid} (empresaId / empresasAsignadas los escribe el "servidor")
  for (const u of USUARIOS) {
    const datos = { email: u.email, password: credenciales[u.email], emailVerified: true, displayName: u.nombre };
    try { await auth.createUser({ uid: u.uid, ...datos }); } catch (e) {
      if ((e as { code?: string }).code !== 'auth/uid-already-exists' && (e as { code?: string }).code !== 'auth/email-already-exists') throw e;
      await auth.updateUser(u.uid, datos);
    }
    await db.doc(`users/${u.uid}`).set({
      id: u.uid, email: u.email, role: u.role, name: u.nombre,
      ...(u.empresaId ? { empresaId: u.empresaId } : {}),
      ...(u.empresasAsignadas ? { empresasAsignadas: u.empresasAsignadas } : {}),
    });
  }

  // Empresas, máquinas y piezas
  for (const e of EMPRESAS) await db.doc(`empresas/${e.id}`).set({ nombre: e.nombre, plantas: e.plantas, vendedorId: e.vendedorId, createdAt: ahora, createdBy: ADMIN_UID });
  for (const m of MAQUINAS_A) await db.doc(`empresas/${EMPRESA_A}/maquinas/${m.id}`).set(documentoMaquina(m, ADMIN_UID, ahora));
  for (const m of MAQUINAS_B) await db.doc(`empresas/${EMPRESA_B}/maquinas/${m.id}`).set(documentoMaquina(m, ADMIN_UID, ahora));
  await db.doc(`empresas/${EMPRESA_A}/piezas/car-001`).set(documentoPieza(piezaCarcasa(), MAQUINAS_A, ADMIN_UID, ahora));
  await db.doc(`empresas/${EMPRESA_B}/piezas/bri-100`).set(documentoPieza(piezaBrida(), MAQUINAS_B, ADMIN_UID, ahora));

  let aleatorias = 0;
  if (conAleatorias) {
    const piezas = generarPiezasAleatorias();
    for (let i = 0; i < piezas.length; i += 400) {
      const batch = db.batch();
      for (const p of piezas.slice(i, i + 400)) batch.set(db.doc(`empresas/${EMPRESA_A}/piezas/${p.codigo.toLowerCase()}`), documentoPieza(p, MAQUINAS_A, ADMIN_UID, ahora));
      await batch.commit();
    }
    aleatorias = piezas.length;
  }

  console.log(`Seed listo en los emuladores (${PROJECT_ID_EMULADOR}): ${USUARIOS.length} usuarios, ${EMPRESAS.length} empresas, ${MAQUINAS_A.length + MAQUINAS_B.length} máquinas, ${2 + aleatorias} piezas${conAleatorias ? ` (incluye ${aleatorias} aleatorias)` : ''}.`);
  console.log('Los usuarios y sus contraseñas de prueba están en docs/analisis-costos/README-LOCAL.md.');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
