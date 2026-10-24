import { describe, expect, it } from 'vitest';
import { nombreOperacion, resumenDesactualizado } from '@/components/costos/planta-utils';
import { PIEZA_A } from '@/components/costos/planta-datos-prueba';

// Los números de versión están escritos a mano: el resumen "de la versión anterior" tiene calcVersion 1 y el actual es el 3 (2: opMayorCostoNombre; 3: el ahorro potencial cuenta solo las mejoras activas).
describe('resumenDesactualizado', () => {
  it('un resumen con calcVersion 1 (anterior a opMayorCostoNombre) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 1, reglasVersion: 0 } };
    expect(resumenDesactualizado(f, 0)).toBe(true);
  });
  it('un resumen con calcVersion 2 (anterior a las mejoras descartadas) está desactualizado aunque las reglas coincidan', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 2, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(true);
  });
  it('un resumen con calcVersion 3 y las mismas reglas está al día', () => {
    const f = { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 3, reglasVersion: 500 } };
    expect(resumenDesactualizado(f, 500)).toBe(false);
  });
  it('otra versión de reglas, o un resumen que falta, también cuentan como desactualizado', () => {
    expect(resumenDesactualizado({ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 3, reglasVersion: 100 } }, 500)).toBe(true);
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
