import { describe, expect, it } from 'vitest';
import { nombreOperacion, resumenDesactualizado, tableroMejoras } from '@/components/costos/planta-utils';
import { PIEZA_A, PIEZA_B, PIEZA_C } from '@/components/costos/planta-datos-prueba';

// Los números de versión están escritos a mano: el resumen "de la versión anterior" tiene calcVersion 1 y el actual es el 4 (2: opMayorCostoNombre; 3: el ahorro potencial cuenta solo las mejoras activas; 4: logradoAnual y cantImplementadas).
describe('resumenDesactualizado', () => {
  it('un resumen con calcVersion 1 (anterior a opMayorCostoNombre) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 1, reglasVersion: 0 } };
    expect(resumenDesactualizado(f, 0)).toBe(true);
  });
  it('un resumen con calcVersion 2 (anterior a las mejoras descartadas) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 2, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(true);
  });
  it('un resumen con calcVersion 3 (anterior a las mejoras implementadas) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 3, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(true);
  });
  it('un resumen con calcVersion 4 y las mismas reglas está al día', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 4, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(false);
  });
  it('otra versión de reglas, o un resumen que falta, también cuentan como desactualizado', () => {
    expect(resumenDesactualizado({ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 4, reglasVersion: 100 } }, 500)).toBe(true);
    expect(resumenDesactualizado({ ...PIEZA_A, resumen: undefined as never }, 0)).toBe(true);
  });
});

describe('nombreOperacion', () => {
  it('usa el nombre guardado', () => { expect(nombreOperacion({ opMayorCosto: 'op20', opMayorCostoNombre: 'Desbaste y contorno' })).toBe('Desbaste y contorno'); });
  it('sin el campo (resumen anterior): el id como respaldo', () => { expect(nombreOperacion({ opMayorCosto: 'op20' })).toBe('op20'); });
  it('nombre vacío (pieza sin operaciones) o sin resumen: "—"', () => {
    expect(nombreOperacion({ opMayorCosto: '', opMayorCostoNombre: '' })).toBe('—');
    expect(nombreOperacion({ opMayorCosto: 'op20', opMayorCostoNombre: '  ' })).toBe('—');
    expect(nombreOperacion(undefined)).toBe('—');
  });
});

describe('tableroMejoras (mejoras realizadas vs potencial)', () => {
  const con = (f: typeof PIEZA_A, parcial: Record<string, number>) => ({ ...f, resumen: { ...f.resumen, ...parcial } });
  it('suma logrado y pendiente de las piezas con resumen vigente, sin las desactualizadas', () => {
    // A: logrado 1.000 · pendiente 2.000 · 1 implementada | B: logrado −300 · pendiente 500 · 2 implementadas | C: calcVersion 3 → excluida
    const filas = [
      con(PIEZA_A, { logradoAnual: 1000, ahorroPotencialAnual: 2000, cantImplementadas: 1 }),
      con(PIEZA_B, { logradoAnual: -300, ahorroPotencialAnual: 500, cantImplementadas: 2 }),
      con(PIEZA_C, { logradoAnual: 999, ahorroPotencialAnual: 999, cantImplementadas: 9, calcVersion: 3 }),
    ];
    const t = tableroMejoras(filas, 0);
    expect(t.logrado).toBe(700);
    expect(t.pendiente).toBe(2500);
    expect(t.potencialTotal).toBe(3200);
    expect(t.fraccionLograda).toBeCloseTo(0.21875, 9); // 700 / 3.200
    expect(t.cantImplementadas).toBe(3);
    expect(t.excluidas).toBe(1);
  });
  it('un resumen con otra versión de reglas también se excluye', () => {
    const filas = [con(PIEZA_A, { logradoAnual: 1000, ahorroPotencialAnual: 2000, reglasVersion: 100 })];
    expect(tableroMejoras(filas, 500)).toMatchObject({ logrado: 0, pendiente: 0, excluidas: 1 });
  });
  it('sin potencial la fracción es 0; un logrado negativo se conserva negativo', () => {
    expect(tableroMejoras([], 0)).toMatchObject({ logrado: 0, pendiente: 0, potencialTotal: 0, fraccionLograda: 0, excluidas: 0 });
    const t = tableroMejoras([con(PIEZA_A, { logradoAnual: -500, ahorroPotencialAnual: 0 })], 0);
    expect(t.logrado).toBe(-500);
    expect(t.fraccionLograda).toBe(0);
  });
  it('un resumen viejo sin los campos nuevos no rompe la suma (cuenta como 0)', () => {
    const viejo = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen } as Record<string, unknown> };
    delete viejo.resumen.logradoAnual; delete viejo.resumen.cantImplementadas;
    expect(tableroMejoras([viejo as never], 0)).toMatchObject({ logrado: 0, pendiente: 2000, cantImplementadas: 0 });
  });
});
