import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests unitarios (funciones puras, sin emulador). Los tests de reglas de
// Firestore tienen su propia config: vitest.rules.config.ts.
// machining-physics.test.ts es un script de tsx (no usa vitest) y por eso el
// patrón es *.spec.ts: así vitest no intenta correrlo.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
