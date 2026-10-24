// Filtros, orden y paginación de la tabla de piezas: se aplican sobre los resúmenes ya cargados en memoria.
import type { FilaPieza } from '@/lib/costos-mecanizado/firestore';
import { CALC_VERSION, ETIQUETA_RUBRO, type ResumenPieza, type Rubro } from '@/lib/costos-mecanizado/types';

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

export interface TableroMejoras {
  /** Suma de resumen.logradoAnual de las piezas CON línea base y resumen vigente (USD/año). */
  logrado: number;
  /** Suma de ahorroPotencialAnual (solo mejoras activas) de las piezas con resumen vigente. */
  pendiente: number;
  /** logrado + pendiente. */
  potencialTotal: number;
  /** logrado / potencialTotal como fracción 0–1 (0 si no hay potencial). */
  fraccionLograda: number;
  cantImplementadas: number;
  /** Piezas con resumen vigente pero SIN línea base: no suman al logrado. */
  sinLineaBase: number;
  /** Piezas con el resumen desactualizado: quedan FUERA de las sumas. */
  excluidas: number;
  /** La mejora más reciente de la planta (por fecha de registro), con la pieza; null si ninguna pieza tiene mejoras registradas. */
  ultimaMejora: { fecha: string; por: string; codigo: string } | null;
}

/**
 * "Mejoras realizadas vs potencial" de la planta. Un resumen desactualizado (otras reglas o versión de fórmulas) no se suma: no trae los campos
 * nuevos ni cuenta el ahorro igual que los vigentes. Una pieza sin línea base no suma al logrado. El logrado puede ser negativo (se muestra tal cual).
 */
export function tableroMejoras(filas: FilaPieza[], reglasVersion: number): TableroMejoras {
  let logrado = 0;
  let pendiente = 0;
  let cantImplementadas = 0;
  let sinLineaBase = 0;
  let excluidas = 0;
  let ultimaMejora: TableroMejoras['ultimaMejora'] = null;
  for (const f of filas) {
    const r = f.resumen;
    if (r && typeof r.ultimaMejoraFecha === 'string' && (!ultimaMejora || Date.parse(r.ultimaMejoraFecha) > Date.parse(ultimaMejora.fecha))) {
      ultimaMejora = { fecha: r.ultimaMejoraFecha, por: r.ultimaMejoraPor ?? '', codigo: f.codigo };
    }
    if (!r || resumenDesactualizado(f, reglasVersion)) { excluidas += 1; continue; }
    pendiente += num(r.ahorroPotencialAnual);
    cantImplementadas += num(r.cantImplementadas);
    if (r.tieneLineaBase === true) logrado += num(r.logradoAnual); else sinLineaBase += 1;
  }
  const potencialTotal = logrado + pendiente;
  return {
    logrado, pendiente, potencialTotal, fraccionLograda: potencialTotal > 0 ? Math.min(1, Math.max(0, logrado / potencialTotal)) : 0,
    cantImplementadas, sinLineaBase, excluidas, ultimaMejora,
  };
}

/**
 * Operación de mayor costo, tal como se muestra: el NOMBRE guardado en el resumen ("" si la pieza no tiene operaciones, que se muestra
 * "—"). Los resúmenes anteriores a ese campo no lo tienen: se usa el id como respaldo hasta que se recalculen.
 */
export function nombreOperacion(resumen: Pick<ResumenPieza, 'opMayorCosto'> & Partial<Pick<ResumenPieza, 'opMayorCostoNombre'>> | undefined | null): string {
  if (!resumen) return '—';
  const texto = typeof resumen.opMayorCostoNombre === 'string' ? resumen.opMayorCostoNombre : resumen.opMayorCosto;
  return texto && texto.trim() !== '' ? texto : '—';
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
  opMayorCosto: (p) => (p.resumen ? nombreOperacion(p.resumen) : ''),
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
