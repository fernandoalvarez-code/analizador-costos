// Datos de prueba inventados para los tests del resumen de planta. TODOS los totales esperados están escritos a mano en los tests.
import type { FilaPieza } from '@/lib/costos-mecanizado/firestore';
import { CALC_VERSION, type ResumenPieza, type Rubro } from '@/lib/costos-mecanizado/types';

export const RUBROS_VACIOS: Record<Rubro, number> = { corte: 0, tiemposMuertos: 0, preparacion: 0, herramientas: 0, cambios: 0, scrap: 0 };

export function resumen(parcial: Partial<ResumenPieza> & Pick<ResumenPieza, 'costoPieza' | 'costoAnual'>): ResumenPieza {
  return {
    minutosPieza: 1, opMayorCosto: 'op10', opMayorCostoNombre: 'Planeado', rubroPrincipal: 'corte', porRubroUsdPza: { ...RUBROS_VACIOS }, porMaquinaUsdPza: {}, maquinaIds: [],
    ahorroPotencialAnual: 0, cantMejoras: 0, logradoAnual: 0, cantImplementadas: 0, calcVersion: CALC_VERSION, reglasVersion: 0, ...parcial,
  };
}

export const MAQUINAS = [{ id: 'm1', nombre: 'Torno CNC' }, { id: 'm2', nombre: 'Centro vertical' }];

/**
 * Tres piezas de totales conocidos (USD/año = costoPieza × volumen):
 *  A: 1.000 pzs × 10 = 10.000 · B: 500 × 8 = 4.000 · C: 2.000 × 1 = 2.000  → total 16.000
 *  Rubros anuales: corte 8.000 · tiempos muertos 1.700 · preparación 950 · herramientas 3.150 · cambios 850 · scrap 1.350
 *  Máquinas: m1 = 6×1000 + 8×500 = 10.000 · m2 = 4×1000 + 1×2000 = 6.000
 *  Ahorro potencial: 2.000 + 500 + 100 = 2.600
 */
export const PIEZA_A: FilaPieza = {
  id: 'a', codigo: 'A-001', nombre: 'Zeta', volumenAnual: 1000,
  resumen: resumen({
    costoPieza: 10, costoAnual: 10000, minutosPieza: 9.5, opMayorCosto: 'op20', opMayorCostoNombre: 'Desbaste', rubroPrincipal: 'corte', ahorroPotencialAnual: 2000, cantMejoras: 3,
    porRubroUsdPza: { corte: 5, tiemposMuertos: 1, preparacion: 0.5, herramientas: 2, cambios: 0.5, scrap: 1 }, porMaquinaUsdPza: { m1: 6, m2: 4 }, maquinaIds: ['m1', 'm2'],
  }),
};
export const PIEZA_B: FilaPieza = {
  id: 'b', codigo: 'B-002', nombre: 'Alfa', volumenAnual: 500,
  resumen: resumen({
    costoPieza: 8, costoAnual: 4000, minutosPieza: 5, opMayorCosto: 'op10', opMayorCostoNombre: 'Planeado', rubroPrincipal: 'herramientas', ahorroPotencialAnual: 500, cantMejoras: 1,
    porRubroUsdPza: { corte: 4, tiemposMuertos: 1, preparacion: 0.5, herramientas: 1.5, cambios: 0.5, scrap: 0.5 }, porMaquinaUsdPza: { m1: 8 }, maquinaIds: ['m1'],
  }),
};
export const PIEZA_C: FilaPieza = {
  id: 'c', codigo: 'C-003', nombre: 'Mu', volumenAnual: 2000,
  resumen: resumen({
    costoPieza: 1, costoAnual: 2000, minutosPieza: 0.5, opMayorCosto: 'op40', opMayorCostoNombre: 'Roscado', rubroPrincipal: 'scrap', ahorroPotencialAnual: 100, cantMejoras: 1,
    porRubroUsdPza: { corte: 0.5, tiemposMuertos: 0.1, preparacion: 0.1, herramientas: 0.2, cambios: 0.05, scrap: 0.05 }, porMaquinaUsdPza: { m2: 1 }, maquinaIds: ['m2'],
  }),
};
export const TRES_PIEZAS = [PIEZA_A, PIEZA_B, PIEZA_C];

/** n piezas simples con USD/año decreciente (P-001 la más cara). */
export function muchasPiezas(n: number): FilaPieza[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`, codigo: `P-${String(i + 1).padStart(3, '0')}`, nombre: `Pieza ${i + 1}`, volumenAnual: 100,
    resumen: resumen({ costoPieza: 100 - i, costoAnual: (100 - i) * 100, maquinaIds: ['m1'], porMaquinaUsdPza: { m1: 100 - i } }),
  }));
}
