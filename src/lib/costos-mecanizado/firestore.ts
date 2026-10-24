// Capa de datos del módulo "Análisis de costos de mecanizado" (SDK cliente de Firestore). La instancia `db` se INYECTA
// (la UI pasa la de '@/firebase'), así esta capa no importa nada de Firebase App y se prueba contra el emulador.
//
// Rutas: empresas/{empresaId}/maquinas/{id} y empresas/{empresaId}/piezas/{id}. Los datos de una empresa son COMPARTIDOS entre
// todos sus usuarios. Cada máquina y pieza lleva auditoría (createdAt/createdBy/updatedAt/updatedBy) que las reglas exigen.
// empresaId y empresasAsignadas del usuario los escribe SOLO el servidor: acá nunca se escriben.
//
// Toda escritura tiene un tope de 30 s y un error visible, igual que guardar-caso.ts.
import {
  addDoc, collection, deleteDoc, deleteField, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  startAfter, updateDoc, where, writeBatch,
  type DocumentData, type Firestore, type QueryConstraint, type QueryDocumentSnapshot, type QuerySnapshot,
} from 'firebase/firestore';
import { conTimeout, TIMEOUT_ESCRITURA_MS, TimeoutError } from '@/lib/client/guardar-caso';
import { calcResumen } from './calc';
import {
  CALC_VERSION, REGLAS_POR_DEFECTO,
  type CostoHoraPorMaquina, type Empresa, type Maquina, type Pieza, type ReglasCostos, type ResumenPieza,
} from './types';

/** Piezas que se recalculan por tanda (un writeBatch). */
export const TAMANO_TANDA = 100;
export const TAMANO_PAGINA_PIEZAS = 15;

export const MENSAJE_SIN_CONFIRMAR =
  'No se pudo confirmar el guardado. Revisá los datos antes de reintentar, para no duplicarlos.';

export class MaquinaEnUsoError extends Error {
  constructor() {
    super('La máquina está en uso por al menos una pieza: no se puede eliminar.');
    this.name = 'MaquinaEnUsoError';
  }
}

export interface Auditoria {
  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}
export type MaquinaDoc = Maquina & Auditoria;
export type PiezaDoc = Pieza & Auditoria & { id: string };
export type EmpresaDoc = Empresa & { id: string; createdAt?: unknown; createdBy?: string };

export interface FilaPieza {
  id: string;
  codigo: string;
  nombre: string;
  volumenAnual: number;
  resumen: ResumenPieza;
}
export interface PaginaPiezas {
  items: FilaPieza[];
  /** Cursor para pedir la página siguiente; null si no hay más. */
  siguiente: QueryDocumentSnapshot | null;
}

export interface ResultadoRecalculo {
  recalculadas: number;
  fallidas: number;
}

export interface ContextoCalculo {
  costoHora: CostoHoraPorMaquina;
  reglas: ReglasCostos;
}

/** Quita los `undefined` (Firestore los rechaza) sin tocar valores especiales como serverTimestamp(). */
export function sinUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(sinUndefined) as unknown as T;
  if (valor !== null && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) if (v !== undefined) r[k] = sinUndefined(v);
    return r as T;
  }
  return valor;
}

const GRUPOS_REGLAS = ['productividad', 'tiemposMuertos', 'preparacion', 'herramienta', 'calidad', 'roturas'] as const;

/** Rechaza reglas con números no finitos o negativos. */
export function validarReglas(reglas: Omit<ReglasCostos, 'reglasVersion'>): void {
  for (const g of GRUPOS_REGLAS) {
    for (const [k, v] of Object.entries(reglas[g])) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`Regla inválida: ${g}.${k} debe ser un número mayor o igual a 0.`);
    }
  }
}

export interface OpcionesRepositorio {
  /** Tope de cada escritura (por defecto 30 s). */
  timeoutMs?: number;
}

