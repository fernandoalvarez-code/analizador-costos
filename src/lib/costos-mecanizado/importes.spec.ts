import { describe, expect, it } from 'vitest';
import { conExacto, deltaPza, exactoPza, numeroPza, redondear, TOLERANCIA_IGUAL, usdPza } from '@/lib/costos-mecanizado/importes';
import { usd0, usd2 } from '@/components/costos/formato';

// Regla única de formato de importes (solo al mostrar). Todos los valores esperados están escritos a mano.
describe('redondear: redondeo decimal estable (no depende de la representación binaria)', () => {
  it('1,005 → 1,01 y 12,075 → 12,08, donde toFixed(2) da 1,00 y 12,07', () => {
    expect((1.005).toFixed(2)).toBe('1.00');   // el problema: 1,005 se guarda como 1,00499999999999989…
    expect((12.075).toFixed(2)).toBe('12.07'); // ídem
    expect(redondear(1.005, 2)).toBe(1.01);
    expect(redondear(12.075, 2)).toBe(12.08);
  });
  it('otros bordes de .xx5: 2,675 → 2,68 · 0,695 → 0,70 · 1,255 → 1,26 · 0,005 → 0,01', () => {
    expect(redondear(2.675, 2)).toBe(2.68);
    expect(redondear(0.695, 2)).toBe(0.7);
    expect(redondear(1.255, 2)).toBe(1.26);
    expect(redondear(0.005, 2)).toBe(0.01);
  });
  it('lo que no es un borde se redondea como siempre: 1,5077 → 1,51 · 0,4096 → 0,41 · 0,0049 → 0', () => {
    expect(redondear(1.5077, 2)).toBe(1.51);
    expect(redondear(0.4096, 2)).toBe(0.41);
    expect(redondear(0.0049, 2)).toBe(0);
  });
  it('negativos simétricos (mitad hacia arriba en valor absoluto): −1,005 → −1,01', () => {
    expect(redondear(-1.005, 2)).toBe(-1.01);
    expect(redondear(-0.2854, 2)).toBe(-0.29);
  });
  it('notación científica y no finitos no rompen: 1e-7 → 0 · NaN → 0', () => {
    expect(redondear(1e-7, 2)).toBe(0);
    expect(redondear(Number.NaN, 2)).toBe(0);
  });
});

describe('usdPza: importe por pieza con 2 decimales', () => {
  it.each([
    [1.5077, 'USD 1,51'], [0.4096, 'USD 0,41'], [0.695, 'USD 0,70'], [9.3570235, 'USD 9,36'], [12.075, 'USD 12,08'], [1.005, 'USD 1,01'],
    [0.005, 'USD 0,01'], [10, 'USD 10,00'], [1234.5678, 'USD 1.234,57'], [240.6, 'USD 240,60'],
  ])('%s → "%s"', (n, esperado) => { expect(usdPza(n)).toBe(esperado); });
  it('mayor que 0 y menor que 0,005 (se vería 0,00): "<USD 0,01"; 0 exacto: "USD 0,00"', () => {
    expect(usdPza(0.0024)).toBe('<USD 0,01');
    expect(usdPza(0.00499)).toBe('<USD 0,01');
    expect(usdPza(0.00001)).toBe('<USD 0,01');
    expect(usdPza(0)).toBe('USD 0,00');
  });
  it('un valor negativo lleva el signo delante del prefijo', () => {
    expect(usdPza(-0.2854)).toBe('−USD 0,29');
    expect(usdPza(-0.001)).toBe('−<USD 0,01');
  });
  it('un valor no finito se muestra USD 0,00', () => {
    expect(usdPza(Number.NaN)).toBe('USD 0,00');
  });
});

describe('numeroPza: igual que usdPza pero sin unidad (celdas de tablas cuya cabecera dice USD)', () => {
  it('1,5077 → "1,51" · 0,4096 → "0,41" · 0 → "0,00" · 0,0024 → "<0,01" · 12,075 → "12,08"', () => {
    expect(numeroPza(1.5077)).toBe('1,51');
    expect(numeroPza(0.4096)).toBe('0,41');
    expect(numeroPza(0)).toBe('0,00');
    expect(numeroPza(0.0024)).toBe('<0,01');
    expect(numeroPza(12.075)).toBe('12,08');
  });
});

describe('deltaPza: diferencia por pieza, signo delante del prefijo y unidad siempre igual', () => {
  it('−0,2854 → "−USD 0,29/pza" · +0,05 → "+USD 0,05/pza" · +1,0120 → "+USD 1,01/pza"', () => {
    expect(deltaPza(-0.2854)).toBe('−USD 0,29/pza');
    expect(deltaPza(0.05)).toBe('+USD 0,05/pza');
    expect(deltaPza(1.012)).toBe('+USD 1,01/pza');
  });
  it('si se vería 0,00 pero no es 0: "<USD 0,01/pza" o "−<USD 0,01/pza" (no "igual")', () => {
    expect(deltaPza(0.003)).toBe('<USD 0,01/pza');
    expect(deltaPza(-0.003)).toBe('−<USD 0,01/pza');
  });
  it('ya no existe el formato con la unidad detrás del número ("−0,2854 USD/pza")', () => {
    expect(deltaPza(-0.2854)).not.toMatch(/\d USD\/pza/);
  });
  it('la tolerancia con la que se muestra "igual" sigue siendo la de siempre (0,00005)', () => {
    expect(TOLERANCIA_IGUAL).toBe(0.00005);
  });
});

describe('detalle exacto: title con 4 decimales', () => {
  it('1,5077 → "USD 1,5077 exacto" · 9,3570235 → "USD 9,3570 exacto" · −0,2854 → "−USD 0,2854 exacto"', () => {
    expect(exactoPza(1.5077)).toBe('USD 1,5077 exacto');
    expect(exactoPza(9.3570235)).toBe('USD 9,3570 exacto');
    expect(exactoPza(-0.2854)).toBe('−USD 0,2854 exacto');
  });
  it('conExacto anexa el exacto a un tooltip existente sin pisarlo', () => {
    expect(conExacto('Tiempo de corte: USD 0,41', 0.4096)).toBe('Tiempo de corte: USD 0,41 · USD 0,4096 exacto');
  });
});

describe('la captura de Fernando', () => {
  it('USD 0,4096 → "USD 0,41"; USD 0,6950 → "USD 0,70"; delta −0,2854 → "−USD 0,29/pza"; anual 5.708 → "USD 5.708"; precio máximo 240,60 → "USD 240,60"', () => {
    expect(usdPza(0.4096)).toBe('USD 0,41');
    expect(usdPza(0.695)).toBe('USD 0,70');
    expect(deltaPza(-0.2854)).toBe('−USD 0,29/pza');
    expect(`ahorra ${usd0(5708)}/año`).toBe('ahorra USD 5.708/año');
    expect(usd2(240.6)).toBe('USD 240,60');
  });
});
