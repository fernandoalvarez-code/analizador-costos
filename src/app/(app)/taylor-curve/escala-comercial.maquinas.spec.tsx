// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectGolden } from '../../../../tests/golden';
import { escalaComercialBase, escalaComercialBlock, fieldByUnit, fillToyotaPage, installDomPolyfills, rechartsStub, typeInto } from '../../../../tests/screen-mocks';

// Máquinas en paralelo en la pantalla NUEVA de la curva. Caso Toyota: 350 y 237,5 hs/mes requeridas; 176 hs por máquina.
// FRÁGIL: depende de los placeholders de los campos y del aria-label de los campos nuevos.
const { stable } = vi.hoisted(() => ({ stable: { user: { uid: 'u1', email: 'x@secocut.com', emailVerified: true }, router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() }, toast: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router, usePathname: () => '/taylor-curve' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: stable.toast }) }));
vi.mock('@/firebase', () => ({ db: {}, storage: {}, useUser: () => ({ user: stable.user, loading: false }) }));
vi.mock('firebase/firestore', () => ({ addDoc: vi.fn(), collection: vi.fn(), serverTimestamp: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => false })), doc: vi.fn() }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('jspdf', () => ({ default: class {} }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('@/lib/client/auth-fetch', () => ({ authedFetch: vi.fn(async () => new Response('{}')) }));
vi.mock('recharts', () => rechartsStub());

import Page from '@/app/(app)/taylor-curve/page';

beforeAll(() => installDomPolyfills());
afterAll(() => cleanup());

const machines = (c: HTMLElement) => c.querySelector('input[aria-label="Máquinas en paralelo"]') as HTMLInputElement;
const days = (c: HTMLElement) => c.querySelector('input[aria-label="Días de trabajo por mes"]') as HTMLInputElement;
const result = (c: HTMLElement) => c.querySelector('[data-testid="escala-maquinas-resultado"]');
const text = (c: HTMLElement) => escalaComercialBlock(c).textContent ?? '';

function toyota() {
  const { container } = render(<Page />);
  fillToyotaPage(container);
  return container;
}

describe('campos nuevos', () => {
  it('"Máquinas en paralelo" arranca vacío y "Días de trabajo por mes" en 22', () => {
    const c = toyota();
    expect(machines(c).value).toBe('');
    expect(days(c).value).toBe('22');
  });
});

describe('con "Máquinas en paralelo" vacío todo queda como hoy', () => {
  it('no aparece ningún resultado nuevo y el bloque es idéntico al de main', () => {
    const c = toyota();
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.page.base.html', escalaComercialBase(c));
  });

  it('cambiar los días con N vacío no cambia nada (solo afectan al bloque nuevo)', () => {
    const c = toyota();
    typeInto(days(c), '20');
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.page.base.html', escalaComercialBase(c));
  });

  it('completar y volver a vaciar N deja el bloque idéntico al de main', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    expect(result(c)).not.toBeNull();
    typeInto(machines(c), '');
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.page.base.html', escalaComercialBase(c));
  });
});

describe('con máquinas en paralelo (Toyota: 350 y 237,5 hs/mes)', () => {
  it('1 máquina: 199 % → 135 %, capacidad insuficiente en ambas, necesarias 2 → 2, ≈ 0,6 liberadas', () => {
    const c = toyota();
    typeInto(machines(c), '1');
    const t = text(c);
    expect(t).toContain('Utilización teórica: 199 %');
    expect(t).toContain('135 %');
    expect(t.match(/capacidad insuficiente/gi)).toHaveLength(2);
    expect(t).toContain('Máquinas necesarias: 2 → 2');
    expect(t).toContain('≈ 0,6 máquinas equivalentes liberadas');
    expect(t).toContain('Base: 1 máq. × 8 h × 1 turno × 22 días = 176 hs/mes disponibles (teórico: sin paradas ni mantenimiento)');
    expect(t).toContain('Las horas liberadas generan ahorro solo si se utilizan');
  });

  it('2 máquinas: 99 % → 67 %, sin capacidad insuficiente', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    const t = text(c);
    expect(t).toContain('Utilización teórica: 99 % → 67 %');
    expect(t).not.toMatch(/capacidad insuficiente/i);
    expect(t).toContain('Máquinas necesarias: 2 → 2');
    expect(t).toContain('Base: 2 máq. × 8 h × 1 turno × 22 días = 352 hs/mes disponibles');
  });

  it('los demás números de la pantalla no cambian: las horas, la liberación y el costo siguen igual', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    const t = text(c);
    expect(t).toContain('Actual: ~350 hs/mes');
    expect(t).toContain('Secocut: ~238 hs/mes');
    expect(t).toContain('113 hs máquina liberadas/mes');
  });
});

describe('"≈ N máq." de antes vs. el cálculo nuevo', () => {
  it('con los mismos días y turnos coinciden (≈ 2 máq. = necesarias 2), pero el viejo se oculta cuando el nuevo está activo', () => {
    const c = toyota();
    expect(text(c)).toContain('Actual: ~350 hs/mes (≈ 2 máq.)');
    typeInto(machines(c), '2');
    expect(text(c)).toContain('Máquinas necesarias: 2 → 2');
    expect(text(c)).not.toContain('≈ 2 máq.');
  });

  it('con otros días pueden DIVERGIR (viejo: 22 días fijos → 2; nuevo con 20 días → 3), por eso el viejo se oculta', () => {
    const c = toyota();
    const viejo = /Actual: ~350 hs\/mes \(≈ (\d+) máq\.\)/.exec(text(c))![1];
    expect(viejo).toBe('2');
    typeInto(machines(c), '2');
    typeInto(days(c), '20');
    const t = text(c);
    expect(t).toContain('Máquinas necesarias: 3 → 2'); // 350/160 = 2,19 → 3 · 237,5/160 = 1,48 → 2
    expect(t).toContain('Base: 2 máq. × 8 h × 1 turno × 20 días = 320 hs/mes disponibles');
    expect(t).toContain('Utilización teórica: 109 %');
    expect(t).not.toMatch(/≈ \d+ máq\./);
  });
});

describe('datos inválidos: no se muestra nada nuevo y nada se rompe', () => {
  it.each([['1.5'], ['0'], ['-2']])('Máquinas en paralelo = %s', (value) => {
    const c = toyota();
    typeInto(machines(c), value);
    expect(result(c)).toBeNull();
    expect(text(c)).toContain('Actual: ~350 hs/mes (≈ 2 máq.)'); // el viejo sigue visible
  });

  it.each([['Hrs/Trn'], ['Trns/Día']])('con %s vacío', (unit) => {
    const c = toyota();
    typeInto(machines(c), '2');
    expect(result(c)).not.toBeNull();
    typeInto(fieldByUnit(c, unit), '');
    expect(result(c)).toBeNull();
    expect(text(c)).toContain('Actual: ~350 hs/mes');
  });

  it.each([['0'], ['32'], ['-1']])('días = %s', (value) => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(days(c), value);
    expect(result(c)).toBeNull();
  });

  it('sin volumen mensual no hay capacidad y por lo tanto nada nuevo, aunque N esté completo', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(c.querySelector('input[placeholder="0"]'), '');
    expect(result(c)).toBeNull();
  });
});
