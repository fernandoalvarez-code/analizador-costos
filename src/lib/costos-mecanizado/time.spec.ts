import { describe, expect, it } from 'vitest';
import { parseMmss, toMmss } from '@/lib/costos-mecanizado/time';

describe('toMmss (minutos -> mm:ss)', () => {
  it.each([[1.5, '1:30'], [0.45, '0:27'], [5, '5:00'], [0, '0:00'], [0.5, '0:30'], [12.25, '12:15'], [0.1, '0:06']])('%s min = %s', (min, texto) => {
    expect(toMmss(min)).toBe(texto);
  });
  it('redondea al segundo más cercano, incluso cuando sube el minuto', () => {
    expect(toMmss(0.9999)).toBe('1:00');
    expect(toMmss(1.0083)).toBe('1:00'); // 60,5 s -> 60 s
  });
  it.each([[-1], [NaN], [Infinity]])('valor inválido (%s) -> 0:00', (min) => {
    expect(toMmss(min)).toBe('0:00');
  });
});

describe('parseMmss (texto -> minutos)', () => {
  it.each([['1:30', 1.5], ['0:27', 0.45], ['5', 5], ['0:00', 0], ['12:15', 12.25], ['10', 10]])('"%s" = %s min', (texto, min) => {
    expect(parseMmss(texto)).toBeCloseTo(min, 9);
  });
  it('acepta coma decimal, con y sin ":"', () => {
    expect(parseMmss('1,5')).toBeCloseTo(1.5, 9);
    expect(parseMmss('0,45')).toBeCloseTo(0.45, 9);
    expect(parseMmss('0:27,5')).toBeCloseTo(0.45 + 0.5 / 60, 9);
    expect(parseMmss('2.25')).toBeCloseTo(2.25, 9);
  });
  it('ignora espacios', () => { expect(parseMmss('  1:30  ')).toBeCloseTo(1.5, 9); });
  it('segundos de 60 o más se suman como están: "0:90" = 1,5 min', () => { expect(parseMmss('0:90')).toBeCloseTo(1.5, 9); });
  it.each([[''], ['   '], ['abc'], ['1:2:3'], ['-5'], [':30'], ['1:'], ['NaN'], ['1:ab'], ['--1'], ['1,2,3']])('entrada inválida "%s" -> 0', (texto) => {
    expect(parseMmss(texto)).toBe(0);
  });
  it('un valor que no es texto -> 0', () => {
    expect(parseMmss(undefined as unknown as string)).toBe(0);
    expect(parseMmss(null as unknown as string)).toBe(0);
    expect(parseMmss(5 as unknown as string)).toBe(0);
  });
  it('ida y vuelta: parseMmss(toMmss(x)) conserva el valor al segundo', () => {
    for (const min of [0.45, 1.5, 7.2, 30]) expect(parseMmss(toMmss(min))).toBeCloseTo(Math.round(min * 60) / 60, 9);
  });
});
