export interface DrillingAlertInput {
  coolantInternal: boolean;
  depth: number;
  diameter: number;
  materialIsoGroup: string;
  orientation: 'vertical' | 'horizontal';
}

export interface DrillingAlert {
  type: 'critical_g83' | 'recommended_g83' | 'recommended_g73' | 'optimized' | null;
  title: string;
  lines: string[];
}

export function getDrillingAlert(params: DrillingAlertInput): DrillingAlert {
  const { coolantInternal, depth, diameter, materialIsoGroup, orientation } = params;
  const ldRatio = diameter > 0 ? depth / diameter : 0;
  const group = materialIsoGroup.replace(/^ISO\s+/i, '');

  if (coolantInternal) {
    return {
      type: 'optimized',
      title: '✅ PROCESO OPTIMIZADO — Entrada Directa G01 (Refrigeración Interna)',
      lines: [
        'Entrada directa en una sola pasada (G01). No usar G83 ni G73 — el picoteo con refrigeración interna genera choques térmicos que destruyen el filo.',
        'La presión interna expulsa la viruta de forma continua hacia la boca del agujero.',
        'Ventaja comercial: elimina tiempos muertos, reduce costo por pieza y duplica vida útil del filo.',
      ],
    };
  }

  if (ldRatio <= 1) return { type: null, title: '', lines: [] };

  const HIGH_RISK = new Set(['M', 'M2', 'S', 'S2', 'H']);

  if (HIGH_RISK.has(group) && ldRatio > 3) {
    if (orientation === 'vertical') {
      return {
        type: 'critical_g83',
        title: '⚠️ ALERTA CRÍTICA — Usar Ciclo G83 (Descarga Completa)',
        lines: [
          'Estrategia CNC Obligatoria: Prohibido entrar en una sola pasada. Programar G83 cada 2-3 mm en Titanio/Superaleaciones o 3-4 mm en Inoxidable/H.',
          'PROHIBIDO G04 (Dwell): En Inoxidable provoca work hardening instantáneo. En Titanio el material abraza la mecha por contracción térmica.',
          'Orientación vertical: la gravedad acumula viruta en el fondo. El G83 actúa como extractor mecánico — sin él el agujero se tapa.',
          'Factor de Tiempo: El ciclo real aumentará 40-60% por los movimientos de retroceso en rápido (G00).',
          'Direccionamiento: Boquillas externas con máximo caudal apuntando a la entrada del agujero.',
        ],
      };
    }
    return {
      type: 'recommended_g83',
      title: '🔵 Recomendación: Ciclo G83 (Orientación Horizontal — Evacuación Asistida)',
      lines: [
        'Orientación horizontal: la viruta cae por gravedad hacia la bandeja, mejorando la evacuación natural. En materiales difíciles (Inox, Titanio) el G83 sigue siendo recomendado para garantizar refrigeración al fondo.',
        'Evaluá usar G73 si el material quiebra bien — podés reducir el tiempo de ciclo hasta un 20% sin comprometer la evacuación.',
        'No programar G04 (Dwell) en el fondo del agujero en ningún caso.',
      ],
    };
  }

  if (HIGH_RISK.has(group)) {
    return {
      type: 'recommended_g83',
      title: '🔵 Recomendación: Ciclo G83 (Agujero Ciego / Vertical)',
      lines: [
        'En agujeros ciegos o verticales hacia abajo, la gravedad acumula viruta en el fondo. El G83 actúa como extractor mecánico retirando la mecha completamente.',
        'Para Inoxidable y materiales ISO H, usar G83 aunque el agujero sea corto para evitar sobrecalentamiento del filo.',
      ],
    };
  }

  return {
    type: 'recommended_g73',
    title: '🟡 Recomendación: Ciclo G73 (Rotura de Viruta — Alta Productividad)',
    lines: [
      'Material dócil: la viruta evacúa bien pero puede formar nidos largos. El G73 la rompe con un salto corto sin sacar la mecha, ahorrando tiempo de ciclo.',
      'Ideal para producción en serie: a diferencia del G83, no pierde tiempo viajando en vacío hacia afuera del agujero.',
      'En tornos CNC (agujeros horizontales): la viruta cae por gravedad, con romperla es suficiente.',
    ],
  };
}
