/**
 * taylor-data.ts
 * Tablas de datos estáticas del análisis de curva de Taylor (materiales, constantes
 * de Taylor por grupo ISO, rompevirutas y calidades Seco, avance sugerido Double Turbo).
 * Extraído de taylor-curve/page.tsx y taylor-curve/[id]/edit/page.tsx, que lo tenían
 * duplicado de forma idéntica.
 */

export type LifeMode = 'piezas' | 'minutos' | 'mm';

export const MATERIALS: { grupo: string; nombre: string; kc: number; dureza: string; isoId?: string }[] = [
  // --- GRUPO ISO P (Aceros) 🟦 ---
  { grupo: "ISO P", nombre: "Acero Bajo Carbono (Ej: 1010, 1020)", kc: 1500, dureza: "150 HB" },
  { grupo: "ISO P", nombre: "Acero Medio Carbono (Ej: 1045, 4140)", kc: 1800, dureza: "200 HB" },
  { grupo: "ISO P", nombre: "Acero Aleado / Cementación (Ej: 8620, 16MnCr5)", kc: 1700, dureza: "180 HB" },
  { grupo: "ISO P", nombre: "Acero Alta Aleación / Herramienta", kc: 2100, dureza: "300 HB" },

  // --- GRUPO ISO M (Inoxidables) 🟨 ---
  { grupo: "ISO M", nombre: "Acero Inoxidable Austenítico (304, 316)", kc: 2200, dureza: "200 HB" },
  { grupo: "ISO M", nombre: "Inox. SUS 316L (JIS)", kc: 2200, dureza: "200 HB", isoId: "sus316l" },
  { grupo: "ISO M", nombre: "Acero Inox. Dúplex / Súper Dúplex", kc: 2600, dureza: "260 HB" },

  // --- GRUPO ISO K (Fundiciones) 🟥 ---
  { grupo: "ISO K", nombre: "Fundición Gris (GG)", kc: 1200, dureza: "200 HB" },
  { grupo: "ISO K", nombre: "Fundición Nodular / Dúctil (GGG)", kc: 1500, dureza: "250 HB" },

  // --- GRUPO ISO N (No Ferrosos y Plásticos) 🟩 ---
  { grupo: "ISO N", nombre: "Aluminio / Aleaciones de Aluminio", kc: 700, dureza: "60 HB" },
  { grupo: "ISO N", nombre: "Latón / Bronce / Cobre", kc: 900, dureza: "100 HB" },
  { grupo: "ISO N", nombre: "Plásticos de Ingeniería (Nylon, Delrin)", kc: 300, dureza: "N/A" },

  // --- GRUPO ISO S (Superaleaciones y Titanio) 🟧 ---
  { grupo: "ISO S", nombre: "Aleaciones de Titanio (Ej: Ti-6Al-4V)", kc: 2000, dureza: "350 HB" },
  { grupo: "ISO S", nombre: "Titanio Ti-6Al-4V Gr.5", kc: 2600, dureza: "350 HB", isoId: "ti6al4v" },
  { grupo: "ISO S", nombre: "Súper Aleaciones Base Níquel (Inconel)", kc: 2800, dureza: "400 HB" },

  // --- GRUPO ISO H (Materiales Templados) ⬜ ---
  { grupo: "ISO H", nombre: "Aceros Templados (> 45 HRC)", kc: 3500, dureza: "50+ HRC" }
];

export const TAYLOR_CONSTANTS: Record<string, { n: number, C: number }> = {
  "ISO P": { n: 0.25, C: 250 },
  "ISO M": { n: 0.20, C: 150 },
  "ISO K": { n: 0.25, C: 200 },
  "ISO N": { n: 0.35, C: 900 },
  "ISO S": { n: 0.18, C: 130 },
  "ISO H": { n: 0.15, C: 120 },
};

export const MATRIZ_ROMPEVIRUTAS: Record<string, any> = {
  "ME10": { desc: "Geometría Aguda Double Turbo" },
  "M12":  { desc: "Geometría Universal Double Turbo" }
};

export const CALIDADES_SECO = {
  "MS2050": { tipo: "PVD", aplicacion: "Inox / Titanio", desc: "Grado de alta tenacidad" }
};

export const dataDoubleTurbo: Record<string, Record<string, Record<string, number>>> = {
    "ISO P": {
        "ME10": { base: 0.14, medio: 0.16, fino: 0.24 },
        "M12":  { base: 0.16, medio: 0.18, fino: 0.28 }
    },
    "ISO M": {
        "ME10": { base: 0.14, medio: 0.16, fino: 0.24 },
    },
    "ISO K": {
        "M12": { base: 0.17, medio: 0.19, fino: 0.28 }
    },
    "ISO S": {
        "ME10": { base: 0.095, medio: 0.10, fino: 0.12 }
    }
};

export const COOLANT_COLOR: Record<string, string> = {
  P: 'text-green-700', K: 'text-green-700',
  N: 'text-yellow-700', M: 'text-yellow-700', M2: 'text-yellow-700',
  S: 'text-red-700', S2: 'text-red-700',
  H: 'text-orange-700',
};

export const DRILLING_ALERT_STYLES: Record<string, string> = {
  critical_g83:    'bg-red-50 border-red-300 text-red-900',
  recommended_g83: 'bg-orange-50 border-orange-200 text-orange-900',
  recommended_g73: 'bg-blue-50 border-blue-200 text-blue-900',
  optimized:       'bg-green-50 border-green-200 text-green-900',
};
