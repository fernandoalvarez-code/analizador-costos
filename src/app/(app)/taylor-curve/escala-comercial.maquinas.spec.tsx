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

const machines = (c: HTMLElement) => c.querySelector('[data-testid="escala-input-maquinas"]') as HTMLInputElement;
const days = (c: HTMLElement) => c.querySelector('[data-testid="escala-input-dias"]') as HTMLInputElement;
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

  it.each([['Horas por turno'], ['Turnos por día']])('con %s vacío', (unit) => {
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

describe('horas por turno posibles (Horas por turno entre 1 y 24; Horas por turno × Turnos por día ≤ 24)', () => {
  const aviso = (c: HTMLElement) => c.querySelector('[data-testid="escala-aviso-turnos"]');
  const caja = (c: HTMLElement) => c.textContent ?? '';

  it('con datos válidos no hay aviso, la tarjeta aparece y la caja de productividad muestra sus fichas de siempre', () => {
    const c = toyota();
    typeInto(machines(c), '10');
    expect(aviso(c)).toBeNull();
    expect(result(c)).not.toBeNull();
    expect(caja(c)).toContain('Pzas / Trn (8h)');
  });

  it('el caso real que falló: N=10 y Horas por turno=8445 -> sin tarjeta, aviso corto en el campo y sin fichas por turno', () => {
    const c = toyota();
    typeInto(machines(c), '10');
    typeInto(fieldByUnit(c, 'Horas por turno'), '8445');
    expect(result(c)).toBeNull();
    expect(aviso(c)?.textContent).toBe('⚠ Horas por turno debe estar entre 1 y 24.');
    expect(fieldByUnit(c, 'Horas por turno').getAttribute('aria-invalid')).toBe('true');
    expect(caja(c)).not.toContain('1.857.900');
    expect(caja(c)).not.toContain('Pzas / Trn');
    expect(caja(c)).not.toContain('(8445h)');
    expect(caja(c)).toContain('Pzas / Hora');
  });

  it('el aviso también aparece con N vacío (los mismos datos alimentan la caja de productividad)', () => {
    const c = toyota();
    typeInto(fieldByUnit(c, 'Horas por turno'), '25');
    expect(aviso(c)?.textContent).toBe('⚠ Horas por turno debe estar entre 1 y 24.');
    expect(caja(c)).not.toContain('Pzas / Trn');
  });

  it('Horas por turno × Turnos por día > 24 (8 h × 4 turnos): aviso del producto y sin tarjeta', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(fieldByUnit(c, 'Turnos por día'), '4');
    expect(result(c)).toBeNull();
    expect(aviso(c)?.textContent).toBe('⚠ Horas por turno × Turnos por día no puede superar 24 h.');
    expect(fieldByUnit(c, 'Turnos por día').getAttribute('aria-invalid')).toBe('true');
  });

  it.each([['8', '3'], ['12', '2'], ['24', '1']])('el límite es inclusivo: %s h × %s turnos (24 h) sí se calcula', (h, t) => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(fieldByUnit(c, 'Horas por turno'), h);
    typeInto(fieldByUnit(c, 'Turnos por día'), t);
    expect(aviso(c)).toBeNull();
    expect(result(c)).not.toBeNull();
  });

  it('al corregir el valor la tarjeta vuelve y el aviso desaparece', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(fieldByUnit(c, 'Horas por turno'), '8445');
    expect(result(c)).toBeNull();
    typeInto(fieldByUnit(c, 'Horas por turno'), '8');
    expect(aviso(c)).toBeNull();
    expect(text(c)).toContain('Utilización teórica: 99 % → 67 %');
  });

  it('Horas por turno vacío no es un error: sin aviso (la app usa 8) y sin tarjeta', () => {
    const c = toyota();
    typeInto(machines(c), '2');
    typeInto(fieldByUnit(c, 'Horas por turno'), '');
    expect(aviso(c)).toBeNull();
    expect(result(c)).toBeNull();
  });

  it('con valores válidos el bloque sigue idéntico al de main (sin aviso ni cambios de clase)', () => {
    expectGolden('escala-comercial.page.base.html', escalaComercialBase(toyota()));
  });
});

