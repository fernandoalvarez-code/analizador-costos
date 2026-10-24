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
  /** USD/año logrado desde la línea base (ver implementaciones.ts): (costoPiezaBase − costo actual) × volumen actual. 0 si no hay línea base. */
  logradoAnual: number;
  /** ¿La pieza tiene línea base fijada? Sin ella el logrado es 0 y no se mide. */
  tieneLineaBase: boolean;
  /** Cantidad de mejoras registradas como implementadas (hitos del historial). */
  cantImplementadas: number;
  /** USD/año descartados por no aplicables: suma de ahorroAnualAlDescartar de las mejoras descartadas VIGENTES (las que hoy todavía se dispararían). No suma al pendiente. */
  descartadoAnual: number;
  /** registradaEn (ISO) y email de quien registró la implementación más reciente. */
  ultimaMejoraFecha?: string;
  ultimaMejoraPor?: string;
  calcVersion: number;
  reglasVersion: number;
}

/** Por qué se descartó una mejora sugerida. */
export type MotivoDescarteTipo = 'ya-probado' | 'limitacion-maquina' | 'exigencia-cliente' | 'calidad-tolerancia' | 'otro';

export const ETIQUETA_MOTIVO_DESCARTE: Record<MotivoDescarteTipo, string> = {
  'ya-probado': 'Ya se probó',
  'limitacion-maquina': 'Limitación de la máquina',
  'exigencia-cliente': 'Exigencia del cliente',
  'calidad-tolerancia': 'Calidad o tolerancia',
  'otro': 'Otro',
};

export const MOTIVO_DESCARTE_MIN = 5;
export const MOTIVO_DESCARTE_MAX = 500;

/** Registro de una mejora descartada: queda en la pieza, no se vuelve a sugerir ni suma al ahorro potencial hasta que se reactive. */
export interface MejoraDescartada {
  motivoTipo: MotivoDescarteTipo;
  /** Obligatorio: de MOTIVO_DESCARTE_MIN a MOTIVO_DESCARTE_MAX caracteres. */
  motivo: string;
  /** uid y email de quien la descartó. */
  por: string;
  porEmail: string;
  /** ISO 8601. */
  fecha: string;
  /** Ahorro anual estimado de la mejora en el momento de descartarla (USD). */
  ahorroAnualAlDescartar: number;
}

/** Registro de que una mejora se implementó: deja el costo de la pieza "antes" como punto de partida para medir cuánto bajó de verdad. */
export interface Implementacion {
  /** Único dentro de la pieza. */
  id: string;
  categoria: CategoriaMejora;
  opId: string;
  /** Nombre de la operación al registrar. */
  opNombre: string;
  posicionId?: string;
  /** Clave estable de la mejora (`claveMejora` de mejoras.ts). */
  claveMejora: string;
  /** Título de la mejora al registrar. */
  titulo: string;
  /** YYYY-MM-DD: cuándo se implementó (la elige el usuario; no futura). */
  fecha: string;
  /** Qué se cambió: de IMPLEMENTACION_NOTA_MIN a IMPLEMENTACION_NOTA_MAX caracteres. */
  nota: string;
  /** uid y email de quien la registró. */
  por: string;
  porEmail: string;
  /** ISO 8601. */
  registradaEn: string;
  /** USD/pieza de la pieza al registrar. Dato HISTÓRICO: ya no se usa para el logro (eso lo mide la línea base). */
  costoPiezaAntes: number;
  /** Ahorro anual estimado de la mejora al registrar (solo informativo). */
  ahorroEstimadoAnual: number;
}

/**
 * Punto de partida del ahorro logrado: la fija una persona, explícitamente, cuando la carga de la pieza está terminada y validada (el costo al
 * CREAR la pieza no sirve: mientras se carga se corrigen datos y eso no es mejora).
 */
export interface LineaBase {
  /** USD/pieza de mecanizado SIN material, el mismo del resumen, al fijarla. */
  costoPiezaBase: number;
  /** ISO 8601. */
  fecha: string;
  por: string;
  porEmail: string;
  /** Volumen anual de ese momento (informativo: el logrado usa el volumen ACTUAL). */
  volumenAnualBase: number;
  /** Opcional, hasta LINEA_BASE_NOTA_MAX caracteres. */
  nota?: string;
}

export const LINEA_BASE_NOTA_MAX = 500;
export const IMPLEMENTACION_NOTA_MIN = 5;
export const IMPLEMENTACION_NOTA_MAX = 500;

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
  /**
   * Mejoras descartadas, por clave estable `${categoria}|${opId}|${posicionId o ''}` (ids, no posiciones). Opcional: las piezas ya guardadas
   * siguen válidas. Al reactivar la última se deja `{}` (no se borra el campo) para que la actualización en Firestore reemplace el mapa.
   */
  mejorasDescartadas?: Record<string, MejoraDescartada>;
  /** Mejoras implementadas, en orden cronológico de registro (se agrega al final). Opcional: las piezas existentes siguen válidas. */
  implementaciones?: Implementacion[];
  /** Línea base vigente. Opcional: sin ella no se mide el ahorro logrado. */
  lineaBase?: LineaBase;
  /** Líneas base anteriores (se agregan al rehacerla): historial de solo lectura para auditar. */
  lineasBaseAnteriores?: LineaBase[];
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
  /** Clave estable `${categoria}|${opId}|${posicionId o ''}`: identifica la mejora aunque cambie el orden de las operaciones. */
  clave: string;
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
 * guardados quedan desactualizados). 2: se agregó opMayorCostoNombre. 3: ahorroPotencialAnual y cantMejoras cuentan solo las mejoras
 * activas (las descartadas con motivo no suman). 4: el resumen suma logradoAnual y cantImplementadas (mejoras implementadas). 5: el logrado se mide desde la línea base (tieneLineaBase,
 * ultimaMejoraFecha, ultimaMejoraPor). 6: el resumen suma descartadoAnual (lo descartado vigente, para el tablero de planta).
 */
export const CALC_VERSION = 6;
