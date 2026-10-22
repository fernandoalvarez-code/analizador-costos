import { describe, expect, it } from 'vitest';
import { calcPieza } from '@/lib/costos-mecanizado/calc';
import { mejoras } from '@/lib/costos-mecanizado/mejoras';
import { REGLAS_POR_DEFECTO, type CategoriaMejora, type OpcionHerramienta, type Operacion, type Pieza, type ReglasCostos } from '@/lib/costos-mecanizado/types';
import { COSTO_HORA, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Reglas de mejoras (SPEC 6 + ADDENDUM 3 y 7). Las reglas usan ">" ESTRICTO: un valor EXACTO en el umbral no dispara.
// Bordes: se arman con el MOTOR COMPLETO usando una máquina de 60 USD/h (1 USD por minuto) y datos que dan totalOp = 1
// exacto, de modo que el cociente es el umbral. "Apenas por encima" usa un margen claro, nunca un epsilon de máquina.
const M60 = { M: 60 };

const herr = (o: Partial<OpcionHerramienta>): OpcionHerramienta => ({
  id: 'x', nombre: 'Herramienta X', precio: 0, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 1, cortePorPiezaMin: 0, cambioMin: 0, ...o,
});
function pieza(
  herramientas: Array<Partial<OpcionHerramienta>>,
  op: Partial<Operacion> = {},
  extra: Partial<Pieza> = {},
): Pieza {
  return {
    id: 'p', codigo: 'P', nombre: 'P', volumenAnual: 1000, modoProduccion: 'lote', piezasPorLote: 1, material: { quienPone: 'propio', costoPorPieza: 0 },
    operaciones: [{
      id: 'op', nombre: 'Operación', maquinaId: 'M', tiemposMuertosMin: 0, setupMin: 0, scrapPct: 0, ...op,
      herramientas: herramientas.map((h, i) => ({ id: `h${i}`, seleccionada: 0, opciones: [herr({ id: `o${i}`, nombre: `Herr ${i}`, ...h })] })),
    }],
    ...extra,
  };
}
const lista = (p: Pieza, reglas: ReglasCostos = REGLAS_POR_DEFECTO) => mejoras(calcPieza(p, M60), p, reglas);
const categorias = (p: Pieza, reglas?: ReglasCostos) => lista(p, reglas).map((m) => m.categoria);
const dispara = (p: Pieza, c: CategoriaMejora) => categorias(p).includes(c);

describe('el armado de los bordes da totalOp = 1 exacto en el motor completo', () => {
  it.each([
    ['productividad', pieza([{ precio: 0.55, cortePorPiezaMin: 0.45 }])],
    ['preparación', pieza([{ precio: 0.88 }], { setupMin: 0.12 })],
    ['herramienta', pieza([{ precio: 0.18, cortePorPiezaMin: 0.82 }])],
    ['roturas', pieza([{ cortePorPiezaMin: 0.95, roturaPct: 100, roturaExtraMin: 0.05 }])],
    ['calidad', pieza([{ cortePorPiezaMin: 0.92 }], { scrapPct: 8 }, { material: { quienPone: 'propio', costoPorPieza: 0.08 } })],
  ])('%s', (_n, p) => {
    expect(calcPieza(p, M60).operaciones[0].totalOp).toBe(1);
  });
});

describe('Productividad: corte / totalOp > 45 % (ahorro 20 % del corte)', () => {
  it('45 % exacto: NO dispara (motor completo)', () => {
    expect(dispara(pieza([{ precio: 0.55, cortePorPiezaMin: 0.45 }]), 'Productividad')).toBe(false);
  });
  it('45,1 %: dispara, con ahorro 20 % del corte y botón comparar', () => {
    const m = lista(pieza([{ precio: 0.549, cortePorPiezaMin: 0.451 }])).find((x) => x.categoria === 'Productividad')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.451 * 0.2, 9);
    expect(m.ahorroAnual).toBeCloseTo(0.451 * 0.2 * 1000, 6);
    expect(m.puedeComparar).toBe(true);
  });
});

describe('Preparación: setup / totalOp > 12 % (ahorro 40 % del setup)', () => {
  it('12 % exacto: NO dispara (motor completo)', () => {
    expect(dispara(pieza([{ precio: 0.88 }], { setupMin: 0.12 }), 'Preparación')).toBe(false);
  });
  it('12,1 %: dispara, con ahorro 40 % del setup y sin botón comparar', () => {
    const m = lista(pieza([{ precio: 0.879 }], { setupMin: 0.121 })).find((x) => x.categoria === 'Preparación')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.121 * 0.4, 9);
    expect(m.puedeComparar).toBe(false);
  });
});

