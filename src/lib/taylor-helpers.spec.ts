import { describe, expect, it } from 'vitest';
import { auditarParametros, calcularRaTeorico, extraerRadioISO } from '@/lib/taylor-helpers';

// Ra teórico = f² / (32 · r) · 1000 [µm]. Con f = 0,3 mm/rev: r 1,2 -> 2,34 · r 0,8 -> 3,52 · r 2,0 -> 1,41.
describe('extraerRadioISO: el radio sale solo de los dígitos de radio del tipo ISO', () => {
  it('CNMA120412 KCK20 -> 1,2 (antes tomaba el "20" de la calidad y daba 2,0)', () => {
    expect(extraerRadioISO('CNMA120412 KCK20')).toBe(1.2);
  });

  it('CNMG120408-M3 TP2501 -> 0,8', () => {
    expect(extraerRadioISO('CNMG120408-M3 TP2501')).toBe(0.8);
  });

  it.each([
    ['CNMG120404', 0.4], ['CNMG120408', 0.8], ['CNMG120412', 1.2], ['CNMG120416', 1.6], ['TNMG160408', 0.8], ['DNMG150604', 0.4], ['SNMG190616', 1.6],
  ])('código sin sufijo %s -> %d', (codigo, radio) => { expect(extraerRadioISO(codigo)).toBe(radio); });

  it.each([
    ['CNMG120408 TP2501', 0.8],          // sin guion: antes los dígitos de la calidad pisaban el radio (daba 0,1)
    ['CNMG120408 M3', 0.8],
    ['CNMG120408 MF3 TK1001', 0.8],
    ['DNMG150608 KCK20', 0.8],
    ['CNMG120408-M3', 0.8],
    ['CNMG120408-MF5 TP0501', 0.8],
    ['CNMG120412 KCK20 KCK25', 1.2],
  ])('con rompevirutas y/o calidad: %s -> %d', (codigo, radio) => { expect(extraerRadioISO(codigo)).toBe(radio); });

  it('espesor alfanumérico (CCMT09T304, DCMT11T308-F1)', () => {
    expect(extraerRadioISO('CCMT09T304')).toBe(0.4);
    expect(extraerRadioISO('DCMT11T308-F1')).toBe(0.8);
  });

  it('tolera minúsculas, espacios alrededor y separadores entre grupos', () => {
    expect(extraerRadioISO('cnmg120408')).toBe(0.8);
    expect(extraerRadioISO('  CNMG120412  ')).toBe(1.2);
    expect(extraerRadioISO('CNMG 12 04 08')).toBe(0.8);
    expect(extraerRadioISO('CNMG-120408')).toBe(0.8);
    expect(extraerRadioISO('SECO CNMA120412 KCK20')).toBe(1.2);
  });

  it.each([
    '', 'MS2050', 'KCK20', 'R390-11T308M-PM', 'CNMG1204', 'CNMG12040', 'CNMG1204081', 'CNMG120400', '120408',
  ])('sin radio de punta reconocible (%j) -> null', (codigo) => { expect(extraerRadioISO(codigo)).toBeNull(); });
});

describe('calcularRaTeorico con el radio correcto', () => {
  it('CNMA120412 KCK20, avance 0,3 -> 2,34 µm (antes 1,41)', () => {
    expect(calcularRaTeorico(0.3, 'CNMA120412 KCK20')).toBe('2.34');
  });

  it('CNMG120408-M3 TP2501, avance 0,3 -> 3,52 µm', () => {
    expect(calcularRaTeorico(0.3, 'CNMG120408-M3 TP2501')).toBe('3.52');
  });

  it('código sin sufijo: CNMG120408, avance 0,3 -> 3,52 µm', () => {
    expect(calcularRaTeorico(0.3, 'CNMG120408')).toBe('3.52');
  });

  it('el avance puede venir como texto (así lo guarda el formulario)', () => {
    expect(calcularRaTeorico('0.3', 'CNMA120412 KCK20')).toBe('2.34');
  });

  it('sin radio reconocible o sin avance -> null (el PDF muestra N/A)', () => {
    expect(calcularRaTeorico(0.3, 'MS2050')).toBeNull();
    expect(calcularRaTeorico(0.3, 'CNMG120400')).toBeNull();
    expect(calcularRaTeorico(0, 'CNMG120408')).toBeNull();
    expect(calcularRaTeorico('', 'CNMG120408')).toBeNull();
  });

  it('plaquita wiper: se mantiene la mitad del Ra (comportamiento existente)', () => {
    expect(calcularRaTeorico(0.3, 'CNMG120408-WMX')).toBe('1.76');
  });
});

describe('auditarParametros usa el mismo radio', () => {
  it('CNMA120412 KCK20 con ap 0,5: el aviso cita el radio 1,2 (no 2,0)', () => {
    expect(auditarParametros(0.5, 0.2, 'CNMA120412 KCK20')).toMatch(/radio del inserto \(1\.2mm\)/);
  });
});
