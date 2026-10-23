// Tipos del módulo "Análisis de costos de mecanizado". Nombres de campos: los largos del SPEC (docs/analisis-costos/SPEC.md)
// son la fuente de verdad (ADDENDUM punto 9). Todos los tiempos están en MINUTOS (decimal).

export type ModoProduccion = 'lote' | 'lotesAnio' | 'dedicada';

export interface Empresa {
  id?: string;
  nombre: string;
  plantas: string[];
  vendedorId?: string;
}

export interface Maquina {
  id: string;
  nombre: string;
  /** USD/h (incluye operario, energía, amortización, gastos). */
  costoHora: number;
  planta?: string;
}

export interface OpcionHerramienta {
  id: string;
  nombre: string;
  /** USD por inserto o por herramienta enteriza. */
  precio: number;
  insertosPorHerramienta: number;
  /** 1 si es enteriza. */
  filosPorInserto: number;
  /** DATO MEDIDO en planta. */
  piezasPorFilo: number;
  /** Tiempo de corte de ESTA herramienta en la pieza. */
  cortePorPiezaMin: number;
  /** Máquina parada por cambio/indexado normal. */
  cambioMin: number;
  /** % de los cambios que son por rotura. */
  roturaPct?: number;
  /** Tiempo extra por rotura. */
  roturaExtraMin?: number;
  /** % de roturas que tiran la pieza. */
  roturaScrapPct?: number;
  /**
   * Quien cargó el dato confirma que la vida útil por filo es la medida en planta (silencia el aviso de "fuera de 5–90 min").
   * Solo se guarda cuando es true. No entra en ningún cálculo ni en el resumen; la interfaz la borra si cambia el dato.
   */
  vidaVerificada?: boolean;
}

export interface PosicionHerramienta {
  id: string;
  /** Índice de la opción EN USO. */
  seleccionada: number;
  /** La en uso + alternativas para comparar. */
  opciones: OpcionHerramienta[];
}

export interface Operacion {
  id: string;
  nombre: string;
  maquinaId: string;
  /** Por pieza (carga, descarga, posicionamiento, medición). */
  tiemposMuertosMin: number;
  /** Por lote. */
  setupMin: number;
  scrapPct: number;
  herramientas: PosicionHerramienta[];
}

export interface MaterialPieza {
  quienPone: 'propio' | 'cliente';
  /** Si 'propio'. */
  costoPorPieza?: number;
  /** Si 'cliente'. */
  clienteCobraScrap?: boolean;
  /** Si 'cliente' y cobra. */
  cobroPorPiezaPerdida?: number;
}

/** Rubros del costo (6). */
export type Rubro = 'corte' | 'tiemposMuertos' | 'preparacion' | 'herramientas' | 'cambios' | 'scrap';
export const RUBROS: readonly Rubro[] = ['corte', 'tiemposMuertos', 'preparacion', 'herramientas', 'cambios', 'scrap'];
export const ETIQUETA_RUBRO: Record<Rubro, string> = {
  corte: 'Tiempo de corte',
  tiemposMuertos: 'Tiempos muertos',
  preparacion: 'Preparación',
  herramientas: 'Herramientas (consumo)',
  cambios: 'Cambios de herr.',
  scrap: 'Scrap',
};

/** Resumen desnormalizado que se guarda en la pieza (ADDENDUM punto 4: valores POR PIEZA; la planta multiplica por volumenAnual). */
export interface ResumenPieza {
  /** USD/pza, SIN material. */
  costoPieza: number;
  /** costoPieza × volumenAnual. */
  costoAnual: number;
  minutosPieza: number;
  /** id de la operación de mayor costo ('' si no hay operaciones). */
  opMayorCosto: string;
  /** Nombre de la operación de mayor costo ('' si no hay operaciones): es lo que muestra el resumen de planta. */
  opMayorCostoNombre: string;
  rubroPrincipal: Rubro | null;
  porRubroUsdPza: Record<Rubro, number>;
  /** USD/pza por máquina. */
  porMaquinaUsdPza: Record<string, number>;
  maquinaIds: string[];
  ahorroPotencialAnual: number;
  cantMejoras: number;
  calcVersion: number;
  reglasVersion: number;
}

export interface Pieza {
  id?: string;
  codigo: string;
  nombre: string;
  volumenAnual: number;
  modoProduccion: ModoProduccion;
  /** Si modo = 'lote'. */
  piezasPorLote?: number;
  /** Si modo = 'lotesAnio'. */
  lotesPorAnio?: number;
  material: MaterialPieza;
  /** Embebidas, en el orden de la ruta. */
  operaciones: Operacion[];
  resumen?: ResumenPieza;
}

/** Costo hora (USD/h) por id de máquina. */
export type CostoHoraPorMaquina = Record<string, number>;

export type DireccionCambio = 'sube' | 'baja';

/** Sensibilidad en % del costo de la pieza. `cambioPct` con signo (positivo = el costo SUBE); `pct` es su valor absoluto. */
export interface Sensibilidad {
  pct: number;
  cambioPct: number;
  direccion: DireccionCambio;
}

