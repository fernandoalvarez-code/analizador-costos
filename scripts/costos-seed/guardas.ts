// Guardas del seed: solo corre contra los EMULADORES locales y con el proyecto demo-costos.
export const PROJECT_ID_EMULADOR = 'demo-costos';

const HOST_LOCAL = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/;

/** Lanza un Error si el entorno no es el de los emuladores locales con el proyecto demo-costos. */
export function verificarEntornoSeed(env: Record<string, string | undefined>): void {
  const faltan = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'].filter((v) => !env[v]);
  if (faltan.length) {
    throw new Error(`Abortado: faltan ${faltan.join(' y ')}. El seed solo escribe en los emuladores (npm run costos:emuladores lo hace por vos).`);
  }
  for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!HOST_LOCAL.test(env[v] as string)) throw new Error(`Abortado: ${v} debe apuntar a esta máquina (127.0.0.1 o localhost), no a otro host.`);
  }
  if (env.GCLOUD_PROJECT !== PROJECT_ID_EMULADOR) {
    throw new Error(`Abortado: GCLOUD_PROJECT debe ser exactamente "${PROJECT_ID_EMULADOR}" (actual: ${env.GCLOUD_PROJECT ?? 'no definido'}).`);
  }
  for (const v of ['GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (env[v] && env[v] !== PROJECT_ID_EMULADOR) throw new Error(`Abortado: ${v} apunta a otro proyecto (${env[v]}).`);
  }
}
