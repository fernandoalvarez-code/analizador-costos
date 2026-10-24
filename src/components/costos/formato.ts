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
/**
 * REGLA ÚNICA de formato de importes del módulo de costos (solo al MOSTRAR: el cálculo nunca se redondea):
 *  - Importe por pieza (USD/pza): 2 decimales con redondeo decimal estable (`usdPza`: "USD 1,51"; `numeroPza` para celdas sin unidad).
 *    Mayor que 0 y menor que 0,005 → "<USD 0,01"; exactamente 0 → "USD 0,00".
 *  - Diferencias por pieza: signo delante del prefijo y unidad siempre igual (`deltaPza`: "−USD 0,29/pza", "+USD 0,05/pza").
 *  - Importes y ahorros ANUALES: enteros (`usd0`: "USD 5.708/año").
 *  - Precios y precios máximos (inserto, "Precio máximo"): 2 decimales (`usd2`).
 *  - Porcentajes, tiempos (mm:ss) y demás: sin cambios.
 *  - Unidad SIEMPRE en el mismo orden: prefijo "USD " delante del número y sufijo "/pza" o "/año" cuando corresponda.
 *  - DETALLE EXACTO: cada importe por pieza redondeado lleva title="USD 1,5077 exacto" (`exactoPza`; `conExacto` lo anexa a un tooltip existente).
 */
export { TOLERANCIA_IGUAL, conExacto, deltaPza, exactoPza, numeroPza, redondear, usdPza } from '@/lib/costos-mecanizado/importes';
/** Porcentaje a partir de una fracción: 0,5316 -> "53 %". */
export const porcentaje0 = (fraccion: number) => `${numero(fraccion * 100, 0)} %`;
export const porcentaje1 = (valorPct: number) => `${numero(valorPct, 1)} %`;
