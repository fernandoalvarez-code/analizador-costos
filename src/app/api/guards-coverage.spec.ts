import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Red de seguridad: toda ruta bajo src/app/api debe estar declarada acá con su guard, y el guard
// debe ejecutarse ANTES de leer el body o gastar cuota. Una ruta nueva sin declarar hace fallar el
// test: hay que agregarla con el guard que corresponde (requireSecucutUser / requireVerifiedUser).
const API_DIR = 'src/app/api';

const EXPECTED: Record<string, { guard: 'requireSecucutUser' | 'requireVerifiedUser'; rateLimit: string | null }> = {
  'agents/chat/route.ts': { guard: 'requireSecucutUser', rateLimit: 'agents-chat' },
  'chat/route.ts': { guard: 'requireVerifiedUser', rateLimit: 'chat' },
  'suggest-cutting-data/route.ts': { guard: 'requireVerifiedUser', rateLimit: 'suggest-cutting-data' },
  'savings-suggestions/route.ts': { guard: 'requireVerifiedUser', rateLimit: 'savings-suggestions' },
  'knowledge/upload-pdf/route.ts': { guard: 'requireSecucutUser', rateLimit: null },
  'knowledge/upload-url/route.ts': { guard: 'requireSecucutUser', rateLimit: null },
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const routeFiles = walk(API_DIR).filter((f) => /route\.tsx?$/.test(f)).map((f) => relative(API_DIR, f));

describe('guards de las rutas /api', () => {
  it('no hay rutas sin declarar ni declaradas que ya no existen', () => {
    expect([...routeFiles].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s usa su guard antes de leer el body', (file, exp) => {
    const src = readFileSync(join(API_DIR, file), 'utf8');
    const guardAt = src.indexOf(`await ${exp.guard}(`);
    expect(guardAt, `${file}: falta "await ${exp.guard}("`).toBeGreaterThan(-1);
    const bodyAt = [src.indexOf('req.json('), src.indexOf('req.formData(')].filter((i) => i >= 0);
    for (const at of bodyAt) expect(guardAt, `${file}: el body se lee antes del guard`).toBeLessThan(at);
    // Ni el otro guard ni una verificación manual de token.
    expect(src).not.toMatch(/verifyIdToken\(/);
  });

  it.each(Object.entries(EXPECTED))('%s aplica su límite de uso después del guard', (file, exp) => {
    const src = readFileSync(join(API_DIR, file), 'utf8');
    if (!exp.rateLimit) { expect(src).not.toContain('enforceRateLimit('); return; }
    const limitAt = src.indexOf(`enforceRateLimit('${exp.rateLimit}'`);
    expect(limitAt, `${file}: falta enforceRateLimit('${exp.rateLimit}', ...)`).toBeGreaterThan(-1);
    expect(src.indexOf(`await ${exp.guard}(`)).toBeLessThan(limitAt);
  });

  it('ninguna ruta usa un método distinto de POST sin declararlo', () => {
    for (const file of Object.keys(EXPECTED)) {
      const methods = [...readFileSync(join(API_DIR, file), 'utf8').matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      expect(methods, file).toEqual(['POST']);
    }
  });
});

describe('Server Actions', () => {
  it('no queda ningún archivo con "use server" (cada uno sería un endpoint público sin guard)', () => {
    const offenders = walk('src')
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /^\s*['"]use server['"]/m.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