export function crearRepositorioCostos(db: Firestore, uid: string, opciones: OpcionesRepositorio = {}) {
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_ESCRITURA_MS;

  /** Escritura con tope de tiempo: si no se confirma, error claro; los errores de Firestore (permission-denied…) pasan tal cual. */
  async function escribir<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await conTimeout(Promise.resolve().then(accion), timeoutMs, 'Guardado en Firestore');
    } catch (e) {
      if (e instanceof TimeoutError) throw new Error(MENSAJE_SIN_CONFIRMAR);
      throw e;
    }
  }

  const colMaquinas = (empresaId: string) => collection(db, 'empresas', empresaId, 'maquinas');
  const colPiezas = (empresaId: string) => collection(db, 'empresas', empresaId, 'piezas');
  const alta = () => ({ createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid });
  const cambio = () => ({ updatedAt: serverTimestamp(), updatedBy: uid });

  // ── Empresas ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function obtenerEmpresa(empresaId: string): Promise<EmpresaDoc | null> {
    const s = await getDoc(doc(db, 'empresas', empresaId));
    return s.exists() ? ({ id: s.id, ...(s.data() as Empresa) }) : null;
  }
  /** Solo admin (las reglas lo exigen). */
  async function listarEmpresas(): Promise<EmpresaDoc[]> {
    const s = await getDocs(query(collection(db, 'empresas'), orderBy('nombre')));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Empresa) }));
  }
  /** Solo admin. Devuelve el id de la empresa creada. */
  async function crearEmpresa(datos: Omit<Empresa, 'id'>): Promise<string> {
    const ref = await escribir(() => addDoc(collection(db, 'empresas'), sinUndefined({ ...datos, createdAt: serverTimestamp(), createdBy: uid })));
    return ref.id;
  }

  // ── Reglas editables (settings/reglasCostos) ────────────────────────────────────────────────────────────────────
  /** reglasVersion = updatedAt (ms) del documento; 0 si no existe (se usan los defaults del código). */
  async function leerReglas(): Promise<ReglasCostos> {
    const s = await getDoc(doc(db, 'settings', 'reglasCostos'));
    if (!s.exists()) return REGLAS_POR_DEFECTO;
    const d = s.data() as Partial<Record<(typeof GRUPOS_REGLAS)[number], object>> & { updatedAt?: { toMillis?: () => number } };
    const base = REGLAS_POR_DEFECTO;
    return {
      productividad: { ...base.productividad, ...d.productividad },
      tiemposMuertos: { ...base.tiemposMuertos, ...d.tiemposMuertos },
      preparacion: { ...base.preparacion, ...d.preparacion },
      herramienta: { ...base.herramienta, ...d.herramienta },
      calidad: { ...base.calidad, ...d.calidad },
      roturas: { ...base.roturas, ...d.roturas },
      reglasVersion: d.updatedAt?.toMillis?.() ?? 0,
    };
  }
  /** Solo admin (la regla de settings lo exige). Escribe updatedAt con serverTimestamp. */
  async function guardarReglas(reglas: Omit<ReglasCostos, 'reglasVersion'>): Promise<void> {
    validarReglas(reglas);
    const datos = Object.fromEntries(GRUPOS_REGLAS.map((g) => [g, reglas[g]]));
    await escribir(() => setDoc(doc(db, 'settings', 'reglasCostos'), { ...datos, updatedAt: serverTimestamp(), updatedBy: uid }));
  }

  // ── Máquinas ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function listarMaquinas(empresaId: string): Promise<MaquinaDoc[]> {
    const s = await getDocs(query(colMaquinas(empresaId), orderBy('nombre')));
    return s.docs.map((d) => ({ ...(d.data() as MaquinaDoc), id: d.id }));
  }

  async function contexto(empresaId: string): Promise<ContextoCalculo> {
    const [maquinas, reglas] = await Promise.all([listarMaquinas(empresaId), leerReglas()]);
    return { costoHora: Object.fromEntries(maquinas.map((m) => [m.id, m.costoHora])), reglas };
  }

  async function crearMaquina(empresaId: string, datos: Omit<Maquina, 'id'>): Promise<string> {
    const ref = await escribir(() => addDoc(colMaquinas(empresaId), sinUndefined({ ...datos, ...alta() })));
    return ref.id;
  }

  /** Recalcula y escribe el resumen de UNA tanda de piezas con un solo writeBatch. */
  async function recalcularTanda(empresaId: string, docs: QueryDocumentSnapshot[], ctx: ContextoCalculo): Promise<boolean> {
    try {
      await escribir(async () => {
        const batch = writeBatch(db);
        for (const d of docs) {
          const pieza = { ...(d.data() as Pieza), id: d.id };
          batch.update(d.ref, { resumen: sinUndefined(calcResumen(pieza, ctx.costoHora, ctx.reglas)), ...cambio() });
        }
        await batch.commit();
      });
      return true;
    } catch (e) {
      console.error(`No se pudo recalcular una tanda de ${docs.length} piezas de la empresa ${empresaId}:`, e);
      return false;
    }
  }

  /** Recorre en tandas de 100 las piezas que devuelve la consulta y recalcula su resumen. Un fallo en una tanda no corta el resto. */
  async function recalcularConsulta(empresaId: string, filtros: QueryConstraint[], ctx: ContextoCalculo): Promise<ResultadoRecalculo> {
    const r: ResultadoRecalculo = { recalculadas: 0, fallidas: 0 };
    let cursor: QueryDocumentSnapshot | null = null;
    for (;;) {
      const s: QuerySnapshot = await getDocs(query(colPiezas(empresaId), ...filtros, ...(cursor ? [startAfter(cursor)] : []), limit(TAMANO_TANDA)));
      if (s.empty) break;
      if (await recalcularTanda(empresaId, s.docs, ctx)) r.recalculadas += s.size;
      else r.fallidas += s.size;
      cursor = s.docs[s.docs.length - 1];
      if (s.size < TAMANO_TANDA) break;
    }
    return r;
  }

  /** Recalcula el resumen de las piezas que usan la máquina (resumen.maquinaIds array-contains), en tandas de 100. Idempotente. */
  async function recalcularResumenesPorMaquina(empresaId: string, maquinaId: string, ctx?: ContextoCalculo): Promise<ResultadoRecalculo> {
    return recalcularConsulta(empresaId, [where('resumen.maquinaIds', 'array-contains', maquinaId), orderBy(documentId())], ctx ?? (await contexto(empresaId)));
  }

  /**
   * Actualiza la máquina. Si cambia el costo hora, recalcula el resumen de las piezas que la usan y devuelve cuántas se
   * recalcularon y cuántas fallaron (se puede reintentar con recalcularResumenesPorMaquina). `recalculo` es null si no cambió.
   */
  async function actualizarMaquina(
    empresaId: string, maquinaId: string, cambios: Partial<Pick<Maquina, 'nombre' | 'costoHora' | 'planta'>>,
  ): Promise<{ recalculo: ResultadoRecalculo | null }> {
    const ref = doc(colMaquinas(empresaId), maquinaId);
    const actual = await getDoc(ref);
    if (!actual.exists()) throw new Error('La máquina no existe.');
    const cambiaCosto = cambios.costoHora !== undefined && cambios.costoHora !== (actual.data() as Maquina).costoHora;
    await escribir(() => updateDoc(ref, { ...sinUndefined(cambios), ...cambio() }));
    if (!cambiaCosto) return { recalculo: null };
    return { recalculo: await recalcularResumenesPorMaquina(empresaId, maquinaId) };
  }

  /** Bloqueada si alguna pieza la usa (consulta array-contains con límite 1). */
  async function eliminarMaquina(empresaId: string, maquinaId: string): Promise<void> {
    const uso = await getDocs(query(colPiezas(empresaId), where('resumen.maquinaIds', 'array-contains', maquinaId), limit(1)));
    if (!uso.empty) throw new MaquinaEnUsoError();
    await escribir(() => deleteDoc(doc(colMaquinas(empresaId), maquinaId)));
  }

  // ── Piezas ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const aFila = (d: QueryDocumentSnapshot): FilaPieza => {
    const p = d.data() as Pieza;
    return { id: d.id, codigo: p.codigo, nombre: p.nombre, volumenAnual: p.volumenAnual, resumen: p.resumen as ResumenPieza };
  };

  /** Una página de resúmenes, ordenada por código. */
  async function listarPiezasPagina(empresaId: string, tamano = TAMANO_PAGINA_PIEZAS, despues?: QueryDocumentSnapshot | null): Promise<PaginaPiezas> {
    const s = await getDocs(query(colPiezas(empresaId), orderBy('codigo'), ...(despues ? [startAfter(despues)] : []), limit(tamano)));
    return { items: s.docs.map(aFila), siguiente: s.size === tamano ? s.docs[s.docs.length - 1] : null };
  }

  /** Todos los resúmenes (para el resumen de planta), leyendo de a 100. */
  async function listarTodosLosResumenes(empresaId: string): Promise<FilaPieza[]> {
    const todas: FilaPieza[] = [];
    let cursor: QueryDocumentSnapshot | null = null;
    do {
      const pagina: PaginaPiezas = await listarPiezasPagina(empresaId, TAMANO_TANDA, cursor);
      todas.push(...pagina.items);
      cursor = pagina.siguiente;
    } while (cursor);
    return todas;
  }

  async function obtenerPieza(empresaId: string, piezaId: string): Promise<PiezaDoc | null> {
    const s = await getDoc(doc(colPiezas(empresaId), piezaId));
    return s.exists() ? ({ ...(s.data() as Pieza), id: s.id }) : null;
  }

  /** Campos de la pieza sin id ni resumen (el resumen siempre lo calcula esta capa). */
  const camposPieza = (p: Pieza): DocumentData => {
    const { id: _id, resumen: _resumen, ...resto } = p;
    void _id; void _resumen;
    return sinUndefined(resto);
  };

  async function crearPieza(empresaId: string, pieza: Pieza, ctx?: ContextoCalculo): Promise<string> {
    const c = ctx ?? (await contexto(empresaId));
    const resumen = sinUndefined(calcResumen(pieza, c.costoHora, c.reglas));
    const ref = await escribir(() => addDoc(colPiezas(empresaId), { ...camposPieza(pieza), resumen, ...alta() }));
    return ref.id;
  }

  /** Reemplaza los datos de la pieza y recalcula el resumen. createdAt/createdBy no cambian. */
  async function actualizarPieza(empresaId: string, piezaId: string, pieza: Pieza, ctx?: ContextoCalculo): Promise<void> {
    const c = ctx ?? (await contexto(empresaId));
    const resumen = sinUndefined(calcResumen(pieza, c.costoHora, c.reglas));
    await escribir(() => updateDoc(doc(colPiezas(empresaId), piezaId), {
      ...camposPieza(pieza),
      // campos opcionales de la pieza: si ya no aplican se borran en vez de quedar con el valor anterior
      ...(pieza.piezasPorLote === undefined ? { piezasPorLote: deleteField() } : {}),
      ...(pieza.lotesPorAnio === undefined ? { lotesPorAnio: deleteField() } : {}),
      resumen, ...cambio(),
    }));
  }

  /** Copia la pieza con otro código (por defecto "<código>-copia") y devuelve el id de la nueva. */
  async function duplicarPieza(empresaId: string, piezaId: string, nuevo?: { codigo?: string; nombre?: string }): Promise<string> {
    const original = await obtenerPieza(empresaId, piezaId);
    if (!original) throw new Error('La pieza no existe.');
    // La copia lleva los descartes, pero NO el historial de mejoras ni la línea base: pertenecen a la pieza original y la copia empieza de cero.
    const { implementaciones: _implementaciones, lineaBase: _lineaBase, lineasBaseAnteriores: _anteriores, ...sinHistorial } = original;
    void _implementaciones; void _lineaBase; void _anteriores;
    const copia: Pieza = { ...sinHistorial, codigo: nuevo?.codigo ?? `${original.codigo}-copia`, nombre: nuevo?.nombre ?? original.nombre };
    return crearPieza(empresaId, copia);
  }

  async function eliminarPieza(empresaId: string, piezaId: string): Promise<void> {
    await escribir(() => deleteDoc(doc(colPiezas(empresaId), piezaId)));
  }

  /**
   * Recalcula SOLO las piezas con resumen desactualizado (reglasVersion distinta de la actual o calcVersion vieja), de a 100.
   * Idempotente y reanudable: las ya recalculadas dejan de coincidir con la consulta. Informa cuántas se recalcularon y cuántas fallaron.
   */
  async function recalcularResumenesDesactualizados(empresaId: string): Promise<ResultadoRecalculo> {
    const ctx = await contexto(empresaId);
    const porReglas = await recalcularConsulta(empresaId, [where('resumen.reglasVersion', '!=', ctx.reglas.reglasVersion)], ctx);
    const porCalculo = await recalcularConsulta(empresaId, [where('resumen.calcVersion', '!=', CALC_VERSION)], ctx);
    return { recalculadas: porReglas.recalculadas + porCalculo.recalculadas, fallidas: porReglas.fallidas + porCalculo.fallidas };
  }

  return {
    obtenerEmpresa, listarEmpresas, crearEmpresa,
    leerReglas, guardarReglas,
    listarMaquinas, crearMaquina, actualizarMaquina, eliminarMaquina, recalcularResumenesPorMaquina,
    listarPiezasPagina, listarTodosLosResumenes, obtenerPieza, crearPieza, actualizarPieza, duplicarPieza, eliminarPieza,
    recalcularResumenesDesactualizados,
  };
}

export type RepositorioCostos = ReturnType<typeof crearRepositorioCostos>;
