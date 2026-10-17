import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Verificación estática del menú y las redirecciones. FRÁGIL: si falla, revisar primero que no se haya
// vuelto a agregar Dashboard / Gestión de Casos al menú, o una redirección a /dashboard, en los archivos nombrados.
const leer = (p: string) => readFileSync(p, 'utf8');

describe('menú e inicio apuntan al Historial', () => {
  const header = leer('src/components/app/header.tsx');
  const menu = header.slice(header.indexOf('const menuItems'), header.indexOf('];', header.indexOf('const menuItems')));

  it('el menú ya no tiene Dashboard ni Gestión de Casos, y conserva el resto', () => {
    expect(menu).not.toMatch(/href:\s*'\/dashboard'/);
    expect(menu).not.toMatch(/href:\s*'\/cases'/);
    for (const h of ['/simulator/new', '/history', '/taylor-curve', '/admin/agents/test']) expect(menu).toContain(`href: '${h}'`);
  });
  it('el logo del header (escritorio y móvil) lleva a /history', () => {
    expect(header).not.toContain('href="/dashboard"');
    expect(header.match(/<Link href="\/history"/g)?.length).toBe(2);
  });
  it('login y registro redirigen a /history', () => {
    for (const p of ['src/app/(auth)/login/page.tsx', 'src/app/(auth)/signup/page.tsx']) {
      const s = leer(p);
      expect(s).not.toContain('"/dashboard"');
      expect(s).toContain('router.push("/history")');
    }
  });
  it('nav.tsx (código muerto) se borró, pero las páginas /dashboard y /cases siguen existiendo', () => {
    expect(existsSync('src/components/app/nav.tsx')).toBe(false);
    expect(existsSync('src/app/(app)/dashboard/page.tsx')).toBe(true);
    expect(existsSync('src/app/(app)/cases/page.tsx')).toBe(true);
  });
});
