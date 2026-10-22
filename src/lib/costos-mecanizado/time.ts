// Tiempos: se guardan en minutos (decimal) y se cargan/muestran en mm:ss.

/** 1,5 -> "1:30" · 0,45 -> "0:27". Valores negativos o no numéricos -> "0:00". */
export function toMmss(min: number): string {
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0) return '0:00';
  const total = Math.round(min * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const MMSS = /^(\d+):(\d+(?:[.,]\d+)?)$/;
const NUMERO = /^\d+(?:[.,]\d+)?$/;

/**
 * Texto a minutos. "1:30" = 1,5 · "0:27" = 0,45 · "5" = 5 · "1,5" = 1,5 (acepta coma decimal).
 * Cualquier entrada inválida (vacía, texto, negativa, con más de un ":") da 0.
 */
export function parseMmss(text: string): number {
  if (typeof text !== 'string') return 0;
  const t = text.trim();
  const conSegundos = MMSS.exec(t);
  if (conSegundos) {
    const min = Number(conSegundos[1]);
    const seg = Number(conSegundos[2].replace(',', '.'));
    const r = min + seg / 60;
    return Number.isFinite(r) ? r : 0;
  }
  if (NUMERO.test(t)) {
    const r = Number(t.replace(',', '.'));
    return Number.isFinite(r) ? r : 0;
  }
  return 0;
}
