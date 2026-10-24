import { describe, expect, it } from 'vitest';
import { nombreOperacion, resumenDesactualizado, tableroMejoras } from '@/components/costos/planta-utils';
import { PIEZA_A, PIEZA_B, PIEZA_C } from '@/components/costos/planta-datos-prueba';

// Los números de versión están escritos a mano: el resumen "de la versión anterior" tiene calcVersion 1 y el actual es el 6 (2: opMayorCostoNombre; 3: el ahorro potencial cuenta solo las mejoras activas; 4: logradoAnual y cantImplementadas; 5: línea base; 6: descartadoAnual).
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
  it('un resumen con calcVersion 4 (anterior a la línea base) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 4, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(true);
  });
  it('un resumen con calcVersion 5 (anterior a descartadoAnual) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 5, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(true);
  });
  it('un resumen con calcVersion 6 y las mismas reglas está al día', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 6, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(false);
  });
  it('otra versión de reglas, o un resumen que falta, también cuentan como desactualizado', () => {
    expect(resumenDesactualizado({ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 6, reglasVersion: 100 } }, 500)).toBe(true);
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
  const con = (f: typeof PIEZA_A, parcial: Record<string, unknown>) => ({ ...f, resumen: { ...f.resumen, ...parcial } });
  it('suma el logrado SOLO de piezas con línea base y resumen vigente; el pendiente de todas las vigentes; cuenta las sin línea base y las excluidas', () => {
    // A: con línea base, logrado 1.000 · pendiente 2.000 · 1 implementada | B: con línea base, logrado −300 · pendiente 500 · 2 implementadas
    // C: SIN línea base (logradoAnual 0), pendiente 100 | D: calcVersion 4 → excluida (no suma nada)
    const filas = [
      con(PIEZA_A, { logradoAnual: 1000, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 1 }),
      con(PIEZA_B, { logradoAnual: -300, tieneLineaBase: true, ahorroPotencialAnual: 500, cantImplementadas: 2 }),
      con(PIEZA_C, { logradoAnual: 0, tieneLineaBase: false, ahorroPotencialAnual: 100, cantImplementadas: 0 }),
      { ...PIEZA_C, id: 'd', codigo: 'D-004', resumen: { ...PIEZA_C.resumen, logradoAnual: 999, tieneLineaBase: true, ahorroPotencialAnual: 999, cantImplementadas: 9, calcVersion: 4 } },
    ];
    const t = tableroMejoras(filas, 0);
    expect(t.logrado).toBe(700);
    expect(t.pendiente).toBe(2600);
    expect(t.potencialTotal).toBe(3300);
    expect(t.fraccionLograda).toBeCloseTo(700 / 3300, 9);
    expect(t.cantImplementadas).toBe(3);
    expect(t.sinLineaBase).toBe(1);
    expect(t.excluidas).toBe(1);
  });
  it('una pieza sin línea base no suma al logrado aunque su resumen traiga un número', () => {
    const t = tableroMejoras([con(PIEZA_A, { logradoAnual: 5000, tieneLineaBase: false, ahorroPotencialAnual: 2000 })], 0);
    expect(t.logrado).toBe(0);
    expect(t.pendiente).toBe(2000);
    expect(t.sinLineaBase).toBe(1);
  });
  it('la última mejora de la planta es la más reciente entre todas las piezas, con su autor y el código de la pieza', () => {
    const filas = [
      con(PIEZA_A, { ultimaMejoraFecha: '2026-10-20T12:00:00.000Z', ultimaMejoraPor: 'ana@secocut.com' }),
      con(PIEZA_B, { ultimaMejoraFecha: '2026-10-25T12:00:00.000Z', ultimaMejoraPor: 'luis@secocut.com' }),
      PIEZA_C,
    ];
    expect(tableroMejoras(filas, 0).ultimaMejora).toEqual({ fecha: '2026-10-25T12:00:00.000Z', por: 'luis@secocut.com', codigo: 'B-002' });
    expect(tableroMejoras([PIEZA_C], 0).ultimaMejora).toBeNull();
  });
  it('un resumen con otra versión de reglas también se excluye', () => {
    const filas = [con(PIEZA_A, { logradoAnual: 1000, tieneLineaBase: true, ahorroPotencialAnual: 2000, reglasVersion: 100 })];
    expect(tableroMejoras(filas, 500)).toMatchObject({ logrado: 0, pendiente: 0, excluidas: 1 });
  });
  it('sin potencial la fracción es 0; un logrado negativo se conserva negativo', () => {
    expect(tableroMejoras([], 0)).toMatchObject({ logrado: 0, pendiente: 0, potencialTotal: 0, fraccionLograda: 0, excluidas: 0, sinLineaBase: 0, ultimaMejora: null });
    const t = tableroMejoras([con(PIEZA_A, { logradoAnual: -500, tieneLineaBase: true, ahorroPotencialAnual: 0 })], 0);
    expect(t.logrado).toBe(-500);
    expect(t.fraccionLograda).toBe(0);
  });
  it('un resumen viejo sin los campos nuevos no rompe la suma (cuenta como sin línea base)', () => {
    const viejo = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen } as Record<string, unknown> };
    delete viejo.resumen.logradoAnual; delete viejo.resumen.tieneLineaBase; delete viejo.resumen.cantImplementadas;
    expect(tableroMejoras([viejo as never], 0)).toMatchObject({ logrado: 0, pendiente: 2000, cantImplementadas: 0, sinLineaBase: 1 });
  });
  it('descartado: suma descartadoAnual SOLO de las piezas con resumen vigente (no de las desactualizadas) y no entra en pendiente ni potencial total', () => {
    const filas = [
      con(PIEZA_A, { descartadoAnual: 12000, ahorroPotencialAnual: 2000 }),
      con(PIEZA_B, { descartadoAnual: 500, ahorroPotencialAnual: 500 }),
      { ...PIEZA_C, id: 'd', codigo: 'D-004', resumen: { ...PIEZA_C.resumen, descartadoAnual: 99999, ahorroPotencialAnual: 100, calcVersion: 5 } }, // desactualizada
    ];
    const t = tableroMejoras(filas, 0);
    expect(t.descartado).toBe(12500);
    expect(t.pendiente).toBe(2500);
    expect(t.potencialTotal).toBe(2500);
  });
  it('un resumen viejo sin descartadoAnual cuenta como 0', () => {
    const viejo = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen } as Record<string, unknown> };
    delete viejo.resumen.descartadoAnual;
    expect(tableroMejoras([viejo as never], 0).descartado).toBe(0);
  });
});
