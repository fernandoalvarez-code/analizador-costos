import { describe, expect, it } from 'vitest';
import { calcPieza, calcPlanta, type PiezaConResumen } from '@/lib/costos-mecanizado/calc';
import { mejoras } from '@/lib/costos-mecanizado/mejoras';
import { REGLAS_POR_DEFECTO, type Pieza, type ResumenPieza } from '@/lib/costos-mecanizado/types';
import { generarPiezasAleatorias, MAQUINAS_A, documentoPieza, piezaCarcasa } from '../../../scripts/costos-seed/datos';

// Verificación cruzada con las piezas del seed (CAR-001 + las 98 generadas): lo que sale de los RESÚMENES (calcPlanta) coincide con
// sumar pieza por pieza calcPieza y mejoras(), con tolerancia 0,01.
const costoHora = Object.fromEntries(MAQUINAS_A.map((m) => [m.id, m.costoHora]));
const piezas: Pieza[] = [piezaCarcasa(), ...generarPiezasAleatorias()];

describe('planta a partir de resúmenes = suma pieza por pieza', () => {
  const filas: PiezaConResumen[] = piezas.map((p, i) => {
    // el resumen tal como lo escribe el seed (calcResumen + auditoría)
    const doc = documentoPieza(p, MAQUINAS_A, 'seed', 0) as unknown as { resumen: ResumenPieza };
    return { id: `p${i}`, codigo: p.codigo, nombre: p.nombre, volumenAnual: p.volumenAnual, resumen: doc.resumen };
  });
  const planta = calcPlanta(filas);

  it('99 piezas (CAR-001 + 98 generadas)', () => {
    expect(piezas).toHaveLength(99);
    expect(planta.piezasAnalizadas).toBe(99);
  });
  it('el costo anual de la planta = Σ calcPieza(pieza).costoAnual (tolerancia 0,01)', () => {
    const suma = piezas.reduce((s, p) => s + calcPieza(p, costoHora).costoAnual, 0);
    expect(Math.abs(planta.costoAnual - suma)).toBeLessThan(0.01);
  });
  it('el ahorro potencial de la planta = Σ mejoras().ahorroAnual de cada pieza (tolerancia 0,01)', () => {
    const suma = piezas.reduce((s, p) => s + mejoras(calcPieza(p, costoHora), p, REGLAS_POR_DEFECTO).reduce((t, m) => t + m.ahorroAnual, 0), 0);
    expect(Math.abs(planta.ahorroPotencialAnual - suma)).toBeLessThan(0.01);
  });
  it('por máquina y por rubro suman el costo anual', () => {
    const porMaquina = Object.values(planta.porMaquinaAnual).reduce((s, v) => s + v, 0);
    const porRubro = Object.values(planta.porRubroAnual).reduce((s, v) => s + v, 0);
    expect(Math.abs(porMaquina - planta.costoAnual)).toBeLessThan(0.01);
    expect(Math.abs(porRubro - planta.costoAnual)).toBeLessThan(0.01);
  });
  it('piezasPara80 = cuántas piezas (de mayor a menor) hacen falta para llegar al 80 % (cálculo independiente)', () => {
    const anuales = piezas.map((p) => calcPieza(p, costoHora).costoAnual).sort((a, b) => b - a);
    const total = anuales.reduce((s, v) => s + v, 0);
    let acum = 0; let n = 0;
    for (const a of anuales) { acum += a; n++; if (acum >= 0.8 * total) break; }
    expect(planta.piezasPara80).toBe(n);
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThan(99);
  });
  it('la pieza más cara es la de mayor costo anual', () => {
    const mayor = piezas.map((p) => ({ codigo: p.codigo, anual: calcPieza(p, costoHora).costoAnual })).sort((a, b) => b.anual - a.anual)[0];
    expect(planta.piezaMasCara?.codigo).toBe(mayor.codigo);
    expect(Math.abs((planta.piezaMasCara?.costoAnual ?? 0) - mayor.anual)).toBeLessThan(0.01);
  });
});
