import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';

/**
 * Compara `actual` con tests/golden/<name>. Los archivos "golden" son el marcado/texto que producía
 * `main` ANTES de agregar la función de máquinas en paralelo: prueban que, sin ella, nada cambia.
 * Para regenerarlos a propósito (solo si un cambio visual es deseado): UPDATE_GOLDEN=1 npx vitest run
 */
export function expectGolden(name: string, actual: string) {
  const file = join('tests', 'golden', name);
  if (process.env.UPDATE_GOLDEN === '1') {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, actual);
    return;
  }
  expect(existsSync(file), `falta el golden ${file} (UPDATE_GOLDEN=1 para crearlo)`).toBe(true);
  expect(actual).toBe(readFileSync(file, 'utf8'));
}
