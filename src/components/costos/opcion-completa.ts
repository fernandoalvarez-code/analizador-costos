import type { OpcionHerramienta } from '@/lib/costos-mecanizado/types';

/** Nombres con los que nace una opción nueva (herramienta o alternativa) y que el usuario todavía no editó. */
const NOMBRE_POR_DEFECTO = /^(Herramienta|Alternativa \d+)$/;

/**
 * Una opción agregada con "+ Opción" nace con precio 0, corte 0:00 y un nombre por defecto. Mientras falte alguno de esos datos está
 * SIN COMPLETAR y no sirve para comparar (el costo cero y el "ahorro" que daría serían falsos).
 */
export function opcionSinCompletar(o: Pick<OpcionHerramienta, 'nombre' | 'precio' | 'cortePorPiezaMin'>): boolean {
  return !(o.precio > 0) || !(o.cortePorPiezaMin > 0) || NOMBRE_POR_DEFECTO.test((o.nombre ?? '').trim());
}

export const MENSAJE_COMPLETAR = 'Completá los datos para comparar';
