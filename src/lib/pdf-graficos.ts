/**
 * Lógica pura de la hoja "Análisis Gráfico" del PDF (curva de costos + vida del filo). Sin React, para poder probarla.
 * No recalcula nada del informe: solo recorta el rango del eje X y da formato a números que ya existen.
 */

/** Ventana del eje X en el PDF: del 60 % de la menor Vc al 160 % de la mayor (el entorno de trabajo, no hasta 370 m/min). */
export const PDF_WINDOW_MIN_FACTOR = 0.6;
export const PDF_WINDOW_MAX_FACTOR = 1.6;

export function pdfWindow(vcActual: number, vcPremium: number): { min: number; max: number } | null {
  if (!(vcActual > 0) || !(vcPremium > 0) || !Number.isFinite(vcActual) || !Number.isFinite(vcPremium)) return null;
  return { min: PDF_WINDOW_MIN_FACTOR * Math.min(vcActual, vcPremium), max: PDF_WINDOW_MAX_FACTOR * Math.max(vcActual, vcPremium) };
}

/** Recorta los puntos al entorno de trabajo. Si falta alguna de las dos Vc no hay ventana que centrar: se devuelve todo. */
export function windowPdfData<T extends { speed: number }>(data: T[], vcActual: number, vcPremium: number): T[] {
  const w = pdfWindow(vcActual, vcPremium);
  if (!w) return data;
  return data.filter((d) => d.speed >= w.min && d.speed <= w.max);
}

/** Variación porcentual de `from` a `to` ((to − from) / from · 100). null si no es calculable. */
export function percentVariation(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return ((to - from) / from) * 100;
}

/** -30,8 -> "-30.8%"; 50 -> "+50.0%". Mismo formato que el "-30.8%" de la página 1. */
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ── Ejes con valores redondos ─────────────────────────────────────────────────────────────────

/** Menor "paso agradable" (1, 2, 2,5, 5 × 10ⁿ) que deja a lo sumo `maxTicks` marcas en [min, max]. */
export function niceStep(min: number, max: number, maxTicks: number): number {
  const range = Math.max(max - min, Number.EPSILON);
  const rough = range / Math.max(maxTicks, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= rough) return m * pow;
  return 10 * pow;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Eje X de Vc: domain redondeado a múltiplos del paso y marcas en esos múltiplos. */
export function xAxisFor(min: number, max: number, maxTicks = 7): { domain: [number, number]; ticks: number[] } {
  const step = Math.max(niceStep(min, max, maxTicks), 1);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(round6(v));
  return { domain: [lo, hi], ticks };
}

/**
 * Eje Y a partir de los datos. `zeroBased` (vida del filo) arranca en 0; el de costos se acerca a los datos para que
 * la curva ocupe el gráfico en vez de quedar aplastada arriba. `headroom` deja aire arriba para etiquetas y leyenda.
 */
export function yAxisFor(values: number[], opts: { zeroBased?: boolean; headroom?: number; maxTicks?: number } = {}): { domain: [number, number]; ticks: number[]; step: number } {
  const { zeroBased = false, headroom = 0.12, maxTicks = 5 } = opts;
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { domain: [0, 1], ticks: [0, 1], step: 1 };
  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const range = Math.max(dataMax - dataMin, Math.abs(dataMax) * 0.05, 1e-9);
  const lowRaw = zeroBased ? 0 : Math.max(0, dataMin - range * 0.1);
  const highRaw = dataMax + range * headroom;
  const step = niceStep(lowRaw, highRaw, maxTicks);
  const lo = zeroBased ? 0 : Math.max(0, Math.floor(lowRaw / step) * step);
  const hi = Math.ceil(highRaw / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(round6(v));
  return { domain: [round6(lo), round6(hi)], ticks, step };
}

/** Vida del filo para etiquetas y franjas: enteros cuando es grande (20, 30), un decimal cuando es chica (0,8). */
export function formatLife(value: number): string {
  if (!Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0';
  if (Math.abs(value) >= 10) return String(Math.round(value));
  return value.toFixed(1).replace('.', ',');
}

/**
 * Recorta un texto largo (p. ej. un nombre de herramienta de 250 caracteres) para que una celda del PDF no crezca sin
 * límite y empuje el pie fuera de la hoja A4. `html2canvas` no soporta `line-clamp`, por eso se recorta el texto.
 */
export function truncateForPdf(text: string, max = 90): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
