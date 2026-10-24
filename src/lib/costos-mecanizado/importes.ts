// Formato de importes del módulo de costos (solo para MOSTRAR: el cálculo nunca se redondea). La regla única está documentada en
// src/components/costos/formato.ts, que re-exporta estas funciones.

/** Tolerancia numérica con la que una diferencia por pieza se muestra como "igual" / "—" (por debajo de esto es ruido de cálculo, no un cambio). */
export const TOLERANCIA_IGUAL = 0.00005;

/**
 * Redondeo DECIMAL estable (mitad hacia arriba en valor absoluto), sin depender de la representación binaria: 1,005 → 1,01 y 12,075 → 12,08, donde
 * toFixed(2) da 1,00 y 12,07. Usa la notación exponencial de texto ("1.005e2" → 100,5 exacto) en lugar de multiplicar flotantes.
 */
export function redondear(n: number, decimales: number): number {
  if (!Number.isFinite(n)) return 0;
  const abs = Math.abs(n);
  const texto = String(abs);
  // Notación científica (muy chicos o muy grandes): ahí el error binario no cambia el resultado a 2 decimales; se usa toFixed.
  const r = texto.includes('e') ? Number(abs.toFixed(decimales)) : Number(`${Math.round(Number(`${texto}e${decimales}`))}e-${decimales}`);
  return n < 0 ? -r : r;
}

function conMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
/** Número con punto de miles y coma decimal, sin signo; `valor` ya viene redondeado. */
function texto(valor: number, decimales: number): string {
  const [entero, dec] = Math.abs(valor).toFixed(decimales).split('.');
  return `${conMiles(entero)}${dec ? ',' + dec : ''}`;
}

const MENOS = '−';

/** Importe POR PIEZA sin unidad ("1,51"; "<0,01" si es mayor que 0 y menor que 0,005; "0,00" si es 0). Para celdas de tablas cuya cabecera ya dice USD. */
export function numeroPza(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0,00';
  const r = redondear(n, 2);
  if (r === 0) return `${n < 0 ? MENOS : ''}<0,01`;
  return `${r < 0 ? MENOS : ''}${texto(r, 2)}`;
}

/** Importe POR PIEZA con unidad delante: "USD 1,51"; "<USD 0,01" (0 < n < 0,005); "USD 0,00" (n = 0). Un valor negativo lleva el signo delante: "−USD 0,29". */
export function usdPza(n: number): string {
  if (!Number.isFinite(n) || n === 0) return 'USD 0,00';
  const r = redondear(n, 2);
  if (r === 0) return `${n < 0 ? MENOS : ''}<USD 0,01`;
  return `${r < 0 ? MENOS : ''}USD ${texto(r, 2)}`;
}

/** Diferencia POR PIEZA con signo delante del prefijo y la unidad siempre igual: "−USD 0,29/pza", "+USD 0,05/pza"; si se vería 0,00 pero no es 0: "<USD 0,01/pza" o "−<USD 0,01/pza". */
export function deltaPza(n: number): string {
  if (!Number.isFinite(n) || n === 0) return 'USD 0,00/pza';
  const r = redondear(n, 2);
  if (r === 0) return `${n < 0 ? MENOS : ''}<USD 0,01/pza`;
  return `${r < 0 ? MENOS : '+'}USD ${texto(r, 2)}/pza`;
}

/** Valor exacto con 4 decimales para el tooltip (atributo title) de un importe por pieza redondeado: "USD 1,5077 exacto". */
export function exactoPza(n: number): string {
  if (!Number.isFinite(n)) return 'USD 0,0000 exacto';
  return `${n < 0 && Math.abs(n) >= 0.00005 ? MENOS : ''}USD ${texto(n, 4)} exacto`;
}

/** Agrega el valor exacto al final de un tooltip que ya existe, sin pisarlo: "Corte: USD 0,41 · USD 0,4096 exacto". */
export function conExacto(tooltip: string, n: number): string {
  return `${tooltip} · ${exactoPza(n)}`;
}
