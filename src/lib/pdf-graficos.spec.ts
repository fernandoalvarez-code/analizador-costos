import { describe, expect, it } from 'vitest';
import {
  formatLife, formatSignedPercent, niceStep, pdfWindow, percentVariation, truncateForPdf, windowPdfData, xAxisFor, yAxisFor,
} from '@/lib/pdf-graficos';

const grid = (from: number, to: number, step = 10) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => ({ speed: from + i * step }));

describe('pdfWindow: del 60 % de la menor Vc al 160 % de la mayor', () => {
  it('122 y 130 m/min -> 73,2 a 208', () => {
    const w = pdfWindow(122, 130)!;
    expect(w.min).toBeCloseTo(73.2, 9);
    expect(w.max).toBeCloseTo(208, 9);
  });
  it('no depende del orden de las Vc', () => { expect(pdfWindow(130, 122)).toEqual(pdfWindow(122, 130)); });
  it.each([[0, 130], [122, 0], [NaN, 130], [122, Infinity], [-5, 130]])('Vc inválida (%j, %j): sin ventana', (a, b) => { expect(pdfWindow(a, b)).toBeNull(); });
});

describe('windowPdfData', () => {
  it('recorta una grilla de 50 a 370 m/min al entorno de trabajo (80 a 200)', () => {
    const out = windowPdfData(grid(50, 370), 122, 130);
    expect(out[0].speed).toBe(80);
    expect(out[out.length - 1].speed).toBe(200);
    expect(out.some((d) => d.speed > 208 || d.speed < 73.2)).toBe(false);
  });
  it('conserva las dos Vc de trabajo aunque no sean múltiplos de 10', () => {
    const data = [...grid(50, 370), { speed: 122 }, { speed: 130 }].sort((a, b) => a.speed - b.speed);
    const speeds = windowPdfData(data, 122, 130).map((d) => d.speed);
    expect(speeds).toContain(122);
    expect(speeds).toContain(130);
  });
  it('sin una de las Vc devuelve todo el rango (no hay ventana que centrar)', () => {
    const data = grid(50, 370);
    expect(windowPdfData(data, 0, 130)).toEqual(data);
    expect(windowPdfData(data, 122, NaN)).toEqual(data);
  });
  it('con Vc muy distintas (100 y 300) la ventana las abarca: 60 a 480', () => {
    const out = windowPdfData(grid(50, 600), 100, 300);
    expect(out[0].speed).toBe(60);
    expect(out[out.length - 1].speed).toBe(480);
  });
});

describe('percentVariation y formato', () => {
  it('0,79 → 0,65 es -17,7 %; 20 → 30 es +50 %', () => {
    expect(percentVariation(0.79, 0.65)).toBeCloseTo(-17.72, 1);
    expect(percentVariation(20, 30)).toBeCloseTo(50, 9);
  });
  it.each([[0, 5], [-1, 5], [NaN, 5], [5, NaN], [5, Infinity]])('no calculable (%j → %j): null', (a, b) => { expect(percentVariation(a, b)).toBeNull(); });
  it('formatSignedPercent: mismo formato que la página 1 ("-30.8%") y "+" para las mejoras', () => {
    expect(formatSignedPercent(-30.8)).toBe('-30.8%');
    expect(formatSignedPercent(50)).toBe('+50.0%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });
});

describe('ejes con valores redondos', () => {
  it('niceStep elige 1, 2, 2,5, 5 × 10ⁿ', () => {
    expect(niceStep(0, 100, 5)).toBe(20);
    expect(niceStep(0, 1, 5)).toBe(0.2);
    expect(niceStep(60, 220, 7)).toBe(25);
    expect(niceStep(0, 150, 5)).toBe(50);
  });
  it('eje X de 73,2 a 208: domain y marcas redondas que contienen la ventana', () => {
    const a = xAxisFor(73.2, 208);
    expect(a.domain[0]).toBeLessThanOrEqual(73.2);
    expect(a.domain[1]).toBeGreaterThanOrEqual(208);
    expect(a.ticks.every((t) => t % 10 === 0 || t % 25 === 0)).toBe(true);
    expect(a.ticks.length).toBeLessThanOrEqual(9);
    expect(a.ticks[0]).toBe(a.domain[0]);
    expect(a.ticks[a.ticks.length - 1]).toBe(a.domain[1]);
  });
  it('eje Y de costos: se acerca a los datos (no arranca en 0) y deja aire arriba', () => {
    const y = yAxisFor([0.65, 0.79, 1.05, 0.96]);
    expect(y.domain[0]).toBeGreaterThan(0);
    expect(y.domain[0]).toBeLessThanOrEqual(0.65);
    expect(y.domain[1]).toBeGreaterThan(1.05);
  });
  it('eje Y de vida (zeroBased): arranca en 0 y llega a la vida máxima', () => {
    const y = yAxisFor([4, 30, 128], { zeroBased: true });
    expect(y.domain[0]).toBe(0);
    expect(y.domain[1]).toBeGreaterThanOrEqual(128);
    expect(y.ticks[0]).toBe(0);
  });
  it('sin datos válidos: eje mínimo por defecto', () => { expect(yAxisFor([NaN]).domain).toEqual([0, 1]); });
});

describe('formatLife', () => {
  it.each([[0, '0'], [20, '20'], [29.6, '30'], [128.4, '128'], [0.8, '0,8'], [3.14, '3,1'], [NaN, 'N/A']])('%j -> %s', (v, out) => { expect(formatLife(v as number)).toBe(out); });
});

describe('truncateForPdf', () => {
  it('no toca los textos cortos', () => { expect(truncateForPdf('CNMG120408-M3 TP2501')).toBe('CNMG120408-M3 TP2501'); });
  it('recorta a 90 caracteres con puntos suspensivos', () => {
    const out = truncateForPdf('x'.repeat(300));
    expect(out).toHaveLength(90);
    expect(out.endsWith('…')).toBe(true);
  });
  it('el límite exacto no recorta', () => { expect(truncateForPdf('a'.repeat(90))).toHaveLength(90); });
});
