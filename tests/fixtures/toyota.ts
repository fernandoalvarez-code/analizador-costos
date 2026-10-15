import type { UseTaylorCurveInputs } from '@/hooks/use-taylor-curve';
import { MATERIALS } from '@/lib/taylor-data';

/**
 * Caso de referencia (Toyota, torneado): 10.000 piezas/mes, cambio de 2 min, rendimiento 20 y 40 piezas,
 * tiempos de corte 2,0 y 1,375 min, máquina 20 USD/h. Con ese cambio la app calcula 350 hs/mes (actual)
 * y 237,5 hs/mes (propuesta): (10000 · (2,0 + 2/20)) / 60 y (10000 · (1,375 + 2/40)) / 60.
 */
export const TOYOTA_INPUTS: UseTaylorCurveInputs = {
  operationType: 'turning', materialId: MATERIALS[1].nombre,
  machineCostHr: 20, toolChangeTime: 2, machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85,
  coolantInternal: false, drillingOrientation: 'vertical', profundidadAgujero: '',
  monthlyProduction: 10000, horasPorTurno: 8, turnosPorDia: 1, isStressTestActive: false,
  toolNameCurrent: 'CNMA120412 KCK20', toolCostCurrent: 7.4, apCurrent: 1, feedCurrent: 0.3, vcCurrent: 220,
  pcsCurrent: 20, tcCurrent: 2.0, zCurrent: '', edgesCurrent: 4, dcCurrent: 50, aeCurrent: '', lifeModeCurrent: 'piezas',
  toolNamePremium: 'CNMA120412-MR9 TK1501', toolCostPremium: 11.72, apPremium: 1, feedPremium: 0.4, vcPremium: 240,
  pcsPremium: 40, tcPremiumInput: 1.375, zPremium: '', edgesPremium: 4, dcPremium: 50, aePremium: '', lifeModePremium: 'piezas',
};
