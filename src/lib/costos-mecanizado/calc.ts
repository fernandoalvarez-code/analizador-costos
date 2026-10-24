// Motor de cálculo de costos de mecanizado (SPEC secciones 3, 4 y 6 + ADDENDUM). Funciones PURAS: sin Firebase, sin React.
// Notación: h = costoHora / 60 (USD por minuto) de la máquina de la operación.
import { logradoTotalAnual, ultimaImplementacion } from './implementaciones';
import { mejoras } from './mejoras';
import {
  CALC_VERSION, RUBROS, REGLAS_POR_DEFECTO,
  type ComparacionOpcion, type CostoHoraPorMaquina, type IncidenciaHerramienta, type NivelSensibilidadPrecio, type OpcionHerramienta,
  type Pieza, type ReglasCostos, type ResultadoOperacion, type ResultadoPieza, type ResumenPieza, type Rubro, type Sensibilidad, type Sensibilidades,
} from './types';

// ── Mínimos obligatorios (ADDENDUM punto 5), aplicados acá y no solo en los formularios ─────────────────────────────
export const MIN_PIEZAS_POR_FILO = 0.01;
export const MIN_INSERTOS_POR_HERRAMIENTA = 1;
export const MIN_FILOS_POR_INSERTO = 1;
export const MIN_LOTE_EFECTIVO = 1;
export const MIN_VOLUMEN_ANUAL = 1;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** Precios, tiempos y costo hora: nunca negativos. */
const noNegativo = (v: unknown): number => Math.max(0, num(v));
/** Porcentajes (scrap, rotura): entre 0 y 100. */
const porcentaje = (v: unknown): number => Math.min(100, Math.max(0, num(v)));

// ── Lote y material (SPEC 4.1) ─────────────────────────────────────────────────────────────────────────────────────
export function volumenEfectivo(pieza: Pick<Pieza, 'volumenAnual'>): number {
  return Math.max(MIN_VOLUMEN_ANUAL, num(pieza.volumenAnual));
}

/** Piezas por preparación. 'lotesAnio' con 0 lotes se trata como 1 lote (sin dividir por cero). Mínimo 1. */
export function loteEfectivo(pieza: Pick<Pieza, 'volumenAnual' | 'modoProduccion' | 'piezasPorLote' | 'lotesPorAnio'>): number {
  const volumen = volumenEfectivo(pieza);
  let lote: number;
  if (pieza.modoProduccion === 'dedicada') lote = volumen;
  else if (pieza.modoProduccion === 'lotesAnio') lote = volumen / Math.max(1, num(pieza.lotesPorAnio));
  else lote = num(pieza.piezasPorLote);
  return Math.max(MIN_LOTE_EFECTIVO, lote);
}

export function materialEfectivo(pieza: Pick<Pieza, 'material'>): number {
  const m = pieza.material;
  if (m.quienPone === 'propio') return noNegativo(m.costoPorPieza);
  return m.clienteCobraScrap ? noNegativo(m.cobroPorPiezaPerdida) : 0;
}

// ── Opción de herramienta normalizada (con los mínimos ya aplicados) ───────────────────────────────────────────────
interface OpcionNormalizada {
  precio: number;
  insertos: number;
  filos: number;
  pf: number;
  corteMin: number;
  cambioMin: number;
  roturaPct: number;
  roturaExtraMin: number;
  roturaScrapPct: number;
}

function normalizarOpcion(o: OpcionHerramienta): OpcionNormalizada {
  return {
    precio: noNegativo(o.precio),
    insertos: Math.max(MIN_INSERTOS_POR_HERRAMIENTA, num(o.insertosPorHerramienta)),
    filos: Math.max(MIN_FILOS_POR_INSERTO, num(o.filosPorInserto)),
    pf: Math.max(MIN_PIEZAS_POR_FILO, num(o.piezasPorFilo)),
    corteMin: noNegativo(o.cortePorPiezaMin),
    cambioMin: noNegativo(o.cambioMin),
    roturaPct: porcentaje(o.roturaPct),
    roturaExtraMin: noNegativo(o.roturaExtraMin),
    roturaScrapPct: porcentaje(o.roturaScrapPct),
  };
}

