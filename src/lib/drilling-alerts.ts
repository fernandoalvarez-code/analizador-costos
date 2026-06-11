export interface DrillingAlertInput {
  coolantInternal: boolean;
  depth: number;
  diameter: number;
  materialIsoGroup: string;
}

export interface DrillingAlert {
  type: 'critical' | 'optimized' | null;
  title: string;
  lines: string[];
}

export function getDrillingAlert(params: DrillingAlertInput): DrillingAlert {
  const { coolantInternal, depth, diameter } = params;
  const ldRatio = diameter > 0 ? depth / diameter : 0;

  if (coolantInternal) {
    return {
      type: 'optimized',
      title: '🟢 PROCESO DE ALTA PRODUCTIVIDAD (Optimizado por Seco Tools)',
      lines: [
        'Estrategia CNC: Entrada directa en una sola pasada (G01). No use ciclos de picoteo (G83). El picoteo con refrigeración interna arruina el inserto por choque térmico.',
        'Control de Viruta: La presión interna romperá la viruta y la expulsará de forma continua hacia la boca del agujero.',
        'Tiempo de Ciclo: Tiempo mínimo real de catálogo. Proceso 100% automatizable.',
        'Recomendación de Venta: Con mechas Seco de refrigeración interna el cliente reduce el tiempo de máquina a la mitad y el proceso es 100% automatizable.',
      ],
    };
  }

  if (ldRatio > 3) {
    return {
      type: 'critical',
      title: '⚠️ ALERTA CRÍTICA DE PROCESO (Refrigeración Externa Tradicional)',
      lines: [
        'Estrategia CNC Obligatoria: Prohibido entrar en una sola pasada. Programar ciclo G83 (Picoteo con extracción completa) cada 2-3 mm en Titanio o 3-4 mm en Inoxidable.',
        'PROHIBIDO TEMPORIZAR (G04 / Dwell): En Inoxidable provoca endurecimiento por fricción (work hardening). En Titanio el material se contrae, abraza la mecha y la parte al retomar el movimiento.',
        'Factor de Costo/Tiempo: El tiempo de ciclo real aumentará entre 40% y 60% por los movimientos de retroceso y aproximación en rápido (G00).',
        'Direccionamiento: Posicione boquillas externas con máximo caudal apuntando directo a la entrada del agujero.',
      ],
    };
  }

  return { type: null, title: '', lines: [] };
}
