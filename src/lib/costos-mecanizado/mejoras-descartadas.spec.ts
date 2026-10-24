import { describe, expect, it } from 'vitest';
import { calcPieza, calcResumen } from '@/lib/costos-mecanizado/calc';
import { claveMejora, mejoras, mejorasDescartadas } from '@/lib/costos-mecanizado/mejoras';
import { CALC_VERSION, REGLAS_POR_DEFECTO, type MejoraDescartada, type Pieza } from '@/lib/costos-mecanizado/types';
import { COSTO_HORA, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Mejoras descartadas con motivo. Valores a mano, a partir de los oráculos de CAR-001: 10 mejoras, ahorro potencial USD 44.015,
// la primera Productividad de Op20 = USD 12.000 (20 % de 2,40 USD de corte × 25.000). Sin la de Op20: 44.015 − 12.000 = 32.015.
const descarte = (over: Partial<MejoraDescartada> = {}): MejoraDescartada => ({
  motivoTipo: 'limitacion-maquina', motivo: 'El husillo no admite más avance', por: 'u1', porEmail: 'ana@secocut.com',
  fecha: '2026-10-23T12:00:00.000Z', ahorroAnualAlDescartar: 12000, ...over,
});
const CLAVE_OP20 = 'Productividad|op20|';
const TODAS = [
  'Productividad|op20|', 'Herramienta|op30|op30-h1', 'Herramienta|op40|op40-h1', 'Herramienta|op10|op10-h1', 'Productividad|op50|',
  'Tiempos muertos|op10|', 'Tiempos muertos|op50|', 'Calidad|op30|', 'Calidad|op40|', 'Tiempos muertos|op30|',
];
const conDescartes = (claves: string[]): Pieza => ({ ...crearCarcasa(), mejorasDescartadas: Object.fromEntries(claves.map((c) => [c, descarte()])) });
const activas = (p: Pieza) => mejoras(calcPieza(p, COSTO_HORA), p);
const total = (p: Pieza) => activas(p).reduce((s, m) => s + m.ahorroAnual, 0);

describe('sin ningún descarte todo da igual que antes', () => {
  it('CAR-001: 10 mejoras, ahorro USD 44.015, la primera Productividad de Op20 con 12.000', () => {
    const p = crearCarcasa();
    const l = activas(p);
    expect(l).toHaveLength(10);
    expect(l[0].categoria).toBe('Productividad');
    expect(l[0].opId).toBe('op20');
    expect(Math.round(l[0].ahorroAnual)).toBe(12000);
    expect(Math.round(total(p))).toBe(44015);
    expect(l.map((m) => m.clave).sort()).toEqual([...TODAS].sort());
    expect(mejorasDescartadas(calcPieza(p, COSTO_HORA), p)).toEqual([]);
  });
  it('un mapa vacío (queda así al reactivar la última) es igual que no tener el campo', () => {
    const p = { ...crearCarcasa(), mejorasDescartadas: {} };
    expect(activas(p)).toHaveLength(10);
    expect(Math.round(total(p))).toBe(44015);
  });
  it('el resumen: cantMejoras 10, ahorro 44.015 y calcVersion 5', () => {
    const r = calcResumen(crearCarcasa(), COSTO_HORA);
    expect(r.cantMejoras).toBe(10);
    expect(Math.round(r.ahorroPotencialAnual)).toBe(44015);
    expect(r.calcVersion).toBe(5);
    expect(CALC_VERSION).toBe(5);
  });
});

describe('descartar', () => {
  it('descartar Productividad de Op20: quedan 9 mejoras y el total baja de 44.015 a 32.015 (44.015 − 12.000)', () => {
    const p = conDescartes([CLAVE_OP20]);
    const l = activas(p);
    expect(l).toHaveLength(9);
    expect(l.map((m) => m.clave)).not.toContain(CLAVE_OP20);
    expect(Math.round(total(p))).toBe(32015);
    expect(l[0].clave).toBe('Herramienta|op30|op30-h1'); // la que sigue en el orden por ahorro
  });
  it('el resumen guardado trae el ahorro SIN las descartadas (9 mejoras, 32.015) y calcVersion 5', () => {
    const r = calcResumen(conDescartes([CLAVE_OP20]), COSTO_HORA);
    expect(r.cantMejoras).toBe(9);
    expect(Math.round(r.ahorroPotencialAnual)).toBe(32015);
    expect(r.calcVersion).toBe(5);
  });
  it('descartar todas: 0 mejoras y ahorro 0 (también en el resumen)', () => {
    const p = conDescartes(TODAS);
    expect(activas(p)).toEqual([]);
    expect(total(p)).toBe(0);
    const r = calcResumen(p, COSTO_HORA);
    expect(r.cantMejoras).toBe(0);
    expect(r.ahorroPotencialAnual).toBe(0);
  });
  it('reactivar (quitar la entrada) vuelve a 10 mejoras y 44.015', () => {
    const p = conDescartes([CLAVE_OP20]);
    const { [CLAVE_OP20]: _quitada, ...resto } = p.mejorasDescartadas!;
    void _quitada;
    const reactivada = { ...p, mejorasDescartadas: resto };
    expect(activas(reactivada)).toHaveLength(10);
    expect(Math.round(total(reactivada))).toBe(44015);
  });
  it('descartar no cambia el costo de la pieza: 9,3570 USD/pza y 233.926 USD/año', () => {
    const p = conDescartes(TODAS);
    const r = calcPieza(p, COSTO_HORA);
    expect(r.costoPieza.toFixed(4)).toBe('9.3570');
    expect(Math.round(r.costoAnual)).toBe(233926);
  });
});

describe('clave estable', () => {
  it('claveMejora usa categoría, id de la operación e id de la posición (o vacío)', () => {
    expect(claveMejora('Productividad', 'op20')).toBe('Productividad|op20|');
    expect(claveMejora('Herramienta', 'op30', 'op30-h1')).toBe('Herramienta|op30|op30-h1');
  });
  it('al reordenar las operaciones la clave no cambia: el descarte sigue aplicando a la misma mejora y solo a esa', () => {
    // Reordenar la ruta cambia los costos (el scrap se acumula operación a operación), así que no se compara el total, sino QUÉ mejoras quedan.
    const reordenada = (p: Pieza): Pieza => ({ ...p, operaciones: [...p.operaciones].reverse() });
    const sinDescarte = reordenada(crearCarcasa());
    const conDescarte = reordenada(conDescartes([CLAVE_OP20]));
    const clavesSin = activas(sinDescarte).map((m) => m.clave);
    const clavesCon = activas(conDescarte).map((m) => m.clave);
    expect(clavesSin).toContain(CLAVE_OP20);
    expect(clavesCon).not.toContain(CLAVE_OP20);
    expect(clavesCon).toEqual(clavesSin.filter((c) => c !== CLAVE_OP20));
  });
});

describe('registro de descartadas', () => {
  it('lista las descartadas con su categoría, operación, motivo y si siguen vigentes', () => {
    const p = conDescartes([CLAVE_OP20, 'Herramienta|op30|op30-h1']);
    p.mejorasDescartadas![CLAVE_OP20] = descarte({ ahorroAnualAlDescartar: 12000 });
    p.mejorasDescartadas!['Herramienta|op30|op30-h1'] = descarte({ motivoTipo: 'ya-probado', motivo: 'Ya probamos otra broca', ahorroAnualAlDescartar: 8892 });
    const v = mejorasDescartadas(calcPieza(p, COSTO_HORA), p);
    expect(v.map((x) => x.clave)).toEqual([CLAVE_OP20, 'Herramienta|op30|op30-h1']); // de mayor a menor ahorro al descartar
    expect(v[0]).toMatchObject({ categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', vigente: true });
    expect(v[0].posicionId).toBeUndefined();
    expect(v[1]).toMatchObject({ categoria: 'Herramienta', opId: 'op30', posicionId: 'op30-h1', opNombre: 'Agujereado', vigente: true });
    expect(v[1].descarte.motivo).toBe('Ya probamos otra broca');
    expect(v[0].mejora?.clave).toBe(CLAVE_OP20);
  });
  it('si la pieza cambió y la mejora ya no se dispararía, igual figura en el registro (vigente: false) y no suma', () => {
    const p = conDescartes([CLAVE_OP20]);
    // Op20 con corte mucho menor: la Productividad deja de dispararse
    p.operaciones.find((o) => o.id === 'op20')!.herramientas.forEach((h) => { h.opciones[0].cortePorPiezaMin = 0.05; });
    const v = mejorasDescartadas(calcPieza(p, COSTO_HORA), p);
    expect(v).toHaveLength(1);
    expect(v[0].vigente).toBe(false);
    expect(v[0].mejora).toBeNull();
    expect(activas(p).map((m) => m.clave)).not.toContain(CLAVE_OP20);
  });
  it('si la operación se eliminó, el registro la conserva con nombre vacío', () => {
    const p = conDescartes([CLAVE_OP20]);
    p.operaciones = p.operaciones.filter((o) => o.id !== 'op20');
    const v = mejorasDescartadas(calcPieza(p, COSTO_HORA), p);
    expect(v[0]).toMatchObject({ opId: 'op20', opNombre: '', vigente: false });
  });
  it('con las reglas por defecto y sin descartes explícitos no hay registro', () => {
    const p = crearCarcasa();
    expect(mejorasDescartadas(calcPieza(p, COSTO_HORA), p, REGLAS_POR_DEFECTO)).toEqual([]);
  });
});
