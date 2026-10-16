import { describe, expect, it, vi } from 'vitest';

// El hook solo usa useMemo de React (ver use-taylor-curve.spec.ts).
vi.mock('react', () => ({ useMemo: <T,>(fn: () => T) => fn() }));

import { useTaylorCurve } from '@/hooks/use-taylor-curve';
import { computeMachineScale, formatMachinesFreed, formatUtilization } from '@/lib/machine-scale';
import { TOYOTA_INPUTS } from '../../tests/fixtures/toyota';

/**
 * EJEMPLO DE REFERENCIA (caso Toyota, torneado), calculado a mano:
 *
 *   Datos: 10.000 piezas/mes, cambio de herramienta 2 min, rendimiento 20 y 40 piezas por filo,
 *          tiempos de corte 2,0 y 1,375 min, 8 h por turno, 1 turno, 22 días.
 *
 *   Horas requeridas (las que calcula la app):
 *     actual     = 10.000 · (2,0   + 2/20) / 60 = 10.000 · 2,100 / 60 = 350,0 hs/mes
 *     propuesta  = 10.000 · (1,375 + 2/40) / 60 = 10.000 · 1,425 / 60 = 237,5 hs/mes
 *   Horas por máquina = 8 · 1 · 22 = 176 hs/mes
 *
 *   1 máquina:  350 / 176 = 198,86 % -> 199 %   ·  237,5 / 176 = 134,94 % -> 135 %   (ambas > 100 %)
 *   2 máquinas: 350 / 352 =  99,43 % ->  99 %   ·  237,5 / 352 =  67,47 % ->  67 %
 *   3 máquinas: 350 / 528 =  66,29 % ->  66 %   ·  237,5 / 528 =  44,98 % ->  45 %
 *   Máquinas necesarias: techo(350 / 176 = 1,989) = 2  ·  techo(237,5 / 176 = 1,349) = 2   -> 2 → 2
 *   Máquinas equivalentes liberadas: (350 − 237,5) / 176 = 112,5 / 176 = 0,6392 -> "0,6"
 */
describe('ejemplo de referencia Toyota: hook real + función pura contra los valores calculados a mano', () => {
  const cap = () => useTaylorCurve(TOYOTA_INPUTS).capacityCheck!;
  const scale = (machines: number) => computeMachineScale({
    hrsComp: cap().hrsCompExact, hrsSeco: cap().hrsSecoExact, machines, hoursPerShift: 8, shiftsPerDay: 1, daysPerMonth: 22,
  })!;

  it('las horas requeridas que calcula la app son 350 y 237,5 (a mano: 10.000 · 2,100 / 60 y 10.000 · 1,425 / 60)', () => {
    expect(cap().hrsCompExact).toBeCloseTo((10000 * (2.0 + 2 / 20)) / 60, 9);
    expect(cap().hrsSecoExact).toBeCloseTo((10000 * (1.375 + 2 / 40)) / 60, 9);
    expect(cap().hrsCompExact).toBeCloseTo(350, 9);
    expect(cap().hrsSecoExact).toBeCloseTo(237.5, 9);
  });

  it('1 máquina: 199 % y 135 %, ambas por encima de 100 %', () => {
    const r = scale(1);
    expect(r.hoursPerMachine).toBe(176);
    expect(formatUtilization(r.utilizationCurrent)).toBe('199 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('135 %');
    expect(r.insufficientCurrent).toBe(true);
    expect(r.insufficientProposed).toBe(true);
  });

  it('2 máquinas: 99 % y 67 %', () => {
    const r = scale(2);
    expect(formatUtilization(r.utilizationCurrent)).toBe('99 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('67 %');
    expect(r.insufficientCurrent).toBe(false);
  });

  it('3 máquinas: 66 % y 45 %', () => {
    const r = scale(3);
    expect(formatUtilization(r.utilizationCurrent)).toBe('66 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('45 %');
  });

  it('máquinas necesarias 2 → 2 (con cualquier N) y liberadas 0,64', () => {
    for (const n of [1, 2, 3]) {
      const r = scale(n);
      expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([2, 2]);
      expect(r.machinesFreed).toBeCloseTo(112.5 / 176, 9);
      expect(r.machinesFreed.toFixed(2)).toBe('0.64');
      expect(formatMachinesFreed(r.machinesFreed)).toBe('0,6');
    }
  });

  it('con N vacío la función está apagada aunque las horas existan', () => {
    expect(computeMachineScale({ hrsComp: cap().hrsCompExact, hrsSeco: cap().hrsSecoExact, machines: '', hoursPerShift: 8, shiftsPerDay: 1, daysPerMonth: 22 })).toBeNull();
  });
});
