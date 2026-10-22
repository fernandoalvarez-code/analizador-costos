import type { CostoHoraPorMaquina, OpcionHerramienta, Operacion, Pieza } from '../../src/lib/costos-mecanizado/types';

/**
 * Caso de control del módulo de costos de mecanizado: SPEC 4.7 (pieza CAR-001 Carcasa). Los datos de entrada están
 * copiados del SPEC. Los valores esperados (ORACULOS) se calcularon por fuera del motor con las fórmulas del SPEC y están
 * ESCRITOS A MANO: no pueden salir de calc.ts ni de ninguna función del módulo, ni se ajustan para que un test pase.
 */

/** Torno CNC 1 = 30 · Centro vertical 1 = 35 · Centro vertical 2 = 35 · Centro horizontal = 45 USD/h. */
export const COSTO_HORA: CostoHoraPorMaquina = { T1: 30, CV1: 35, CV2: 35, CH: 45 };

const opcion = (
  id: string, nombre: string, precio: number, insertosPorHerramienta: number, filosPorInserto: number,
  piezasPorFilo: number, cortePorPiezaMin: number, cambioMin: number,
): OpcionHerramienta => ({ id, nombre, precio, insertosPorHerramienta, filosPorInserto, piezasPorFilo, cortePorPiezaMin, cambioMin });

const posicion = (id: string, o: OpcionHerramienta) => ({ id, seleccionada: 0, opciones: [o] });

const operacion = (
  id: string, nombre: string, maquinaId: string, tiemposMuertosMin: number, setupMin: number, scrapPct: number,
  herramientas: Operacion['herramientas'],
): Operacion => ({ id, nombre, maquinaId, tiemposMuertosMin, setupMin, scrapPct, herramientas });

/** Pieza nueva en cada llamada (los tests la modifican). 25.000 pzs/año · lote 500 · material propio USD 9,50. */
export function crearCarcasa(): Pieza {
  return {
    id: 'car-001', codigo: 'CAR-001', nombre: 'Carcasa', volumenAnual: 25000,
    modoProduccion: 'lote', piezasPorLote: 500,
    material: { quienPone: 'propio', costoPorPieza: 9.5 },
    operaciones: [
      operacion('op10', 'Planeado 2 caras', 'CV2', 0.6, 45, 0.3, [
        posicion('op10-h1', opcion('op10-h1-o1', 'Fresa planear', 25, 8, 9, 60, 0.8, 6)),
      ]),
      operacion('op20', 'Desbaste y contorno', 'CH', 1.0, 60, 0.5, [
        posicion('op20-h1', opcion('op20-h1-o1', 'Alto avance', 20, 4, 4, 85, 2.4, 6)),
        posicion('op20-h2', opcion('op20-h2-o1', 'Enteriza Ø12', 50, 1, 1, 180, 0.8, 4)),
      ]),
      operacion('op30', 'Agujereado', 'CV1', 0.5, 30, 1.2, [
        posicion('op30-h1', opcion('op30-h1-o1', 'Broca Ø8,5', 180, 1, 1, 180, 0.45, 5)),
        posicion('op30-h2', opcion('op30-h2-o1', 'Broca inserto Ø25', 25, 2, 2, 950, 0.15, 4)),
      ]),
      operacion('op40', 'Roscado M10', 'CV1', 0.3, 20, 1.0, [
        posicion('op40-h1', opcion('op40-h1-o1', 'Macho', 75, 1, 1, 150, 0.5, 4)),
      ]),
      operacion('op50', 'Torneado alojamiento', 'T1', 0.7, 40, 0.3, [
        posicion('op50-h1', opcion('op50-h1-o1', 'CNMG', 10, 1, 4, 105, 1.1, 2)),
      ]),
    ],
  };
}

/** Alternativa de Op30: "Broca refrig. interna + mandril" (200, 1, 1, 510, 0,36, 5). */
export const ALTERNATIVA_OP30: OpcionHerramienta = opcion('op30-h1-o2', 'Broca refrig. interna + mandril', 200, 1, 1, 510, 0.36, 5);

/** Valores esperados (USD/pza salvo que se indique). Tolerancia 0,001; los anuales están redondeados al USD entero. */
export const ORACULOS = {
  base: {
    op: { op10: 1.3303, op20: 3.8959, op30: 1.919, op40: 1.1821, op50: 1.0297 },
    pieza: 9.357,
    anual: 233926,
    // Desglose de Op30
    op30: { corte: 0.35, aux: 0.2917, setup: 0.035, herr: 1.0263, camb: 0.0187, scrap: 0.1974 },
    // Alternativa de Op30
    alt: { deltaPorPieza: -0.6708, deltaAnual: -16771, precioMaximo: 542.12 },
  },
  // Roturas en Op20 · Alto avance: roturaPct 30, roturaExtraMin 5, roturaScrapPct 50
  roturas: {
    op: { op10: 1.3303, op20: 3.9351, op30: 1.9195, op40: 1.1825, op50: 1.0299 },
    pieza: 9.3972,
    anual: 234930,
    op20: { cambios: 0.0828, scrap: 0.0992 },
  },
  material: {
    clienteNoCobraScrap: { op: [1.3018, 3.8483, 1.8041, 1.0852, 1.0004], pieza: 9.0397, anual: 225992 },
    clienteCobra12: { op: [1.3378, 3.9085, 1.9493, 1.2076, 1.0375], pieza: 9.4405, anual: 236013 },
  },
  // Volumen 25.000
  modos: {
    dedicada: { lote: 25000, pieza: 9.1153, anual: 227883 },
    lote100: { pieza: 10.3435, anual: 258588 },
    lotesAnio250: { pieza: 10.3435 },
    lotesAnio50: { pieza: 9.357 },
  },
  // Broca Ø8,5 de Op30, en % del costo de la pieza
  sensibilidades: { precioMas10: 1.0687, vidaMas10: 0.9873, cortaMasRapido10: 1.2423, subirVc10: 4.7853 },
} as const;