describe('campos: etiqueta visible ENCIMA, sin superposición, con aviso corto', () => {
  const campos = ['escala-input-maquinas', 'escala-input-horas', 'escala-input-turnos', 'escala-input-dias'];
  const aviso = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`)?.textContent;

  it('los 4 campos están en el componente compartido, cada uno con su <label> asociada', () => {
    const c = toyota();
    const etiquetas: string[] = [];
    for (const id of campos) {
      const input = c.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
      expect(input, id).toBeTruthy();
      const label = c.querySelector(`label[for="${input.id}"]`);
      expect(label, `label de ${id}`).toBeTruthy();
      etiquetas.push(label!.textContent!);
    }
    expect(etiquetas).toEqual(['Máquinas en paralelo', 'Horas por turno', 'Turnos por día', 'Días de trabajo por mes']);
  });

  it('el orden en pantalla es máquinas, horas por turno, turnos por día y días; el texto de ayuda explica qué definen', () => {
    const c = toyota();
    const cont = c.querySelector('[data-testid="escala-maquinas-campos"]')!;
    expect([...cont.querySelectorAll('input')].map((i) => i.dataset.testid)).toEqual(campos);
    expect(cont.textContent).toContain('Las horas por turno, los turnos por día y los días de trabajo definen las horas disponibles por máquina.');
    expect(cont.textContent).not.toContain('solo se usan en ese cálculo');
  });

  it('ninguna etiqueta va posicionada de forma absoluta dentro de los campos (era la causa del texto tapado)', () => {
    const c = toyota();
    const contenedor = c.querySelector('[data-testid="escala-maquinas-campos"]')!;
    expect(contenedor.querySelectorAll('.absolute')).toHaveLength(0);
    for (const id of campos) {
      const input = c.querySelector(`[data-testid="${id}"]`)!;
      expect(input.className).not.toMatch(/\bpr-(12|14|16)\b/); // sin relleno derecho reservado a una etiqueta superpuesta
    }
  });

  it('los 4 campos muestran lo que se escribe (valor en el estado y en el campo) y arrancan con 8 h, 1 turno, 22 días', () => {
    const c = toyota();
    expect(fieldByUnit(c, 'Horas por turno').value).toBe('8');
    expect(fieldByUnit(c, 'Turnos por día').value).toBe('1');
    expect(fieldByUnit(c, 'Días').value).toBe('22');
    typeInto(fieldByUnit(c, 'Horas por turno'), '12'); typeInto(fieldByUnit(c, 'Turnos por día'), '2'); typeInto(fieldByUnit(c, 'Máquinas'), '10'); typeInto(fieldByUnit(c, 'Días'), '20');
    expect([fieldByUnit(c, 'Horas por turno').value, fieldByUnit(c, 'Turnos por día').value, fieldByUnit(c, 'Máquinas').value, fieldByUnit(c, 'Días').value]).toEqual(['12', '2', '10', '20']);
  });

  it('24.000 pzs, 10 máquinas, 8 h, 1 turno, 22 días: la tarjeta se muestra (ejemplo de Fernando)', () => {
    const c = toyota();
    typeInto(c.querySelector('input[placeholder="0"]'), '24000');
    typeInto(machines(c), '10');
    expect(text(c)).toContain('Base: 10 máq. × 8 h × 1 turno × 22 días = 1.760 hs/mes disponibles');
  });

  describe('Máquinas en paralelo: entero entre 1 y 100', () => {
    it.each([['1'], ['50'], ['100']])('%s se calcula', (n) => {
      const c = toyota();
      typeInto(machines(c), n);
      expect(result(c)).not.toBeNull();
      expect(aviso(c, 'escala-aviso-maquinas')).toBeUndefined();
    });

    it.each([['101'], ['1000'], ['0'], ['-3'], ['1.5']])('%s: sin tarjeta y con aviso corto en el campo', (n) => {
      const c = toyota();
      typeInto(machines(c), n);
      expect(result(c)).toBeNull();
      expect(aviso(c, 'escala-aviso-maquinas')).toBe('⚠ Máquinas en paralelo: entero entre 1 y 100.');
      expect(machines(c).getAttribute('aria-invalid')).toBe('true');
    });

    it('vacío no es un error: sin aviso y sin tarjeta', () => {
      const c = toyota();
      expect(aviso(c, 'escala-aviso-maquinas')).toBeUndefined();
      expect(result(c)).toBeNull();
    });
  });

  describe('Días de trabajo por mes: entre 1 y 31', () => {
    it.each([['0'], ['32'], ['-1']])('%s: sin tarjeta y con aviso corto', (n) => {
      const c = toyota();
      typeInto(machines(c), '2');
      typeInto(days(c), n);
      expect(result(c)).toBeNull();
      expect(aviso(c, 'escala-aviso-dias')).toBe('⚠ Días/Mes: entre 1 y 31.');
    });

    it('vacío con máquinas en uso: aviso (sin días no se puede calcular); vacío con N vacío: nada', () => {
      const c = toyota();
      typeInto(days(c), '');
      expect(aviso(c, 'escala-aviso-dias')).toBeUndefined();
      typeInto(machines(c), '2');
      expect(aviso(c, 'escala-aviso-dias')).toBe('⚠ Días/Mes: entre 1 y 31.');
      expect(result(c)).toBeNull();
    });
  });
});