describe('Herramienta: (consumo + cambios) de ESA herramienta / totalOp > 18 % (ahorro 35 %)', () => {
  it('18 % exacto: NO dispara (motor completo)', () => {
    expect(dispara(pieza([{ precio: 0.18, cortePorPiezaMin: 0.82 }]), 'Herramienta')).toBe(false);
  });
  it('18,1 %: dispara, con ahorro 35 % de consumo + cambios y botón comparar', () => {
    const m = lista(pieza([{ precio: 0.181, cortePorPiezaMin: 0.819 }])).find((x) => x.categoria === 'Herramienta')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.181 * 0.35, 9);
    expect(m.puedeComparar).toBe(true);
    expect(m.posicionId).toBe('h0');
  });
  it('cuenta los cambios de la herramienta: consumo 0,10 + cambios 0,09 = 19 %', () => {
    // cambio 0,09 min a 1 USD/min con 1 pieza por filo; corte 0,81
    const m = lista(pieza([{ precio: 0.1, cambioMin: 0.09, cortePorPiezaMin: 0.81 }])).find((x) => x.categoria === 'Herramienta');
    expect(m).toBeTruthy();
  });
  it('ADDENDUM 7: se evalúa por herramienta, no por la suma de la operación', () => {
    // Dos herramientas de 10 % cada una (20 % entre las dos): ninguna supera 18 % -> sin mejora de Herramienta
    expect(dispara(pieza([{ precio: 0.1 }, { precio: 0.1 }, { cortePorPiezaMin: 0.8 }]), 'Herramienta')).toBe(false);
    // Una de 19 % y otra de 10 %: dispara solo para la primera
    const m = lista(pieza([{ precio: 0.19, cortePorPiezaMin: 0.4 }, { precio: 0.1, cortePorPiezaMin: 0.31 }])).filter((x) => x.categoria === 'Herramienta');
    expect(m).toHaveLength(1);
    expect(m[0].posicionId).toBe('h0');
  });
});

describe('Calidad: scrap / totalOp > 8 % (ahorro 50 % del scrap)', () => {
  const material = { quienPone: 'propio' as const, costoPorPieza: 0.08 };
  it('8 % exacto: NO dispara (motor completo)', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 0.92 }], { scrapPct: 8 }, { material }), 'Calidad')).toBe(false);
  });
  it('scrap de ~8,9 %: dispara, con ahorro 50 % del scrap y sin botón comparar', () => {
    const p = pieza([{ cortePorPiezaMin: 0.92 }], { scrapPct: 9 }, { material });
    const op = calcPieza(p, M60).operaciones[0];
    const m = lista(p).find((x) => x.categoria === 'Calidad')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(op.scrap * 0.5, 9);
    expect(m.puedeComparar).toBe(false);
  });
});

describe('Roturas: costo de roturas de la herramienta / totalOp > 5 % (ahorro 60 %)', () => {
  it('5 % exacto: NO dispara (motor completo)', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 0.95, roturaPct: 100, roturaExtraMin: 0.05 }]), 'Roturas')).toBe(false);
  });
  it('5,1 %: dispara, con ahorro 60 % del costo de roturas y botón comparar', () => {
    const p = pieza([{ cortePorPiezaMin: 0.949, roturaPct: 100, roturaExtraMin: 0.051 }]);
    const m = lista(p).find((x) => x.categoria === 'Roturas')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.051 * 0.6, 9);
    expect(m.puedeComparar).toBe(true);
  });
  it('las piezas perdidas por rotura también cuentan (roturaScrapPct)', () => {
    // 100 % de roturas por pieza (pf 1), cada rotura tira la pieza el 10 %: scrapRot = 0,1 × acumulado
    const p = pieza([{ cortePorPiezaMin: 1, roturaPct: 100, roturaScrapPct: 10 }]);
    expect(dispara(p, 'Roturas')).toBe(true);
  });
});

