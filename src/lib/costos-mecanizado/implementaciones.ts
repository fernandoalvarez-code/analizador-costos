// Ahorro logrado: cuánto bajó de verdad el costo de la pieza desde su línea base. Funciones puras, sin tocar las fórmulas de costo.
import type { Implementacion, Pieza, ResultadoPieza } from './types';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Ahorro logrado de la pieza, en USD/año, a nivel PIEZA (no se atribuye a cada mejora):
 *   (costoPiezaBase − costo actual por pieza) × volumen anual ACTUAL
 * Se usa el volumen actual para que un cambio de volumen no se cuente como ahorro. Sin línea base: 0 (no se mide). Puede ser negativo: se
 * devuelve tal cual, nunca se recorta. El costo actual es el de mecanizado por pieza SIN material, el mismo que usa el resumen.
 */
export function logradoTotalAnual(pieza: Pick<Pieza, 'lineaBase'>, resultado: Pick<ResultadoPieza, 'costoPieza' | 'volumenAnual'>): number {
  if (!pieza.lineaBase) return 0;
  return (num(pieza.lineaBase.costoPiezaBase) - num(resultado.costoPieza)) * num(resultado.volumenAnual);
}

/** La implementación más reciente por `registradaEn` (ISO); null si no hay. */
export function ultimaImplementacion(pieza: Pick<Pieza, 'implementaciones'>): Implementacion | null {
  let ultima: Implementacion | null = null;
  for (const im of pieza.implementaciones ?? []) {
    if (!ultima || Date.parse(im.registradaEn) >= Date.parse(ultima.registradaEn)) ultima = im;
  }
  return ultima;
}
