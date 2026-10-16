import type { UseTaylorCurveInputs } from '@/hooks/use-taylor-curve';
import { MATERIALS } from '@/lib/taylor-data';

/**
 * Caso de verificación del PDF: torneado, 24.000 piezas/mes, Vc 122 (actual) y 130 (propuesta) m/min, 20 y 30 pzs/filo,
 * tiempos de corte 2,0 y 1,6 min, cambio de 2 min, máquina 20 USD/h. Con la fórmula de la app: costo por pieza
 * USD 0,79 → 0,65 (-17,6 %), vida 20 → 30 pzs/filo (+50 %).
 */
export const CASO_24000: UseTaylorCurveInputs = {
  operationType: 'turning', materialId: MATERIALS[1].nombre, machineCostHr: 20, toolChangeTime: 2, machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85,
  coolantInternal: false, drillingOrientation: 'vertical', profundidadAgujero: '', monthlyProduction: 24000, horasPorTurno: 8, turnosPorDia: 1, isStressTestActive: false,
  toolNameCurrent: 'CNMA120412 KCK20', toolCostCurrent: 7.4, apCurrent: 1, feedCurrent: 0.3, vcCurrent: 122, pcsCurrent: 20, tcCurrent: 2.0, zCurrent: '', edgesCurrent: 4, dcCurrent: 50, aeCurrent: '', lifeModeCurrent: 'piezas',
  toolNamePremium: 'CNMA120412-MR9 TK1501', toolCostPremium: 11.72, apPremium: 1, feedPremium: 0.4, vcPremium: 130, pcsPremium: 30, tcPremiumInput: 1.6, zPremium: '', edgesPremium: 4, dcPremium: 50, aePremium: '', lifeModePremium: 'piezas',
};