describe('Tiempos muertos: muertos > 60 % del corte (minutos) Y aux > 0,05 USD/pza (ahorro 30 % de aux)', () => {
  it('condición 1 en el borde: muertos 0,6 min vs corte 1,0 min (60 % exacto): NO dispara', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 1 }], { tiemposMuertosMin: 0.6 }), 'Tiempos muertos')).toBe(false);
  });
  it('condición 1 apenas por encima: muertos 0,61 min: dispara, con ahorro 30 % de aux y sin botón comparar', () => {
    const m = lista(pieza([{ cortePorPiezaMin: 1 }], { tiemposMuertosMin: 0.61 })).find((x) => x.categoria === 'Tiempos muertos')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.61 * 0.3, 9);
    expect(m.puedeComparar).toBe(false);
  });
  it('condición 2 en el borde: aux = 0,05 USD/pza exacto (con la condición 1 cumplida): NO dispara', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 0.01 }], { tiemposMuertosMin: 0.05 }), 'Tiempos muertos')).toBe(false);
  });
  it('condición 2 apenas por encima: aux = 0,06 USD/pza: dispara', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 0.01 }], { tiemposMuertosMin: 0.06 }), 'Tiempos muertos')).toBe(true);
  });
  it('con la condición 1 incumplida no basta con aux alto', () => {
    expect(dispara(pieza([{ cortePorPiezaMin: 10 }], { tiemposMuertosMin: 1 }), 'Tiempos muertos')).toBe(false);
  });
});

describe('orden, importes y reglas editables', () => {
  it('caso base: 10 mejoras, ordenadas por ahorro anual, la primera es Productividad de Op20 (20 % de 2,40 USD × 25.000 = 12.000)', () => {
    const p = crearCarcasa();
    const l = mejoras(calcPieza(p, COSTO_HORA), p);
    expect(l).toHaveLength(10);
    for (let i = 1; i < l.length; i++) expect(l[i - 1].ahorroAnual).toBeGreaterThanOrEqual(l[i].ahorroAnual);
    expect(l[0].categoria).toBe('Productividad');
    expect(l[0].opId).toBe('op20');
    expect(l[0].ahorroPorPieza).toBeCloseTo(0.48, 3);
    expect(Math.round(l[0].ahorroAnual)).toBe(12000);
  });
  it('caso base: qué reglas disparan en cada operación (verificado a mano contra el SPEC)', () => {
    const p = crearCarcasa();
    const par = mejoras(calcPieza(p, COSTO_HORA), p).map((m) => `${m.categoria}:${m.opId}`).sort();
    expect(par).toEqual([
      'Calidad:op30', 'Calidad:op40', 'Herramienta:op10', 'Herramienta:op30', 'Herramienta:op40',
      'Productividad:op20', 'Productividad:op50', 'Tiempos muertos:op10', 'Tiempos muertos:op30', 'Tiempos muertos:op50',
    ]);
    // Op40: muertos 0,3 min contra 0,6 × 0,5 min de corte = 0,3 -> en el borde, NO dispara tiempos muertos
    expect(par).not.toContain('Tiempos muertos:op40');
  });
  it('cada mejora lleva categoría, operación, título, explicación con números y supuesto conservador', () => {
    const p = crearCarcasa();
    const m = mejoras(calcPieza(p, COSTO_HORA), p)[0];
    expect(m.opNombre).toBe('Desbaste y contorno');
    expect(m.titulo.length).toBeGreaterThan(5);
    expect(m.explicacion).toMatch(/\d/);
    expect(m.supuesto).toMatch(/−20 %/);
    expect(m.supuesto).toMatch(/conservadores/i);
  });
  it('los umbrales y supuestos salen de las reglas editables', () => {
    const p = pieza([{ precio: 0.55, cortePorPiezaMin: 0.45 }]);
    const mas = { ...REGLAS_POR_DEFECTO, productividad: { umbralPct: 40, ahorroPct: 50 } };
    const m = lista(p, mas).find((x) => x.categoria === 'Productividad')!;
    expect(m).toBeTruthy();
    expect(m.ahorroPorPieza).toBeCloseTo(0.45 * 0.5, 9);
    expect(categorias(p, { ...REGLAS_POR_DEFECTO, productividad: { umbralPct: 50, ahorroPct: 20 } })).not.toContain('Productividad');
  });
  it('sin reglas explícitas usa los defaults del código (reglasVersion 0)', () => {
    expect(REGLAS_POR_DEFECTO.reglasVersion).toBe(0);
    expect(REGLAS_POR_DEFECTO.productividad.umbralPct).toBe(45);
    expect(REGLAS_POR_DEFECTO.tiemposMuertos.umbralAuxUsd).toBe(0.05);
  });
  it('una pieza sin costo no genera mejoras ni divide por cero', () => {
    expect(lista(pieza([{}]))).toEqual([]);
  });
});