/** Componentes de costo de una opción (SPEC 4.2), por pieza. `perdida` = fracción de piezas perdidas por rotura. */
function componentes(o: OpcionNormalizada, h: number) {
  const corte = o.corteMin * h;
  const consumo = (o.insertos * o.precio) / (o.pf * o.filos);
  const cambios = (o.cambioMin * h) / o.pf;
  const rq = o.roturaPct / 100 / o.pf; // roturas por pieza
  const rotTiempo = rq * o.roturaExtraMin * h;
  const perdida = (rq * o.roturaScrapPct) / 100;
  return { corte, consumo, cambios, rotTiempo, perdida };
}

const opcionEnUso = (opciones: OpcionHerramienta[], seleccionada: number): OpcionHerramienta | undefined =>
  opciones[Math.min(Math.max(0, Math.trunc(num(seleccionada))), opciones.length - 1)];

const nivelSensibilidadPrecio = (ratio: number): NivelSensibilidadPrecio => (ratio < 0.05 ? 'Bajo' : ratio <= 0.15 ? 'Medio' : 'Alto');

// ── Sensibilidades (SPEC 4.5), en % del costo de la pieza ──────────────────────────────────────────────────────────
const FACTOR_10 = 1 - 1 / 1.1;
const FACTOR_VC = 0.4641; // Taylor n = 0,25: subir vc 10 % -> vida ×0,683 -> consumo y cambios ×(1/0,683 − 1) ≈ 0,4641

const sensibilidad = (cambioPct: number): Sensibilidad => ({
  pct: Math.abs(cambioPct),
  cambioPct,
  direccion: cambioPct > 0 ? 'sube' : 'baja',
});

/** Cambio del costo de la pieza (en %, positivo = SUBE) ante cada escenario de una herramienta. */
export function sensibilidades(h: { corte: number; consumo: number; cambios: number }, costoPieza: number): Sensibilidades {
  const base = costoPieza > 0 ? costoPieza : Infinity;
  const pct = (usd: number) => (usd / base) * 100;
  return {
    precioMas10: sensibilidad(pct(0.1 * h.consumo)),
    vidaMas10: sensibilidad(pct(-FACTOR_10 * (h.consumo + h.cambios))),
    cortaMasRapido10: sensibilidad(pct(-FACTOR_10 * (h.corte + h.consumo + h.cambios))),
    subirVc10: sensibilidad(pct(FACTOR_VC * (h.consumo + h.cambios) - FACTOR_10 * h.corte)),
  };
}

// ── Pieza (SPEC 4.3 y 4.4) ─────────────────────────────────────────────────────────────────────────────────────────
const sumaRubros = (): Record<Rubro, number> => ({ corte: 0, tiemposMuertos: 0, preparacion: 0, herramientas: 0, cambios: 0, scrap: 0 });

