export interface CoolantConcentration {
  min: number;
  max: number;
  note: string;
}

export function getCoolantConcentration(isoGroup: string): CoolantConcentration | null {
  const group = isoGroup.replace(/^ISO\s+/i, '');
  const MAP: Record<string, CoolantConcentration> = {
    P:  { min: 5,  max: 7,  note: 'Estándar. Prioridad refrigeración. Mismo tanque para aceros generales.' },
    K:  { min: 0,  max: 5,  note: 'Preferible mecanizado en seco. Si usás soluble, máximo 5% solo para limpiar polvo.' },
    N:  { min: 8,  max: 10, note: 'Aluminio se suelda al filo por fricción. Más aceite para que la viruta resbale rápido.' },
    M:  { min: 10, max: 12, note: 'Crítico. Work hardening requiere película lubricante gruesa. Al 5% la mecha se desafila en 3 agujeros.' },
    M2: { min: 10, max: 12, note: 'Crítico. Work hardening requiere película lubricante gruesa. Al 5% la mecha se desafila en 3 agujeros.' },
    S:  { min: 12, max: 15, note: 'Extremo. Titanio no transmite calor — máxima concentración para lubricar bajo presión extrema.' },
    S2: { min: 12, max: 15, note: 'Extremo. Titanio no transmite calor — máxima concentración para lubricar bajo presión extrema.' },
    H:  { min: 7,  max: 10, note: 'Materiales templados. Concentración media-alta para evitar sobrecalentamiento del filo.' },
  };
  return MAP[group] ?? null;
}
