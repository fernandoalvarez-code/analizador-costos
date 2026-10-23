// Validación de los mínimos obligatorios (ADDENDUM punto 5) con un mensaje por campo. Un dato inválido NO se guarda.
// Las rutas identifican el campo: 'codigo', 'volumenAnual', 'operaciones.<opId>.scrapPct',
// 'operaciones.<opId>.herramientas.<posId>.opciones.<optId>.piezasPorFilo', etc.
import type { Pieza } from '@/lib/costos-mecanizado/types';

export type ErroresPieza = Record<string, string>;

export const rutaOp = (opId: string, campo: string) => `operaciones.${opId}.${campo}`;
export const rutaPosicion = (opId: string, posId: string) => `operaciones.${opId}.herramientas.${posId}`;
export const rutaOpcion = (opId: string, posId: string, optId: string, campo: string) => `${rutaPosicion(opId, posId)}.opciones.${optId}.${campo}`;

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const noVacio = (v: unknown) => typeof v === 'string' && v.trim() !== '';

export const MENSAJES = {
  codigo: 'El código es obligatorio.',
  nombre: 'El nombre es obligatorio.',
  volumen: 'Las piezas por año deben ser un número mayor o igual a 1.',
  piezasPorLote: 'Las piezas por lote deben ser un número mayor o igual a 1.',
  lotesPorAnio: 'Los lotes por año deben ser un número mayor o igual a 1.',
  materialCosto: 'El costo del material debe ser un número mayor o igual a 0.',
  materialCobro: 'El monto que te cobra el cliente debe ser un número mayor o igual a 0.',
  opNombre: 'El nombre de la operación es obligatorio.',
  opMaquina: 'Elegí una máquina.',
  tiempo: 'El tiempo debe ser mayor o igual a 0 (mm:ss).',
  scrap: 'El scrap debe estar entre 0 y 100 %.',
  posicionSinOpciones: 'Cada herramienta necesita al menos una opción.',
  optNombre: 'El nombre de la opción es obligatorio.',
  precio: 'El precio debe ser un número mayor o igual a 0.',
  insertos: 'Los insertos por herramienta deben ser un número mayor o igual a 1.',
  filos: 'Los filos por inserto deben ser un número mayor o igual a 1.',
  piezasPorFilo: 'Las piezas por filo deben ser un número mayor o igual a 0,01.',
  porcentaje: 'El porcentaje debe estar entre 0 y 100.',
} as const;

export function validarPieza(p: Pieza, maquinaIds: string[]): ErroresPieza {
  const e: ErroresPieza = {};
  if (!noVacio(p.codigo)) e.codigo = MENSAJES.codigo;
  if (!noVacio(p.nombre)) e.nombre = MENSAJES.nombre;
  if (!finito(p.volumenAnual) || p.volumenAnual < 1) e.volumenAnual = MENSAJES.volumen;
  if (p.modoProduccion === 'lote' && (!finito(p.piezasPorLote) || p.piezasPorLote < 1)) e.piezasPorLote = MENSAJES.piezasPorLote;
  if (p.modoProduccion === 'lotesAnio' && (!finito(p.lotesPorAnio) || p.lotesPorAnio < 1)) e.lotesPorAnio = MENSAJES.lotesPorAnio;
  if (p.material.quienPone === 'propio' && (!finito(p.material.costoPorPieza) || p.material.costoPorPieza < 0)) e['material.costoPorPieza'] = MENSAJES.materialCosto;
  if (p.material.quienPone === 'cliente' && p.material.clienteCobraScrap && (!finito(p.material.cobroPorPiezaPerdida) || p.material.cobroPorPiezaPerdida < 0)) {
    e['material.cobroPorPiezaPerdida'] = MENSAJES.materialCobro;
  }

  for (const op of p.operaciones) {
    if (!noVacio(op.nombre)) e[rutaOp(op.id, 'nombre')] = MENSAJES.opNombre;
    if (!maquinaIds.includes(op.maquinaId)) e[rutaOp(op.id, 'maquinaId')] = MENSAJES.opMaquina;
    if (!finito(op.tiemposMuertosMin) || op.tiemposMuertosMin < 0) e[rutaOp(op.id, 'tiemposMuertosMin')] = MENSAJES.tiempo;
    if (!finito(op.setupMin) || op.setupMin < 0) e[rutaOp(op.id, 'setupMin')] = MENSAJES.tiempo;
    if (!finito(op.scrapPct) || op.scrapPct < 0 || op.scrapPct > 100) e[rutaOp(op.id, 'scrapPct')] = MENSAJES.scrap;
    for (const pos of op.herramientas) {
      if (pos.opciones.length === 0) e[rutaPosicion(op.id, pos.id)] = MENSAJES.posicionSinOpciones;
      for (const o of pos.opciones) {
        const r = (campo: string) => rutaOpcion(op.id, pos.id, o.id, campo);
        if (!noVacio(o.nombre)) e[r('nombre')] = MENSAJES.optNombre;
        if (!finito(o.precio) || o.precio < 0) e[r('precio')] = MENSAJES.precio;
        if (!finito(o.insertosPorHerramienta) || o.insertosPorHerramienta < 1) e[r('insertosPorHerramienta')] = MENSAJES.insertos;
        if (!finito(o.filosPorInserto) || o.filosPorInserto < 1) e[r('filosPorInserto')] = MENSAJES.filos;
        if (!finito(o.piezasPorFilo) || o.piezasPorFilo < 0.01) e[r('piezasPorFilo')] = MENSAJES.piezasPorFilo;
        if (!finito(o.cortePorPiezaMin) || o.cortePorPiezaMin < 0) e[r('cortePorPiezaMin')] = MENSAJES.tiempo;
        if (!finito(o.cambioMin) || o.cambioMin < 0) e[r('cambioMin')] = MENSAJES.tiempo;
        if (o.roturaPct !== undefined && (!finito(o.roturaPct) || o.roturaPct < 0 || o.roturaPct > 100)) e[r('roturaPct')] = MENSAJES.porcentaje;
        if (o.roturaExtraMin !== undefined && (!finito(o.roturaExtraMin) || o.roturaExtraMin < 0)) e[r('roturaExtraMin')] = MENSAJES.tiempo;
        if (o.roturaScrapPct !== undefined && (!finito(o.roturaScrapPct) || o.roturaScrapPct < 0 || o.roturaScrapPct > 100)) e[r('roturaScrapPct')] = MENSAJES.porcentaje;
      }
    }
  }
  return e;
}

// ── Pieza, operación y herramienta nuevas ─────────────────────────────────────────────────────────────────────────────
let contador = 0;
export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}${(++contador).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function piezaNueva(): Pieza {
  return {
    codigo: '', nombre: '', volumenAnual: 1000, modoProduccion: 'lote', piezasPorLote: 100,
    material: { quienPone: 'propio', costoPorPieza: 0 }, operaciones: [],
  };
}

export function opcionNueva(nombre = 'Herramienta'): Pieza['operaciones'][number]['herramientas'][number]['opciones'][number] {
  return { id: nuevoId('o'), nombre, precio: 0, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 100, cortePorPiezaMin: 0, cambioMin: 0 };
}

export function posicionNueva(): Pieza['operaciones'][number]['herramientas'][number] {
  return { id: nuevoId('h'), seleccionada: 0, opciones: [opcionNueva()] };
}

export function operacionNueva(maquinaId: string): Pieza['operaciones'][number] {
  return { id: nuevoId('op'), nombre: 'Nueva operación', maquinaId, tiemposMuertosMin: 0, setupMin: 0, scrapPct: 0, herramientas: [posicionNueva()] };
}