export function calcPieza(pieza: Pieza, costoHoraPorMaquina: CostoHoraPorMaquina): ResultadoPieza {
  const volumenAnual = volumenEfectivo(pieza);
  const loteEf = loteEfectivo(pieza);
  const materialEf = materialEfectivo(pieza);

  let acumulado = materialEf;
  const operaciones: ResultadoOperacion[] = [];
  const porRubroUsdPza = sumaRubros();
  const porMaquinaUsdPza: Record<string, number> = {};
  type Usada = { pos: { id: string }; opcion: OpcionHerramienta; n: OpcionNormalizada; c: ReturnType<typeof componentes>; scrapRot: number };
  const usadasPorOp: Usada[][] = [];

  for (const op of pieza.operaciones) {
    const h = noNegativo(costoHoraPorMaquina[op.maquinaId]) / 60;

    const usadas = op.herramientas
      .map((pos) => ({ pos, opcion: opcionEnUso(pos.opciones, pos.seleccionada) }))
      .filter((x): x is { pos: typeof x.pos; opcion: OpcionHerramienta } => !!x.opcion)
      .map(({ pos, opcion }) => ({ pos, opcion, n: normalizarOpcion(opcion) }))
      .map((x) => ({ ...x, c: componentes(x.n, h), scrapRot: 0 }));

    const corte = usadas.reduce((s, x) => s + x.c.corte, 0);
    const aux = noNegativo(op.tiemposMuertosMin) * h;
    const setup = (noNegativo(op.setupMin) / loteEf) * h;
    const herramientas = usadas.reduce((s, x) => s + x.c.consumo, 0);
    const cambios = usadas.reduce((s, x) => s + x.c.cambios + x.c.rotTiempo, 0);
    const antes = corte + aux + setup + herramientas + cambios;
    acumulado += antes; // valor de la pieza al terminar la operación
    const acumuladoAntesScrap = acumulado;

    for (const x of usadas) x.scrapRot = x.c.perdida * acumuladoAntesScrap;
    const scrap = (porcentaje(op.scrapPct) / 100) * acumuladoAntesScrap + usadas.reduce((s, x) => s + x.scrapRot, 0);
    acumulado += scrap;
    const totalOp = antes + scrap;
    const corteMin = usadas.reduce((s, x) => s + x.n.corteMin, 0);
    const tiemposMuertosMin = noNegativo(op.tiemposMuertosMin);
    const minutosOp = corteMin + tiemposMuertosMin + noNegativo(op.setupMin) / loteEf;

    operaciones.push({
      opId: op.id, nombre: op.nombre, maquinaId: op.maquinaId,
      corte, tiemposMuertos: aux, preparacion: setup, herramientas, cambios, scrap,
      antes, totalOp, minutosOp, corteMin, tiemposMuertosMin, acumuladoAntesScrap, acumulado,
      herramientasDetalle: [], // se completa abajo: necesita el costo total de la pieza
    });
    usadasPorOp.push(usadas);

    porRubroUsdPza.corte += corte; porRubroUsdPza.tiemposMuertos += aux; porRubroUsdPza.preparacion += setup;
    porRubroUsdPza.herramientas += herramientas; porRubroUsdPza.cambios += cambios; porRubroUsdPza.scrap += scrap;
    porMaquinaUsdPza[op.maquinaId] = (porMaquinaUsdPza[op.maquinaId] ?? 0) + totalOp;
  }

  const costoPieza = operaciones.reduce((s, o) => s + o.totalOp, 0);

  // Incidencia por herramienta (SPEC 4.5): necesita el costo total de la pieza y el de la operación.
  operaciones.forEach((o, i) => {
    const usadas = usadasPorOp[i];
    o.herramientasDetalle = usadas.map((x): IncidenciaHerramienta => {
      const costoHerr = x.c.corte + x.c.consumo + x.c.cambios + x.c.rotTiempo + x.scrapRot;
      const sensPrecio = o.totalOp > 0 ? (x.c.consumo + x.c.cambios) / o.totalOp : 0;
      return {
        posicionId: x.pos.id, opcionId: x.opcion.id, nombre: x.opcion.nombre,
        corte: x.c.corte, consumo: x.c.consumo, cambios: x.c.cambios, rotTiempo: x.c.rotTiempo, scrapRot: x.scrapRot,
        costoHerr,
        partPieza: costoPieza > 0 ? costoHerr / costoPieza : 0,
        partOp: o.totalOp > 0 ? costoHerr / o.totalOp : 0,
        sensPrecio, nivelSensPrecio: nivelSensibilidadPrecio(sensPrecio),
        vidaUtilFiloMin: x.n.pf * x.n.corteMin,
        sensibilidades: sensibilidades(x.c, costoPieza),
      };
    });
  });

  let opMayor: ResultadoOperacion | undefined;
  for (const o of operaciones) if (!opMayor || o.totalOp > opMayor.totalOp) opMayor = o;
  let rubroPrincipal: Rubro | null = null;
  for (const r of RUBROS) if (rubroPrincipal === null || porRubroUsdPza[r] > porRubroUsdPza[rubroPrincipal]) rubroPrincipal = r;
  if (operaciones.length === 0) rubroPrincipal = null;

  return {
    loteEfectivo: loteEf, materialEfectivo: materialEf, volumenAnual, operaciones,
    costoPieza, costoPiezaConMaterial: costoPieza + materialEf, costoAnual: costoPieza * volumenAnual,
    minutosPieza: operaciones.reduce((s, o) => s + o.minutosOp, 0),
    opMayorCosto: opMayor?.opId ?? '', rubroPrincipal, porRubroUsdPza, porMaquinaUsdPza,
    maquinaIds: [...new Set(pieza.operaciones.map((o) => o.maquinaId))],
  };
}

