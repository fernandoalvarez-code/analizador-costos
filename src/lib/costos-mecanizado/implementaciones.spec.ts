import { describe, expect, it } from 'vitest';
import { calcPieza, calcResumen } from '@/lib/costos-mecanizado/calc';
import { logradoTotalAnual, logroPorImplementacion } from '@/lib/costos-mecanizado/implementaciones';
import { CALC_VERSION, type Implementacion, type Pieza } from '@/lib/costos-mecanizado/types';
import { COSTO_HORA, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Mejoras implementadas: logro por implementación y total, a nivel PIEZA, con el volumen ACTUAL. Oráculos de CAR-001: 9,3570 USD/pza,
// 25.000 piezas/año (233.926 USD/año), 10 mejoras y USD 44.015 de ahorro potencial.
const impl = (id: string, costoPiezaAntes: number, over: Partial<Implementacion> = {}): Implementacion => ({
  id, categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', titulo: 'El tiempo de corte domina la operación',
  fecha: '2026-10-20', nota: 'Se subió el avance', por: 'u1', porEmail: 'ana@secocut.com', registradaEn: '2026-10-20T12:00:00.000Z',
  costoPiezaAntes, ahorroEstimadoAnual: 12000, ...over,
});
/** CAR-001 con el tiempo de corte de las herramientas de Op20 multiplicado por `factor` (dato de prueba escrito a mano). */
const conCorteOp20 = (factor: number, implementaciones?: Implementacion[]): Pieza => {
  const p = crearCarcasa();
  for (const h of p.operaciones.find((o) => o.id === 'op20')!.herramientas) h.opciones[0].cortePorPiezaMin *= factor;
  if (implementaciones) p.implementaciones = implementaciones;
  return p;
};
const calc = (p: Pieza) => calcPieza(p, COSTO_HORA);
const VOL = 25000;

describe('sin implementaciones todo da igual que antes', () => {
  it('logrado 0 y sin logros por implementación', () => {
    const p = crearCarcasa();
    expect(logroPorImplementacion(p, calc(p))).toEqual([]);
    expect(logradoTotalAnual(p, calc(p))).toBe(0);
  });
  it('el resumen: mismos números de siempre + calcVersion 4, logradoAnual 0 y cantImplementadas 0', () => {
    const r = calcResumen(crearCarcasa(), COSTO_HORA);
    expect(r.costoPieza.toFixed(4)).toBe('9.3570');
    expect(Math.round(r.costoAnual)).toBe(233926);
    expect(r.cantMejoras).toBe(10);
    expect(Math.round(r.ahorroPotencialAnual)).toBe(44015);
    expect(r.calcVersion).toBe(4);
    expect(CALC_VERSION).toBe(4);
    expect(r.logradoAnual).toBe(0);
    expect(r.cantImplementadas).toBe(0);
  });
  it('un arreglo vacío (queda así al anular la última) es igual que no tener el campo', () => {
    const p = { ...crearCarcasa(), implementaciones: [] };
    expect(logradoTotalAnual(p, calc(p))).toBe(0);
    expect(calcResumen(p, COSTO_HORA).cantImplementadas).toBe(0);
  });
});

describe('una implementación', () => {
  it('sin cambios en los datos el logro es 0 (costo antes = costo actual)', () => {
    const p = { ...crearCarcasa(), implementaciones: [impl('i1', calc(crearCarcasa()).costoPieza)] };
    expect(logroPorImplementacion(p, calc(p))[0]).toBeCloseTo(0, 9);
    expect(calcResumen(p, COSTO_HORA).logradoAnual).toBeCloseTo(0, 9);
    expect(calcResumen(p, COSTO_HORA).cantImplementadas).toBe(1);
  });
  it('con menos tiempo de corte en Op20: logro = (costo antes − costo nuevo) × 25.000, con las dos piezas calculadas por separado', () => {
    const antes = calc(crearCarcasa()).costoPieza;     // 9,3570
    const despues = calc(conCorteOp20(0.8)).costoPieza; // Op20 con 20 % menos de corte
    const p = conCorteOp20(0.8, [impl('i1', antes)]);
    const logro = logroPorImplementacion(p, calc(p))[0];
    expect(logro).toBeCloseTo((antes - despues) * VOL, 6);
    expect(logro).toBeGreaterThan(0);
    // Escrito a mano: la estimación de la mejora (12.000 = 20 % del corte de Op20 × 25.000) es solo el corte directo; el motor suma además la
    // cascada de scrap (el scrap se calcula sobre el costo acumulado de la ruta). Por pieza, con los % de scrap de la fixture (0,5 · 1,2 · 1,0 · 0,3):
    const corte = 0.2 * 2.4;                                   // 0,4800 (Op20 cuesta 2,40 de corte: 3,2 min × 45/60)
    const scrapOp20 = corte * 0.005;                           // 0,0024
    const scrapOp30 = (corte + scrapOp20) * 0.012;             // 0,0057888
    const scrapOp40 = (corte + scrapOp20 + scrapOp30) * 0.01;  // 0,0048819
    const scrapOp50 = (corte + scrapOp20 + scrapOp30 + scrapOp40) * 0.003; // 0,0014792
    const ahorroPorPieza = corte + scrapOp20 + scrapOp30 + scrapOp40 + scrapOp50;
    expect(ahorroPorPieza).toBeCloseTo(0.4945499, 7);
    expect(logro).toBeCloseTo(0.4945499 * VOL, 1);             // ≈ 12.363,75 USD/año (no 12.000: la diferencia de 363,75 es la cascada de scrap)
    expect(Math.round(logro * 100) / 100).toBe(12363.75);
    expect(logradoTotalAnual(p, calc(p))).toBeCloseTo(logro, 9);
    const resumen = calcResumen(p, COSTO_HORA);
    expect(resumen.logradoAnual).toBeCloseTo(logro, 9);
    expect(resumen.cantImplementadas).toBe(1);
  });
});

describe('dos implementaciones encadenadas', () => {
  it('los logros suman exactamente (primero − actual) × volumen', () => {
    const actual = calc(conCorteOp20(0.8)).costoPieza;
    const p = conCorteOp20(0.8, [impl('i1', 9.357), impl('i2', 9.0)]);
    const [l1, l2] = logroPorImplementacion(p, calc(p));
    expect(l1).toBeCloseTo((9.357 - 9.0) * VOL, 6);     // a mano: 0,357 × 25.000 = 8.925
    expect(l1).toBeCloseTo(8925, 6);
    expect(l2).toBeCloseTo((9.0 - actual) * VOL, 6);
    expect(l1 + l2).toBeCloseTo((9.357 - actual) * VOL, 9);
    expect(logradoTotalAnual(p, calc(p))).toBeCloseTo(l1 + l2, 9);
  });
});

describe('volumen y signo', () => {
  it('un cambio de volumen sin cambio de costo por pieza NO se cuenta como ahorro: logrado 0 con cualquier volumen', () => {
    const antes = calc(crearCarcasa()).costoPieza;
    for (const volumen of [25000, 50000, 10000]) {
      const p = { ...crearCarcasa(), volumenAnual: volumen, implementaciones: [impl('i1', antes)] };
      // modo lote: el costo por pieza no depende del volumen, así que (antes − ahora) = 0 y el logro es 0 a cualquier volumen
      expect(logradoTotalAnual(p, calc(p))).toBeCloseTo(0, 9);
    }
  });
  it('si el costo por pieza bajó, el logro escala con el volumen ACTUAL: a 50.000 piezas es exactamente el doble que a 25.000', () => {
    const antes = calc(crearCarcasa()).costoPieza;
    const a25 = conCorteOp20(0.8, [impl('i1', antes)]);
    const a50 = { ...conCorteOp20(0.8, [impl('i1', antes)]), volumenAnual: 50000 };
    const l25 = logradoTotalAnual(a25, calc(a25));
    const l50 = logradoTotalAnual(a50, calc(a50));
    expect(calc(a50).costoPieza).toBeCloseTo(calc(a25).costoPieza, 12); // mismo costo por pieza
    expect(l50).toBeCloseTo(2 * l25, 6);
  });
  it('si la pieza costó MÁS que antes, el logro es negativo (no se recorta a 0)', () => {
    const antes = calc(crearCarcasa()).costoPieza;
    const p = conCorteOp20(1.2, [impl('i1', antes)]);
    const logro = logroPorImplementacion(p, calc(p))[0];
    expect(logro).toBeLessThan(0);
    expect(logro).toBeCloseTo((antes - calc(conCorteOp20(1.2)).costoPieza) * VOL, 6);
    expect(logradoTotalAnual(p, calc(p))).toBe(logro);
    expect(calcResumen(p, COSTO_HORA).logradoAnual).toBeLessThan(0);
  });
});
