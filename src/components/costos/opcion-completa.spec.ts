import { describe, expect, it } from 'vitest';
import { opcionSinCompletar } from '@/components/costos/opcion-completa';
import { opcionNueva } from '@/components/costos/validar-pieza';

describe('opcionSinCompletar (una opción agregada con "+ Opción" no sirve para comparar)', () => {
  const completa = { nombre: 'Broca refrig. interna', precio: 200, cortePorPiezaMin: 0.36 };
  it('una opción completa no está sin completar', () => { expect(opcionSinCompletar(completa)).toBe(false); });
  it('precio 0, corte 0:00 o nombre por defecto la marcan', () => {
    expect(opcionSinCompletar({ ...completa, precio: 0 })).toBe(true);
    expect(opcionSinCompletar({ ...completa, cortePorPiezaMin: 0 })).toBe(true);
    expect(opcionSinCompletar({ ...completa, nombre: 'Alternativa 1' })).toBe(true);
    expect(opcionSinCompletar({ ...completa, nombre: 'Alternativa 12' })).toBe(true);
    expect(opcionSinCompletar({ ...completa, nombre: ' Herramienta ' })).toBe(true);
  });
  it('un nombre que solo empieza parecido no cuenta como por defecto', () => {
    expect(opcionSinCompletar({ ...completa, nombre: 'Herramienta de corte Ø12' })).toBe(false);
    expect(opcionSinCompletar({ ...completa, nombre: 'Alternativa económica' })).toBe(false);
  });
  it('valores no numéricos (campo vacío) también cuentan como sin completar', () => {
    expect(opcionSinCompletar({ ...completa, precio: NaN })).toBe(true);
    expect(opcionSinCompletar({ ...completa, cortePorPiezaMin: NaN })).toBe(true);
  });
  it('una opción recién creada con opcionNueva está sin completar', () => {
    expect(opcionSinCompletar(opcionNueva())).toBe(true);
    expect(opcionSinCompletar(opcionNueva('Alternativa 1'))).toBe(true);
  });
});
