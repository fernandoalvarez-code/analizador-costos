// Modo emulador local (solo desarrollo). Conecta Auth y Firestore a los emuladores SOLO si se cumplen las TRES condiciones:
//   1. NEXT_PUBLIC_USE_EMULATORS === 'true'
//   2. NODE_ENV !== 'production'
//   3. el projectId configurado empieza con "demo-"
// Si falta cualquiera, no hace nada y el comportamiento es idéntico al de siempre. Un proyecto real (studio-...) nunca se conecta.
import { connectAuthEmulator, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

export const HOST_EMULADORES = '127.0.0.1';
export const PUERTO_EMULADOR_AUTH = 9099;
export const PUERTO_EMULADOR_FIRESTORE = 8080;
const BANDERA = '__EMULADORES_FIREBASE_CONECTADOS__';

export interface EntornoEmuladores {
  useEmulators: string | undefined;
  nodeEnv: string | undefined;
  projectId: string | undefined;
}

export interface Conectores {
  connectAuthEmulator: (auth: Auth, url: string, opciones?: { disableWarnings: boolean }) => void;
  connectFirestoreEmulator: (db: Firestore, host: string, port: number) => void;
}

/** Las tres condiciones a la vez. */
export function debeUsarEmuladores(entorno: EntornoEmuladores): boolean {
  return entorno.useEmulators === 'true' && entorno.nodeEnv !== 'production' && (entorno.projectId ?? '').startsWith('demo-');
}

/**
 * Conecta los emuladores si corresponde y devuelve true si conectó. Con next dev el módulo se re-evalúa (hot reload) y
 * connectAuthEmulator / connectFirestoreEmulator lanzan error si se llaman dos veces: una bandera en globalThis y un try/catch lo evitan.
 */
export function conectarEmuladoresSiCorresponde(
  auth: Auth, db: Firestore, entorno: EntornoEmuladores,
  conectores: Conectores = { connectAuthEmulator, connectFirestoreEmulator },
): boolean {
  if (!debeUsarEmuladores(entorno)) return false;
  const g = globalThis as Record<string, unknown>;
  if (g[BANDERA]) return false;
  try {
    conectores.connectAuthEmulator(auth, `http://${HOST_EMULADORES}:${PUERTO_EMULADOR_AUTH}`, { disableWarnings: true });
    conectores.connectFirestoreEmulator(db, HOST_EMULADORES, PUERTO_EMULADOR_FIRESTORE);
    g[BANDERA] = true;
    return true;
  } catch (e) {
    // Ya estaban conectados (re-evaluación del módulo) o el SDK ya usó la instancia: se sigue con lo que haya.
    console.warn('No se pudieron conectar los emuladores de Firebase:', e);
    g[BANDERA] = true;
    return false;
  }
}

/** Solo para tests: permite volver a conectar. */
export function reiniciarBanderaEmuladores(): void {
  delete (globalThis as Record<string, unknown>)[BANDERA];
}
