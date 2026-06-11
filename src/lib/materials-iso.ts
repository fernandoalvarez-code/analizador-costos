/**
 * materials-iso.ts
 * Base de materiales ISO estándar con propiedades de mecanizado.
 * Valores de kc según ISO 3685 y catálogos Sandvik Coromant / Seco Tools.
 * Rangos de Vc son valores de referencia para condiciones normales (acabado–desbaste).
 */

export type ISOGroup = 'P' | 'M' | 'M2' | 'K' | 'N' | 'S' | 'S2' | 'H';

export interface MaterialISO {
  id: string;
  name: string;
  isoGroup: ISOGroup;
  /** Fuerza específica de corte en torneado [N/mm²] */
  kc_turning: number;
  /** Fuerza específica de corte en fresado [N/mm²] */
  kc_milling: number;
  /** Fuerza específica de corte en taladrado [N/mm²] */
  kc_drilling: number;
  /** Rango de velocidad de corte recomendado en torneado [m/min] */
  vcRange: { min: number; max: number };
}

export const MATERIALS_ISO: MaterialISO[] = [
  // ── ISO P — Aceros ────────────────────────────────────────────────────────
  {
    id: 'steel-1045',
    name: 'Acero 1045 (C45)',
    isoGroup: 'P',
    kc_turning: 1800,
    kc_milling: 1700,
    kc_drilling: 1900,
    vcRange: { min: 100, max: 300 },
  },
  {
    id: 'steel-4140',
    name: 'Acero 4140 (42CrMo4)',
    isoGroup: 'P',
    kc_turning: 2000,
    kc_milling: 1900,
    kc_drilling: 2100,
    vcRange: { min: 80, max: 250 },
  },

  // ── ISO M — Aceros inoxidables ────────────────────────────────────────────
  {
    id: 'stainless-304',
    name: 'Inoxidable AISI 304',
    isoGroup: 'M',
    kc_turning: 2000,
    kc_milling: 1950,
    kc_drilling: 2100,
    vcRange: { min: 60, max: 180 },
  },
  {
    id: 'stainless-316',
    name: 'Inoxidable AISI 316',
    isoGroup: 'M',
    kc_turning: 2200,
    kc_milling: 2100,
    kc_drilling: 2300,
    vcRange: { min: 50, max: 160 },
  },

  // ── ISO K — Fundiciones ───────────────────────────────────────────────────
  {
    id: 'cast-iron-gray',
    name: 'Fundición Gris (FC200)',
    isoGroup: 'K',
    kc_turning: 900,
    kc_milling: 850,
    kc_drilling: 950,
    vcRange: { min: 80, max: 300 },
  },
  {
    id: 'cast-iron-nodular',
    name: 'Fundición Nodular (FE42)',
    isoGroup: 'K',
    kc_turning: 1100,
    kc_milling: 1050,
    kc_drilling: 1150,
    vcRange: { min: 60, max: 250 },
  },

  // ── ISO N — Aluminio y no ferrosos ────────────────────────────────────────
  {
    id: 'aluminum-6061',
    name: 'Aluminio 6061-T6',
    isoGroup: 'N',
    kc_turning: 500,
    kc_milling: 480,
    kc_drilling: 520,
    vcRange: { min: 300, max: 1000 },
  },

  // ── ISO S — Superaleaciones y titanio ─────────────────────────────────────
  {
    id: 'nickel-inconel718',
    name: 'Inconel 718 (Superaleación Ni)',
    isoGroup: 'S',
    kc_turning: 2800,
    kc_milling: 2700,
    kc_drilling: 3000,
    vcRange: { min: 15, max: 60 },
  },

  // ── ISO M2 — Inoxidables austeníticos de alta aleación (JIS) ─────────────
  {
    id: 'sus316l',
    name: 'Inox. SUS 316L (JIS)',
    isoGroup: 'M2',
    kc_turning: 2200,
    kc_milling: 2300,
    kc_drilling: 2450,
    vcRange: { min: 35, max: 55 },
  },

  // ── ISO S2 — Titanio ──────────────────────────────────────────────────────
  {
    id: 'ti6al4v',
    name: 'Titanio Ti-6Al-4V Gr.5',
    isoGroup: 'S2',
    kc_turning: 2600,
    kc_milling: 2700,
    kc_drilling: 2800,
    vcRange: { min: 20, max: 30 },
  },
];

/** Busca un material por id. Devuelve undefined si no existe. */
export function findMaterial(id: string): MaterialISO | undefined {
  return MATERIALS_ISO.find(m => m.id === id);
}

/** Filtra materiales por grupo ISO. */
export function getMaterialsByGroup(group: ISOGroup): MaterialISO[] {
  return MATERIALS_ISO.filter(m => m.isoGroup === group);
}
