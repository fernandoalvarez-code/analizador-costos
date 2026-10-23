// Formato de números para el módulo de costos: punto de miles y coma decimal, sin depender de la configuración regional del
// navegador ni de Node (así los tests dan lo mismo en cualquier máquina).

function conMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 9.357 con 4 decimales -> "9,3570"; 233925.59 con 0 -> "233.926". Valores no finitos -> "0". */
export function numero(n: number, decimales: number): string {
  if (!Number.isFinite(n)) return '0'.concat(decimales > 0 ? ',' + '0'.repeat(decimales) : '');
  const signo = n < 0 && Math.abs(n) >= 0.5 * 10 ** -decimales ? '−' : '';
  const [entero, dec] = Math.abs(n).toFixed(decimales).split('.');
  return `${signo}${conMiles(entero)}${dec ? ',' + dec : ''}`;
}

export const usd0 = (n: number) => `USD ${numero(n, 0)}`;
export const usd2 = (n: number) => `USD ${numero(n, 2)}`;
export const usd3 = (n: number) => `USD ${numero(n, 3)}`;
/** USD por pieza a nivel de pieza (4 decimales, como el caso de control del SPEC: 9,3570). */
export const usd4 = (n: number) => `USD ${numero(n, 4)}`;
/** Porcentaje a partir de una fracción: 0,5316 -> "53 %". */
export const porcentaje0 = (fraccion: number) => `${numero(fraccion * 100, 0)} %`;
export const porcentaje1 = (valorPct: number) => `${numero(valorPct, 1)} %`;
/** Con signo explícito: +0,123 / −0,123. */
export const conSigno = (n: number, decimales: number) => `${n < 0 ? '−' : '+'}${numero(Math.abs(n), decimales)}`;
