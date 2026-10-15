import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTaylorCurve } from '@/hooks/use-taylor-curve';
import { computeMachineScale } from '@/lib/machine-scale';
import { PdfPaginaDashboard } from '@/components/calculator/PdfPaginaDashboard';
import { TOYOTA_INPUTS } from '../../../tests/fixtures/toyota';

// Página 1 del PDF con máquinas en paralelo. Caso Toyota: 350 y 237,5 hs/mes; 176 hs por máquina.
function Pagina1({ machines, hoursPerShift = 8, shiftsPerDay = 1, days = 22 }: { machines: string | number; hoursPerShift?: number; shiftsPerDay?: number; days?: number }) {
  const t = useTaylorCurve({ ...TOYOTA_INPUTS, horasPorTurno: hoursPerShift, turnosPorDia: shiftsPerDay });
  const machineScale = t.capacityCheck
    ? computeMachineScale({ hrsComp: t.capacityCheck.hrsCompExact, hrsSeco: t.capacityCheck.hrsSecoExact, machines, hoursPerShift, shiftsPerDay, daysPerMonth: days })
    : null;
  return (
    <PdfPaginaDashboard
      logos={{ company: '', brand: '' }} saveClientName="Toyota" pieceName="Eje de transmisión"
      curveDataInfo={t.curveDataInfo} monthlyProduction={10000} tcCurrent={2.0} tcPremiumInput={1.375}
      toolChangeTime={2} horasPorTurno={hoursPerShift} turnosPorDia={shiftsPerDay} capacityCheck={t.capacityCheck}
      machineScale={machineScale} pageNumber={1} totalPages={4}
    />
  );
}
const html = (props: Parameters<typeof Pagina1>[0]) => renderToStaticMarkup(<Pagina1 {...props} />);
const golden = () => readFileSync('tests/golden/pdf-pagina-1.base.html', 'utf8');
/** El marcado sin la tarjeta nueva (no tiene <div> anidados). */
const withoutSummary = (h: string) => h.replace(/<div data-testid="escala-maquinas-resultado"[^>]*>.*?<\/div>/, '');
const plain = (h: string) => h.replace(/<[^>]*>/g, '');

describe('PDF página 1 con máquinas en paralelo', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z')); });
  afterAll(() => vi.useRealTimers());

  it('N vacío: idéntica a main y sin la tarjeta nueva', () => {
    const h = html({ machines: '' });
    expect(h).toBe(golden());
    expect(h).not.toContain('escala-maquinas-resultado');
    expect(h).not.toContain('Utilización teórica');
  });

  it.each([[0], [1.5], [-1], ['abc']])('N inválido (%j): idéntica a main', (machines) => {
    expect(html({ machines })).toBe(golden());
  });

  it('días inválidos con N completo: idéntica a main (sin tarjeta)', () => {
    expect(html({ machines: 2, days: 0 })).toBe(golden()); // días inválidos -> sin tarjeta
  });

  it('1 máquina: 199 % → 135 %, capacidad insuficiente, necesarias 2 → 2, ≈ 0,6 liberadas, base y nota', () => {
    const h = html({ machines: 1 });
    const t = plain(h);
    expect(t).toContain('Utilización teórica: 199 % ⚠ capacidad insuficiente → 135 % ⚠ capacidad insuficiente');
    expect(t).toContain('Máquinas necesarias: 2 → 2');
    expect(t).toContain('≈ 0,6 máquinas equivalentes liberadas');
    expect(t).toContain('Base: 1 máq. × 8 h × 1 turno × 22 días = 176 hs/mes disponibles (teórico: sin paradas ni mantenimiento)');
    expect(t).toContain('Las horas liberadas generan ahorro solo si se utilizan (más producción, menos horas extra o una máquina evitada).');
  });

  it('2 máquinas: 99 % → 67 %, sin capacidad insuficiente', () => {
    const t = plain(html({ machines: 2 }));
    expect(t).toContain('Utilización teórica: 99 % → 67 %');
    expect(t).not.toMatch(/capacidad insuficiente/i);
    expect(t).toContain('Base: 2 máq. × 8 h × 1 turno × 22 días = 352 hs/mes disponibles');
  });

  it('con la tarjeta, TODO lo demás de la página es idéntico a main (mismos números, logo, pie y estructura)', () => {
    for (const machines of [1, 2, 3]) expect(withoutSummary(html({ machines }))).toBe(golden());
  });

  it('los números existentes de la página no cambian: capacidad 350 → 238 hs/mes, 113 liberadas, ahorro y costos', () => {
    const t = plain(html({ machines: 2 }));
    expect(t).toContain('Capacidad requerida: 350 hs/mes (actual) → 238 hs/mes (Secocut)');
    expect(t).toContain('113 hs máquina liberadas/mes');
    expect(t).toContain('$0.79'); expect(t).toContain('$0.55');
    expect(t).toContain('+USD 2,442.50');
  });

  it('la tarjeta va justo debajo de la franja de capacidad y antes del pie', () => {
    const h = html({ machines: 1 });
    const capacidad = h.indexOf('Capacidad requerida');
    const tarjeta = h.indexOf('escala-maquinas-resultado');
    const pie = h.indexOf('Valores sugeridos');
    expect(capacidad).toBeGreaterThan(-1);
    expect(tarjeta).toBeGreaterThan(capacidad);
    expect(pie).toBeGreaterThan(tarjeta);
  });

  it('línea Base con separador de miles: 1000 máquinas -> "1.000 máq. … = 176.000 hs/mes"', () => {
    expect(plain(html({ machines: 1000 }))).toContain('Base: 1.000 máq. × 8 h × 1 turno × 22 días = 176.000 hs/mes disponibles');
  });

  it('el caso real que falló: 8445 h por turno -> no hay tarjeta y la caja de productividad no muestra Pzas/Trn ni Pzas/Día', () => {
    const h = html({ machines: 10, hoursPerShift: 8445 });
    const t = plain(h);
    expect(h).not.toContain('escala-maquinas-resultado');
    expect(t).not.toContain('Utilización teórica');
    expect(t).toContain('Pzas / Hora');          // no depende del turno: se mantiene
    expect(t).not.toContain('Pzas / Trn');
    expect(t).not.toContain('Pzas / Día');
    expect(t).not.toContain('8445');
    expect(t).toContain('Capacidad requerida: 350 hs/mes'); // lo demás de la página sigue
  });

  it('2 turnos de 8 h: la caja de productividad conserva sus fichas (datos válidos, números de siempre)', () => {
    const t = plain(html({ machines: '', shiftsPerDay: 2 }));
    expect(t).toContain('Pzas / Trn (8h)');
    expect(t).toContain('Pzas / Día');
  });

  it('4 turnos de 8 h (32 h por día): sin tarjeta y sin fichas por turno', () => {
    const h = html({ machines: 2, shiftsPerDay: 4 });
    expect(h).not.toContain('escala-maquinas-resultado');
    expect(plain(h)).not.toContain('Pzas / Trn');
  });

  it('dos turnos de 7,5 h y 20 días: la línea Base lo dice', () => {
    expect(plain(html({ machines: 1, hoursPerShift: 7.5, shiftsPerDay: 2, days: 20 }))).toContain('Base: 1 máq. × 7,5 h × 2 turnos × 20 días = 300 hs/mes disponibles');
  });
});
