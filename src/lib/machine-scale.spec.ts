import { describe, expect, it } from 'vitest';
import { computeMachineScale, formatMachinesFreed, formatUtilization, shiftHoursProblem, type MachineScaleInput } from '@/lib/machine-scale';

// Datos comunes: 8 h × 1 turno × 22 días = 176 hs/mes por máquina.
const base = (over: Partial<MachineScaleInput> = {}): MachineScaleInput => ({
  hrsComp: 350, hrsSeco: 237.5, machines: 1, hoursPerShift: 8, shiftsPerDay: 1, daysPerMonth: 22, ...over,
});
const near = (actual: number, expected: number, digits = 6) => expect(actual).toBeCloseTo(expected, digits);

describe('computeMachineScale: caso Toyota (350 y 237,5 hs/mes; 176 hs por máquina), calculado a mano', () => {
  // 350 / 176 = 1,98864 · 237,5 / 176 = 1,34943 · (350 − 237,5) / 176 = 0,63920
  it('1 máquina: 199 % → 135 %, ambas por encima de 100 %, necesarias 2 → 2', () => {
    const r = computeMachineScale(base({ machines: 1 }))!;
    near(r.hoursPerMachine, 176); near(r.hoursAvailable, 176);
    near(r.utilizationCurrent, 350 / 176); near(r.utilizationProposed, 237.5 / 176);
    expect(formatUtilization(r.utilizationCurrent)).toBe('199 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('135 %');
    expect(r.insufficientCurrent).toBe(true);
    expect(r.insufficientProposed).toBe(true);
    expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([2, 2]);
    near(r.machinesFreed, 112.5 / 176);
  });

  it('2 máquinas: 99 % → 67 %, sin capacidad insuficiente, necesarias 2 → 2', () => {
    const r = computeMachineScale(base({ machines: 2 }))!;
    near(r.hoursAvailable, 352);
    expect(formatUtilization(r.utilizationCurrent)).toBe('99 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('67 %');
    expect(r.insufficientCurrent).toBe(false);
    expect(r.insufficientProposed).toBe(false);
    expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([2, 2]);
    near(r.machinesFreed, 112.5 / 176); // no depende de N
  });

  it('3 máquinas: 66 % → 45 %, necesarias 2 → 2 (con más máquinas que las necesarias)', () => {
    const r = computeMachineScale(base({ machines: 3 }))!;
    near(r.hoursAvailable, 528);
    expect(formatUtilization(r.utilizationCurrent)).toBe('66 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('45 %');
    expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([2, 2]);
  });

  it('máquinas liberadas: 0,64 sin redondear, "0,6" mostrado', () => {
    const r = computeMachineScale(base())!;
    near(r.machinesFreed, 0.6392, 4); // 112,5 / 176 = 0,63920…
    expect(formatMachinesFreed(r.machinesFreed)).toBe('0,6');
  });
});

describe('computeMachineScale: horas por encima y por debajo de la disponible', () => {
  it('horas requeridas por DEBAJO de la disponible (100 y 80 hs con 1 máquina): 57 % → 45 %, necesarias 1 → 1', () => {
    const r = computeMachineScale(base({ hrsComp: 100, hrsSeco: 80 }))!;
    expect(formatUtilization(r.utilizationCurrent)).toBe('57 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('45 %');
    expect(r.insufficientCurrent).toBe(false);
    expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([1, 1]);
    near(r.machinesFreed, 20 / 176);
  });

  it('actual por ENCIMA y propuesta por DEBAJO (300 y 150 hs, 1 máquina): 170 % → 85 %, necesarias 2 → 1', () => {
    const r = computeMachineScale(base({ hrsComp: 300, hrsSeco: 150 }))!;
    expect(formatUtilization(r.utilizationCurrent)).toBe('170 %');
    expect(formatUtilization(r.utilizationProposed)).toBe('85 %');
    expect(r.insufficientCurrent).toBe(true);
    expect(r.insufficientProposed).toBe(false);
    expect([r.machinesNeededCurrent, r.machinesNeededProposed]).toEqual([2, 1]);
  });

  it('horas exactamente iguales a la capacidad: 100 % y NO se suma una máquina de más', () => {
    const r = computeMachineScale(base({ hrsComp: 176, hrsSeco: 176 }))!;
    near(r.utilizationCurrent, 1);
    expect(r.insufficientCurrent).toBe(false);
    expect(r.machinesNeededCurrent).toBe(1);
  });

  it('ruido de coma flotante en el borde no suma una máquina (3 × 58,666… hs contra 176)', () => {
    const hrs = 0.1 * 3 * 586.6666666666666; // ≈ 176 con error de redondeo
    const r = computeMachineScale(base({ hrsComp: hrs, hrsSeco: hrs }))!;
    expect(r.machinesNeededCurrent).toBe(1);
  });

  it('apenas por encima de la capacidad sí suma una máquina', () => {
    const r = computeMachineScale(base({ hrsComp: 176.01, hrsSeco: 100 }))!;
    expect(r.machinesNeededCurrent).toBe(2);
    expect(r.insufficientCurrent).toBe(true);
  });

  it('propuesta peor que la actual: liberadas negativas y no se muestran', () => {
    const r = computeMachineScale(base({ hrsComp: 100, hrsSeco: 150 }))!;
    expect(r.machinesFreed).toBeLessThan(0);
    expect(formatMachinesFreed(r.machinesFreed)).toBeNull();
  });
});

describe('computeMachineScale: otras bases de cálculo', () => {
  it('2 turnos de 8 h y 20 días: 320 hs por máquina', () => {
    const r = computeMachineScale(base({ shiftsPerDay: 2, daysPerMonth: 20, machines: 2 }))!;
    near(r.hoursPerMachine, 320); near(r.hoursAvailable, 640);
    near(r.utilizationCurrent, 350 / 640);
  });

  it('acepta textos numéricos, como los guardan los formularios', () => {
    const r = computeMachineScale({ hrsComp: 350, hrsSeco: 237.5, machines: '2', hoursPerShift: '8', shiftsPerDay: '1', daysPerMonth: '22' })!;
    near(r.hoursAvailable, 352);
  });
});

describe('computeMachineScale: N vacío o datos inválidos -> null (no se muestra nada nuevo)', () => {
  it.each([['vacío', ''], ['espacios', '  '], ['null', null], ['undefined', undefined]] as const)('Máquinas en paralelo %s', (_n, machines) => {
    expect(computeMachineScale(base({ machines }))).toBeNull();
  });

  it.each([0, -1, -3, 1.5, 0.5, NaN, Infinity, '0', '-2', '1.5', 'abc', '2 máquinas'])('Máquinas en paralelo inválido: %j', (machines) => {
    expect(computeMachineScale(base({ machines }))).toBeNull();
  });

  it.each([
    ['Hrs/Trn = 0', { hoursPerShift: 0 }], ['Hrs/Trn negativo', { hoursPerShift: -8 }], ['Hrs/Trn vacío', { hoursPerShift: '' }],
    ['Trns/Día = 0', { shiftsPerDay: 0 }], ['Trns/Día vacío', { shiftsPerDay: '' }], ['Trns/Día NaN', { shiftsPerDay: NaN }],
    ['días = 0', { daysPerMonth: 0 }], ['días negativo', { daysPerMonth: -22 }], ['días vacío', { daysPerMonth: '' }], ['días > 31', { daysPerMonth: 32 }],
  ] as const)('%s', (_n, over) => { expect(computeMachineScale(base(over))).toBeNull(); });

  it.each([
    ['horas actual 0', { hrsComp: 0 }], ['horas propuesta 0', { hrsSeco: 0 }], ['horas negativas', { hrsComp: -5 }],
    ['horas NaN', { hrsSeco: NaN }], ['horas infinitas', { hrsComp: Infinity }],
  ] as const)('%s', (_n, over) => { expect(computeMachineScale(base(over))).toBeNull(); });
});

describe('formato', () => {
  it('utilización sin decimales', () => {
    expect(formatUtilization(1.98864)).toBe('199 %');
    expect(formatUtilization(0.4)).toBe('40 %');
    expect(formatUtilization(1.006)).toBe('101 %');
  });
  it('máquinas liberadas: un decimal con coma; nada por debajo de 0,05', () => {
    expect(formatMachinesFreed(0.64)).toBe('0,6');
    expect(formatMachinesFreed(1.26)).toBe('1,3');
    expect(formatMachinesFreed(0.05)).toBe('0,1');
    expect(formatMachinesFreed(0.049)).toBeNull();
    expect(formatMachinesFreed(0)).toBeNull();
    expect(formatMachinesFreed(NaN)).toBeNull();
  });
});

describe('horas por turno posibles: Hrs/Trn entre 1 y 24 y Hrs/Trn × Trns/Día no mayor a 24', () => {
  it('el caso real que falló: 10 máquinas con 8445 h por turno -> no se calcula (antes: 1.857.900 hs/mes y 0 %)', () => {
    expect(computeMachineScale(base({ machines: 10, hoursPerShift: 8445 }))).toBeNull();
    expect(shiftHoursProblem(8445, 1)).toBe('Hrs/Trn debe estar entre 1 y 24.');
  });

  it.each([[1, 1], [7.5, 2], [8, 3], [12, 2], [24, 1], [1, 5], [8, 1], ['8', '3']] as const)('Hrs/Trn %s × Trns/Día %s es posible', (h, t) => {
    expect(shiftHoursProblem(h, t)).toBeNull();
    expect(computeMachineScale(base({ hoursPerShift: h, shiftsPerDay: t }))).not.toBeNull();
  });

  it.each([[25, 1], [8445, 1], [24.01, 1], [0.5, 1], [-8, 1], [1e9, 1]] as const)('Hrs/Trn %s fuera de 1–24: aviso y sin cálculo', (h, t) => {
    expect(shiftHoursProblem(h, t)).toBe('Hrs/Trn debe estar entre 1 y 24.');
    expect(computeMachineScale(base({ hoursPerShift: h, shiftsPerDay: t }))).toBeNull();
  });

  it.each([[8, 4], [12, 3], [24, 2], [7.5, 4], [10, 2.5]] as const)('Hrs/Trn %s × Trns/Día %s supera 24 h por día', (h, t) => {
    expect(shiftHoursProblem(h, t)).toBe('Hrs/Trn × Trns/Día no puede superar 24 h.');
    expect(computeMachineScale(base({ hoursPerShift: h, shiftsPerDay: t }))).toBeNull();
  });

  it('el límite es inclusivo: 24 h por día exactas (8 × 3, 12 × 2, 24 × 1) sí se calculan', () => {
    for (const [h, t] of [[8, 3], [12, 2], [24, 1]] as const) expect(computeMachineScale(base({ hoursPerShift: h, shiftsPerDay: t }))).not.toBeNull();
  });

  it('vacío no es un error (la app usa 8 y 1 por defecto) y no genera aviso', () => {
    expect(shiftHoursProblem('', '')).toBeNull();
    expect(shiftHoursProblem(null, undefined)).toBeNull();
    expect(shiftHoursProblem('', 3)).toBeNull();
  });

  it('con datos válidos el resultado es el de siempre (Toyota: 199 % → 135 %)', () => {
    expect(formatUtilization(computeMachineScale(base({ machines: 1 }))!.utilizationCurrent)).toBe('199 %');
  });
});