export interface Sensibilidades {
  precioMas10: Sensibilidad;
  vidaMas10: Sensibilidad;
  cortaMasRapido10: Sensibilidad;
  subirVc10: Sensibilidad;
}

export type NivelSensibilidadPrecio = 'Bajo' | 'Medio' | 'Alto';

export interface IncidenciaHerramienta {
  posicionId: string;
  opcionId: string;
  nombre: string;
  corte: number;
  consumo: number;
  cambios: number;
  rotTiempo: number;
  scrapRot: number;
  /** corte + consumo + cambios + rotTiempo + scrapRot (USD/pza). */
  costoHerr: number;
  partPieza: number;
  partOp: number;
  /** (consumo + cambios) / totalOp. */
  sensPrecio: number;
  nivelSensPrecio: NivelSensibilidadPrecio;
  /** pf × cortePorPiezaMin (minutos de corte por filo). */
  vidaUtilFiloMin: number;
  sensibilidades: Sensibilidades;
}

export interface ResultadoOperacion {
  opId: string;
  nombre: string;
  maquinaId: string;
  /** USD por rubro (por pieza). */
  corte: number;
  tiemposMuertos: number;
  preparacion: number;
  herramientas: number;
  cambios: number;
  scrap: number;
  /** antes del scrap = corte + tiemposMuertos + preparacion + herramientas + cambios. */
  antes: number;
  totalOp: number;
  minutosOp: number;
  /** Σ tiempo de corte de las herramientas en uso (minutos por pieza). */
  corteMin: number;
  tiemposMuertosMin: number;
  /** Valor acumulado de la pieza al terminar la operación, ANTES del scrap (incluye el material). */
  acumuladoAntesScrap: number;
  /** Idem, después del scrap. */
  acumulado: number;
  herramientasDetalle: IncidenciaHerramienta[];
}

export interface ResultadoPieza {
  loteEfectivo: number;
  materialEfectivo: number;
  volumenAnual: number;
  operaciones: ResultadoOperacion[];
  /** USD/pza, SIN material. */
  costoPieza: number;
  /** costoPieza + materialEfectivo (KPI "pieza con material"). */
  costoPiezaConMaterial: number;
  costoAnual: number;
  minutosPieza: number;
  opMayorCosto: string;
  rubroPrincipal: Rubro | null;
  porRubroUsdPza: Record<Rubro, number>;
  porMaquinaUsdPza: Record<string, number>;
  maquinaIds: string[];
}

export interface ComparacionOpcion {
  opcionId: string;
  nombre: string;
  esEnUso: boolean;
  costoOpcion: number;
  /** vs la opción en uso (negativo = ahorra). */
  deltaPorPieza: number;
  deltaAnual: number;
  /** Precio al que la opción empata con la en uso; null = "no empata". */
  precioMaximo: number | null;
}

export type CategoriaMejora = 'Productividad' | 'Tiempos muertos' | 'Preparación' | 'Herramienta' | 'Calidad' | 'Roturas';

export interface MejoraCosto {
  categoria: CategoriaMejora;
  opId: string;
  opNombre: string;
  /** Posición de herramienta (reglas por herramienta). */
  posicionId?: string;
  titulo: string;
  explicacion: string;
  supuesto: string;
  ahorroPorPieza: number;
  ahorroAnual: number;
  /** Muestra el botón "comparar". */
  puedeComparar: boolean;
}

/** Umbrales (% salvo `tiemposMuertosAuxMin`, en USD/pza) y supuestos de ahorro (% del rubro) de la sección 6 del SPEC. */
export interface ReglasCostos {
  productividad: { umbralPct: number; ahorroPct: number };
  tiemposMuertos: { umbralMuertosSobreCortePct: number; umbralAuxUsd: number; ahorroPct: number };
  preparacion: { umbralPct: number; ahorroPct: number };
  herramienta: { umbralPct: number; ahorroPct: number };
  calidad: { umbralPct: number; ahorroPct: number };
  roturas: { umbralPct: number; ahorroPct: number };
  /** 0 = defaults del código (el documento settings/reglasCostos no existe). */
  reglasVersion: number;
}

export const REGLAS_POR_DEFECTO: ReglasCostos = {
  productividad: { umbralPct: 45, ahorroPct: 20 },
  tiemposMuertos: { umbralMuertosSobreCortePct: 60, umbralAuxUsd: 0.05, ahorroPct: 30 },
  preparacion: { umbralPct: 12, ahorroPct: 40 },
  herramienta: { umbralPct: 18, ahorroPct: 35 },
  calidad: { umbralPct: 8, ahorroPct: 50 },
  roturas: { umbralPct: 5, ahorroPct: 60 },
  reglasVersion: 0,
};

/**
 * Versión de las fórmulas y del contenido del resumen: sube cuando cambia algún cálculo o se agrega un campo al resumen (los resúmenes
 * guardados quedan desactualizados). 2: se agregó opMayorCostoNombre.
 */
export const CALC_VERSION = 2;
