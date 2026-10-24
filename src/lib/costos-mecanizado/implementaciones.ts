// Mejoras implementadas: cuánto bajó de verdad el costo de la pieza desde que se registró cada una. Funciones puras, sin tocar las fórmulas de costo.
import type { Pieza, ResultadoPieza } from './types';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Logro de cada implementación, en USD/año, en el orden del array `pieza.implementaciones`:
 *   logro_i = (costoPiezaAntes_i − costoPiezaAntes_{i+1}) × volumenAnual
 *   la última: (costoPiezaAntes_last − costo actual) × volumenAnual
 * Se usa el volumen ACTUAL de la pieza para que un cambio de volumen no se cuente como ahorro. Puede dar cero o negativo: se devuelve
 * tal cual, nunca se recorta. `costo actual` = costo de mecanizado por pieza SIN material, el mismo que usa el resumen.
 */
export function logroPorImplementacion(pieza: Pick<Pieza, 'implementaciones'>, resultado: Pick<ResultadoPieza, 'costoPieza' | 'volumenAnual'>): number[] {
  const lista = pieza.implementaciones ?? [];
  const volumen = num(resultado.volumenAnual);
  return lista.map((impl, i) => {
    const siguiente = i + 1 < lista.length ? num(lista[i + 1].costoPiezaAntes) : num(resultado.costoPieza);
    return (num(impl.costoPiezaAntes) - siguiente) * volumen;
  });
}

/** Suma de los logros = (costoPiezaAntes de la primera − costo actual) × volumen actual. 0 si no hay implementaciones. */
export function logradoTotalAnual(pieza: Pick<Pieza, 'implementaciones'>, resultado: Pick<ResultadoPieza, 'costoPieza' | 'volumenAnual'>): number {
  const lista = pieza.implementaciones ?? [];
  if (lista.length === 0) return 0;
  return (num(lista[0].costoPiezaAntes) - num(resultado.costoPieza)) * num(resultado.volumenAnual);
}