// ── Comparación entre opciones de una posición (SPEC 4.6) ──────────────────────────────────────────────────────────
export function compararOpciones(
  pieza: Pieza, costoHoraPorMaquina: CostoHoraPorMaquina, opId: string, posicionId: string,
): ComparacionOpcion[] {
  const resultado = calcPieza(pieza, costoHoraPorMaquina);
  const op = pieza.operaciones.find((o) => o.id === opId);
  const resOp = resultado.operaciones.find((o) => o.opId === opId);
  const pos = op?.herramientas.find((p) => p.id === posicionId);
  if (!op || !resOp || !pos || pos.opciones.length === 0) return [];

  const h = noNegativo(costoHoraPorMaquina[op.maquinaId]) / 60;
  const costoOpcion = (o: OpcionNormalizada) => {
    const c = componentes(o, h);
    return { c, total: c.corte + c.consumo + c.cambios + c.rotTiempo + c.perdida * resOp.acumuladoAntesScrap };
  };
  const idxUso = Math.min(Math.max(0, Math.trunc(num(pos.seleccionada))), pos.opciones.length - 1);
  const enUso = costoOpcion(normalizarOpcion(pos.opciones[idxUso]));

  return pos.opciones.map((opcion, i): ComparacionOpcion => {
    const n = normalizarOpcion(opcion);
    const a = costoOpcion(n);
    const deltaPorPieza = a.total - enUso.total;
    const topeUsd = (enUso.total - (a.total - a.c.consumo)) * n.pf * n.filos / n.insertos;
    return {
      opcionId: opcion.id, nombre: opcion.nombre, esEnUso: i === idxUso,
      costoOpcion: a.total, deltaPorPieza, deltaAnual: deltaPorPieza * resultado.volumenAnual,
      precioMaximo: topeUsd > 0 ? topeUsd : null,
    };
  });
}

// ── Avisos no bloqueantes (ADDENDUM punto 6) ───────────────────────────────────────────────────────────────────────
export const VIDA_UTIL_FILO_MIN_AVISO = 5;
export const VIDA_UTIL_FILO_MAX_AVISO = 90;
export const LOTE_MIN_AVISO = 50;
export const PREPARACIONES_ANIO_MAX_AVISO = 2000;

/** Vida útil por filo (minutos de corte) fuera de 5–90: "verificar el dato". */
export function avisoVidaUtilFilo(vidaUtilFiloMin: number): string | null {
  if (vidaUtilFiloMin < VIDA_UTIL_FILO_MIN_AVISO || vidaUtilFiloMin > VIDA_UTIL_FILO_MAX_AVISO) return 'Vida útil por filo fuera de lo habitual: verificar el dato.';
  return null;
}

/** Lote chico (< 50 piezas) o demasiadas preparaciones por año (> 2.000). */
export function avisoLote(pieza: Pick<Pieza, 'volumenAnual' | 'modoProduccion' | 'piezasPorLote' | 'lotesPorAnio'>): string | null {
  const lote = loteEfectivo(pieza);
  const preparaciones = volumenEfectivo(pieza) / lote;
  if (lote < LOTE_MIN_AVISO) return `Lote de ${Math.round(lote)} piezas: muy chico, el costo de preparación pesa mucho. Verificar el dato.`;
  if (preparaciones > PREPARACIONES_ANIO_MAX_AVISO) return `${Math.round(preparaciones)} preparaciones por año: verificar el dato.`;
  return null;
}

// ── Resumen desnormalizado (ADDENDUM punto 4) ──────────────────────────────────────────────────────────────────────
export function calcResumen(pieza: Pieza, costoHoraPorMaquina: CostoHoraPorMaquina, reglas: ReglasCostos = REGLAS_POR_DEFECTO): ResumenPieza {
  const r = calcPieza(pieza, costoHoraPorMaquina);
  const lista = mejoras(r, pieza, reglas);
  const ultima = ultimaImplementacion(pieza);
  return {
    costoPieza: r.costoPieza, costoAnual: r.costoAnual, minutosPieza: r.minutosPieza,
    opMayorCosto: r.opMayorCosto, opMayorCostoNombre: r.operaciones.find((o) => o.opId === r.opMayorCosto)?.nombre ?? '', rubroPrincipal: r.rubroPrincipal,
    porRubroUsdPza: r.porRubroUsdPza, porMaquinaUsdPza: r.porMaquinaUsdPza, maquinaIds: r.maquinaIds,
    ahorroPotencialAnual: lista.reduce((s, m) => s + m.ahorroAnual, 0), cantMejoras: lista.length,
    logradoAnual: logradoTotalAnual(pieza, r), tieneLineaBase: !!pieza.lineaBase, cantImplementadas: (pieza.implementaciones ?? []).length,
    ...(ultima ? { ultimaMejoraFecha: ultima.registradaEn, ultimaMejoraPor: ultima.porEmail } : {}),
    calcVersion: CALC_VERSION, reglasVersion: reglas.reglasVersion,
  };
}

