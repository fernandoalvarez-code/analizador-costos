import { defineConfig } from 'vitest/config';

// Tests de reglas de Firestore. Requieren el emulador (y Java): se corren con
// `npm run test:rules`, que levanta el emulador con un proyecto demo-* para
// que nunca se toque un proyecto real.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.spec.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Todos los archivos comparten un único emulador: sin paralelismo.
    fileParallelism: false,
  },
});
