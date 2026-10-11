import { describe, expect, it, vi } from 'vitest';

// El hook solo usa useMemo de React: lo reemplazamos por una ejecución directa para
// poder llamarlo como función pura, sin jsdom ni @testing-library.
// FRÁGIL: si este test falla tras un cambio en use-taylor-curve.ts, revisar primero
// (1) si el hook empezó a usar otro hook de React (useState, useEffect…): hay que
// sumarlo a este mock; (2) si cambiaron los nombres de los campos de `data`
// (desgloseActual/desglosePremium); (3) si cambió la grilla de velocidades (el test
// busca la fila con speed === Vc cargada).
vi.mock('react', () => ({ useMemo: <T,>(fn: () => T) => fn() }));

import { useTaylorCurve, type UseTaylorCurveInputs } from '@/hooks/use-taylor-curve';
import { MATERIALS } from '@/lib/taylor-data';

const VC = 200;

function inputs(operationType: UseTaylorCurveInputs['operationType'], z: string | number): UseTaylorCurveInputs {
  return {
    operationType, materialId: MATERIALS[1].nombre,
    machineCostHr: 80, toolChangeTime: 1, machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85,
    coolantInternal: false, drillingOrientation: 'vertical', profundidadAgujero: 30,
    monthlyProduction: 100, horasPorTurno: 8, turnosPorDia: 1, isStressTestActive: false,
    toolNameCurrent: 'CNMG120408', toolCostCurrent: 10, apCurrent: 2, feedCurrent: 0.2, vcCurrent: VC,
    pcsCurrent: 5, tcCurrent: 7, zCurrent: z, edgesCurrent: 4, dcCurrent: 20, aeCurrent: '', lifeModeCurrent: 'piezas',
    toolNamePremium: 'CNMG120408', toolCostPremium: 10, apPremium: 2, feedPremium: 0.2, vcPremium: VC,
    pcsPremium: 5, tcPremiumInput: 7, zPremium: z, edgesPremium: 4, dcPremium: 20, aePremium: '', lifeModePremium: 'piezas',
  };
}

function inserto(operationType: UseTaylorCurveInputs['operationType'], z: string | number) {
  const row = useTaylorCurve(inputs(operationType, z)).curveDataInfo.data.find(r => r.speed === VC);
  if (!row) throw new Error('la grilla de velocidades no incluye la Vc cargada');
  return { actual: row.desgloseActual.inserto, premium: row.desglosePremium.inserto };
}

describe('Z (dientes) en el costo de herramienta', () => {
  it.each(['turning', 'drilling'] as const)('%s: Z=4 da el mismo costo de inserto que Z vacío', (op) => {
    const sinZ = inserto(op, '');
    const conZ = inserto(op, 4);
    expect(sinZ.actual).toBeGreaterThan(0);
    expect(conZ.actual).toBeCloseTo(sinZ.actual, 9);
    expect(conZ.premium).toBeCloseTo(sinZ.premium, 9);
  });

  it('torneado con Z vacío: (10 USD / 4 filos) / 5 piezas por filo = 0,50 USD', () => {
    expect(inserto('turning', '').actual).toBeCloseTo(0.5, 9);
  });

  it('fresado: Z=4 sigue multiplicando el costo de inserto', () => {
    const sinZ = inserto('milling', '');
    const conZ = inserto('milling', 4);
    expect(sinZ.actual).toBeGreaterThan(0);
    expect(conZ.actual / sinZ.actual).toBeCloseTo(4, 9);
    expect(conZ.premium / sinZ.premium).toBeCloseTo(4, 9);
  });
});
