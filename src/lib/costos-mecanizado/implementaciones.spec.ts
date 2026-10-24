import { describe, expect, it } from 'vitest';
import { calcPieza, calcResumen } from '@/lib/costos-mecanizado/calc';
import { logradoTotalAnual, ultimaImplementacion } from '@/lib/costos-mecanizado/implementaciones';
import { CALC_VERSION, type Implementacion, type LineaBase, type Pieza } from '@/lib/costos-mecanizado/types';
import { COSTO_HORA, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Ahorro logrado desde la LÍNEA BASE, a nivel pieza, con el volumen ACTUAL. Oráculos de CAR-001: 9,3570235 USD/pza, 25.000 piezas/año
// (233.926 USD/año), 10 mejoras y USD 44.015 de ahorro potencial.
const VOL = 25000;
const impl = (id: string, registradaEn: string, over: Partial<Implementacion> = {}): Implementacion => ({
  id, categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', titulo: 'El tiempo de corte domina la operación',
  fecha: '2026-10-20', nota: 'Se subió el avance', por: 'u1', porEmail: 'ana@secocut.com', registradaEn, costoPiezaAntes: 9.357, ahorroEstimadoAnual: 12000, ...over,
});
const base = (costoPiezaBase: number, over: Partial<LineaBase> = {}): LineaBase => ({
  costoPiezaBase, fecha: '2026-10-19T12:00:00.000Z', por: 'u1', porEmail: 'ana@secocut.com', volumenAnualBase: VOL, ...over,
});
/** CAR-001 con el tiempo de corte de las herramientas de Op20 multiplicado por `factor` (dato de prueba escrito a mano). */
const conCorteOp20 = (factor: number, extra: Partial<Pieza> = {}): Pieza => {
  const p = crearCarcasa();
  for (const h of p.operaciones.find((o) => o.id === 'op20')!.herramientas) h.opciones[0].cortePorPiezaMin *= factor;
  return { ...p, ...extra };
};
const calc = (p: Pieza) => calcPieza(p, COSTO_HORA);
const COSTO_BASE = calc(crearCarcasa()).costoPieza; // 9,3570235

/**
 * Por pieza, bajar 20 % el corte de Op20 ahorra más que el corte directo: el scrap se calcula sobre el costo acumulado de la ruta, así que baja
 * también el de Op20 y el de las operaciones siguientes. A mano, con los % de scrap de la fixture (0,5 · 1,2 · 1,0 · 0,3).
 */
const AHORRO_20 = (() => {
  const corte = 0.2 * 2.4;                                   // 0,4800 (Op20 cuesta 2,40 de corte: 3,2 min × 45/60)
  const scrapOp20 = corte * 0.005;                           // 0,0024
  const scrapOp30 = (corte + scrapOp20) * 0.012;             // 0,0057888
  const scrapOp40 = (corte + scrapOp20 + scrapOp30) * 0.01;  // 0,0048819
  const scrapOp50 = (corte + scrapOp20 + scrapOp30 + scrapOp40) * 0.003; // 0,0014792
  return corte + scrapOp20 + scrapOp30 + scrapOp40 + scrapOp50;
})();

describe('sin línea base no se mide el ahorro logrado', () => {
  it('logrado 0 y el resumen marca tieneLineaBase false (con o sin implementaciones)', () => {
    const sin = crearCarcasa();
    expect(logradoTotalAnual(sin, calc(sin))).toBe(0);
    const conHitos = { ...conCorteOp20(0.8), implementaciones: [impl('i1', '2026-10-20T12:00:00.000Z', { costoPiezaAntes: 9.357 })] };
    expect(logradoTotalAnual(conHitos, calc(conHitos))).toBe(0); // costoPiezaAntes NO se usa para inventar una línea base
    const r = calcResumen(conHitos, COSTO_HORA);
    expect(r.tieneLineaBase).toBe(false);
    expect(r.logradoAnual).toBe(0);
    expect(r.cantImplementadas).toBe(1);
  });
  it('el resto del resumen es el de siempre: 9,3570 USD/pza, 233.926 USD/año, 10 mejoras, 44.015, calcVersion 6', () => {
    const r = calcResumen(crearCarcasa(), COSTO_HORA);
    expect(r.costoPieza.toFixed(4)).toBe('9.3570');
    expect(Math.round(r.costoAnual)).toBe(233926);
    expect(r.cantMejoras).toBe(10);
    expect(Math.round(r.ahorroPotencialAnual)).toBe(44015);
    expect(r.calcVersion).toBe(6);
    expect(CALC_VERSION).toBe(6);
    expect(r.tieneLineaBase).toBe(false);
    expect(r.logradoAnual).toBe(0);
    expect(r.cantImplementadas).toBe(0);
    expect('ultimaMejoraFecha' in r).toBe(false);
    expect('ultimaMejoraPor' in r).toBe(false);
  });
});

describe('con línea base', () => {
  it('el costo base de CAR-001 es 9,3570235 USD/pza', () => {
    expect(COSTO_BASE).toBeCloseTo(9.3570235, 6);
  });
  it('sin cambios en los datos el logrado es 0', () => {
    const p = { ...crearCarcasa(), lineaBase: base(COSTO_BASE) };
    expect(logradoTotalAnual(p, calc(p))).toBeCloseTo(0, 9);
    expect(calcResumen(p, COSTO_HORA)).toMatchObject({ tieneLineaBase: true });
  });
  it('datos nuevos de Op20 al 80 % del tiempo de corte: logrado = (9,3570235 − 8,8624736) × 25.000 = 12.363,75 (no 12.000: suma la cascada de scrap)', () => {
    const p = conCorteOp20(0.8, { lineaBase: base(COSTO_BASE) });
    expect(calc(p).costoPieza).toBeCloseTo(8.8624736, 6);
    const logrado = logradoTotalAnual(p, calc(p));
    expect(AHORRO_20).toBeCloseTo(0.4945499, 7);
    expect(logrado).toBeCloseTo((9.3570235 - 8.8624736) * VOL, 1);
    expect(logrado).toBeCloseTo(AHORRO_20 * VOL, 1);
    expect(Math.round(logrado * 100) / 100).toBe(12363.75);
    const r = calcResumen(p, COSTO_HORA);
    expect(r.logradoAnual).toBeCloseTo(logrado, 9);
    expect(r.tieneLineaBase).toBe(true);
  });
  it('una segunda mejora encima: el logrado es (base − costo actual) × volumen, sin sumar por hito', () => {
    // Op20 al 60 % del corte original (80 % y luego otro 25 % menos). El modelo es lineal en el corte: bajar 40 % ahorra el doble que bajar 20 %,
    // o sea 2 × 0,4945499 = 0,9890998 por pieza → 2 × 12.363,7475 = 24.727,495 USD/año.
    const p = conCorteOp20(0.6, {
      lineaBase: base(COSTO_BASE),
      // los costoPiezaAntes de los hitos son datos históricos: valores absurdos a propósito para probar que NO entran en el logrado
      implementaciones: [impl('i1', '2026-10-20T12:00:00.000Z', { costoPiezaAntes: 100 }), impl('i2', '2026-10-25T12:00:00.000Z', { costoPiezaAntes: 50 })],
    });
    const logrado = logradoTotalAnual(p, calc(p));
    expect(logrado).toBeCloseTo((COSTO_BASE - calc(p).costoPieza) * VOL, 6);
    expect(logrado).toBeCloseTo(2 * AHORRO_20 * VOL, 1);
    expect(logrado).toBeCloseTo(24727.495, 2); // a mano: 2 × 12.363,7475
    expect(calcResumen(p, COSTO_HORA).logradoAnual).toBeCloseTo(logrado, 9);
  });
  it('cambio de volumen sin cambio de costo por pieza: logrado = (base − actual) × volumen NUEVO (a mano: 0,4945499 × 50.000 = 24.727,50)', () => {
    // La pieza es de modo "lote": el costo por pieza no depende del volumen, así que (base − actual) sigue siendo 0,4945499 y solo cambia la
    // cantidad de piezas sobre la que se reparte. El volumen de la línea base (25.000) es informativo y no entra.
    const p = conCorteOp20(0.8, { lineaBase: base(COSTO_BASE, { volumenAnualBase: 25000 }), volumenAnual: 50000 });
    expect(calc(p).costoPieza).toBeCloseTo(8.8624736, 6);
    expect(logradoTotalAnual(p, calc(p))).toBeCloseTo(0.4945499 * 50000, 1);
    // y si el costo por pieza NO bajó, cambiar el volumen no inventa ahorro
    const igual = { ...crearCarcasa(), lineaBase: base(COSTO_BASE), volumenAnual: 50000 };
    expect(logradoTotalAnual(igual, calc(igual))).toBeCloseTo(0, 9);
  });
  it('si la pieza costó MÁS que la línea base, el logrado es negativo (a mano: −0,4945499 × 25.000 = −12.363,75), no se recorta a 0', () => {
    const p = conCorteOp20(1.2, { lineaBase: base(COSTO_BASE) });
    const logrado = logradoTotalAnual(p, calc(p));
    expect(logrado).toBeLessThan(0);
    expect(logrado).toBeCloseTo(-AHORRO_20 * VOL, 1);
    expect(calcResumen(p, COSTO_HORA).logradoAnual).toBeLessThan(0);
  });
});

describe('última mejora', () => {
  it('ultimaImplementacion: la más reciente por registradaEn, sin importar el orden del arreglo', () => {
    const p: Pick<Pieza, 'implementaciones'> = {
      implementaciones: [
        impl('i2', '2026-10-25T12:00:00.000Z', { porEmail: 'luis@secocut.com' }),
        impl('i1', '2026-10-20T12:00:00.000Z', { porEmail: 'ana@secocut.com' }),
        impl('i3', '2026-10-22T12:00:00.000Z', { porEmail: 'eva@secocut.com' }),
      ],
    };
    expect(ultimaImplementacion(p)?.id).toBe('i2');
    expect(ultimaImplementacion({ implementaciones: [] })).toBeNull();
    expect(ultimaImplementacion({})).toBeNull();
  });
  it('el resumen guarda ultimaMejoraFecha (registradaEn) y ultimaMejoraPor (email) de la más reciente', () => {
    const p: Pieza = {
      ...crearCarcasa(),
      implementaciones: [impl('i1', '2026-10-20T12:00:00.000Z'), impl('i2', '2026-10-25T12:00:00.000Z', { porEmail: 'luis@secocut.com' })],
    };
    const r = calcResumen(p, COSTO_HORA);
    expect(r.ultimaMejoraFecha).toBe('2026-10-25T12:00:00.000Z');
    expect(r.ultimaMejoraPor).toBe('luis@secocut.com');
    expect(r.cantImplementadas).toBe(2);
  });
});