// ── Planta (SPEC 4.4): suma de los resúmenes por pieza × volumenAnual ──────────────────────────────────────────────
export interface PiezaConResumen {
  id: string;
  codigo: string;
  nombre: string;
  volumenAnual: number;
  resumen: ResumenPieza;
}

export interface ResultadoPlanta {
  piezasAnalizadas: number;
  costoAnual: number;
  porRubroAnual: Record<Rubro, number>;
  porMaquinaAnual: Record<string, number>;
  /** (herramientas + cambios) / costo anual; 0 si no hay costo. */
  pctHerramientas: number;
  ahorroPotencialAnual: number;
  /** Piezas ordenadas por costo anual descendente, con el % acumulado. */
  pareto: Array<{ id: string; codigo: string; nombre: string; costoAnual: number; acumuladoPct: number }>;
  /** Cuántas piezas (de mayor a menor costo anual) llegan al 80 % del costo. */
  piezasPara80: number;
  piezaMasCara: { id: string; codigo: string; nombre: string; costoAnual: number } | null;
  maquinaMayorCosto: { maquinaId: string; costoAnual: number } | null;
  rubroPrincipal: Rubro | null;
}

export const PARETO_PCT = 80;

export function calcPlanta(piezas: PiezaConResumen[]): ResultadoPlanta {
  const porRubroAnual = sumaRubros();
  const porMaquinaAnual: Record<string, number> = {};
  let costoAnual = 0;
  let ahorro = 0;

  const filas = piezas.map((p) => {
    const vol = Math.max(MIN_VOLUMEN_ANUAL, num(p.volumenAnual));
    const anual = num(p.resumen.costoPieza) * vol;
    costoAnual += anual;
    ahorro += num(p.resumen.ahorroPotencialAnual);
    for (const r of RUBROS) porRubroAnual[r] += num(p.resumen.porRubroUsdPza[r]) * vol;
    for (const [m, usd] of Object.entries(p.resumen.porMaquinaUsdPza)) porMaquinaAnual[m] = (porMaquinaAnual[m] ?? 0) + num(usd) * vol;
    return { id: p.id, codigo: p.codigo, nombre: p.nombre, costoAnual: anual };
  });

  const ordenadas = [...filas].sort((a, b) => b.costoAnual - a.costoAnual);
  let acum = 0;
  const pareto = ordenadas.map((f) => {
    acum += f.costoAnual;
    return { ...f, acumuladoPct: costoAnual > 0 ? (acum / costoAnual) * 100 : 0 };
  });
  const idx80 = pareto.findIndex((f) => f.acumuladoPct >= PARETO_PCT);
  const piezasPara80 = pareto.length === 0 ? 0 : idx80 === -1 ? pareto.length : idx80 + 1;

  const maquinas = Object.entries(porMaquinaAnual).sort((a, b) => b[1] - a[1]);
  let rubroPrincipal: Rubro | null = null;
  if (piezas.length > 0) for (const r of RUBROS) if (rubroPrincipal === null || porRubroAnual[r] > porRubroAnual[rubroPrincipal]) rubroPrincipal = r;

  return {
    piezasAnalizadas: piezas.length, costoAnual, porRubroAnual, porMaquinaAnual,
    pctHerramientas: costoAnual > 0 ? (porRubroAnual.herramientas + porRubroAnual.cambios) / costoAnual : 0,
    ahorroPotencialAnual: ahorro, pareto, piezasPara80,
    piezaMasCara: ordenadas[0] ?? null,
    maquinaMayorCosto: maquinas[0] ? { maquinaId: maquinas[0][0], costoAnual: maquinas[0][1] } : null,
    rubroPrincipal,
  };
}
