// Filtros, orden y paginación de la tabla de piezas: se aplican sobre los resúmenes ya cargados en memoria.
import type { FilaPieza } from '@/lib/costos-mecanizado/firestore';
import { CALC_VERSION, ETIQUETA_RUBRO, type Rubro } from '@/lib/costos-mecanizado/types';

export const PIEZAS_POR_PAGINA = 15;

export type ColumnaOrden = 'codigo' | 'nombre' | 'costoPieza' | 'costoAnual' | 'minutosPieza' | 'opMayorCosto' | 'rubroPrincipal' | 'ahorro';
export type Sentido = 'asc' | 'desc';

export interface Filtros {
  texto: string;
  maquinaId: string;
  rubro: '' | Rubro;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un resumen está desactualizado si se calculó con otras reglas de mejoras o con otra versión de las fórmulas. */
export function resumenDesactualizado(f: FilaPieza, reglasVersion: number): boolean {
  const r = f.resumen;
  return !r || r.reglasVersion !== reglasVersion || r.calcVersion !== CALC_VERSION;
}

/**
 * El resumen guarda el id de la operación de mayor costo, no su nombre. Las del seed y las de la forma "op20" se muestran como "Op 20";
 * las ids generadas por la pantalla de carga no dicen su posición, así que se muestran como "—".
 */
export function etiquetaOperacion(opId: string | undefined | null): string {
  const m = /^op(\d+)$/i.exec(opId ?? '');
  return m ? `Op ${m[1]}` : '—';
}

export function etiquetaRubro(r: Rubro | null | undefined): string {
  return r ? ETIQUETA_RUBRO[r] : '—';
}

export function filtrarPiezas(filas: FilaPieza[], f: Filtros): FilaPieza[] {
  const q = norm(f.texto.trim());
  return filas.filter((p) => {
    if (q && !norm(`${p.codigo} ${p.nombre}`).includes(q)) return false;
    if (f.maquinaId && !(p.resumen?.maquinaIds ?? []).includes(f.maquinaId)) return false;
    if (f.rubro && p.resumen?.rubroPrincipal !== f.rubro) return false;
    return true;
  });
}

const valorTexto: Partial<Record<ColumnaOrden, (p: FilaPieza) => string>> = {
  codigo: (p) => p.codigo,
  nombre: (p) => p.nombre,
  opMayorCosto: (p) => p.resumen?.opMayorCosto ?? '',
  rubroPrincipal: (p) => etiquetaRubro(p.resumen?.rubroPrincipal),
};
const valorNumero: Partial<Record<ColumnaOrden, (p: FilaPieza) => number>> = {
  costoPieza: (p) => num(p.resumen?.costoPieza),
  costoAnual: (p) => num(p.resumen?.costoAnual),
  minutosPieza: (p) => num(p.resumen?.minutosPieza),
  ahorro: (p) => num(p.resumen?.ahorroPotencialAnual),
};

/** Orden por una columna (estable: a igualdad desempata por código). Números como números; textos en español, con números naturales. */
export function ordenarPiezas(filas: FilaPieza[], columna: ColumnaOrden, sentido: Sentido): FilaPieza[] {
  const signo = sentido === 'asc' ? 1 : -1;
  const porTexto = valorTexto[columna];
  const porNumero = valorNumero[columna];
  const cmpCodigo = (a: FilaPieza, b: FilaPieza) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
  return [...filas].sort((a, b) => {
    const c = porTexto
      ? porTexto(a).localeCompare(porTexto(b), 'es', { numeric: true, sensitivity: 'base' })
      : (porNumero?.(a) ?? 0) - (porNumero?.(b) ?? 0);
    return c !== 0 ? signo * c : cmpCodigo(a, b);
  });
}

export function paginar<T>(items: T[], pagina: number, tamano = PIEZAS_POR_PAGINA): { items: T[]; total: number; paginas: number; pagina: number } {
  const paginas = Math.max(1, Math.ceil(items.length / tamano));
  const p = Math.min(Math.max(0, pagina), paginas - 1);
  return { items: items.slice(p * tamano, (p + 1) * tamano), total: items.length, paginas, pagina: p };
}
