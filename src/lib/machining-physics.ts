/**
 * machining-physics.ts
 * Motor de cálculo físico de mecanizado — TypeScript puro, sin dependencias de React.
 * Todas las fórmulas siguen la notación estándar ISO 3685 / Sandvik Coromant.
 */

/**
 * Velocidad de giro del husillo.
 * n = (Vc × 1000) / (π × D)
 * @param vc_m_min  Velocidad de corte [m/min]
 * @param diameter_mm  Diámetro de herramienta o pieza [mm]
 * @returns RPM [rev/min]
 */
export function calcRPM(vc_m_min: number, diameter_mm: number): number {
  if (diameter_mm <= 0) return 0;
  return (vc_m_min * 1000) / (Math.PI * diameter_mm);
}

/**
 * Velocidad de avance de mesa.
 * Vf = n × fn
 * @param rpm  Velocidad de giro [rev/min]
 * @param fn_mm_rev  Avance por revolución [mm/rev]
 * @returns Velocidad de avance [mm/min]
 */
export function calcVf(rpm: number, fn_mm_rev: number): number {
  return rpm * fn_mm_rev;
}

/**
 * Tiempo de corte.
 * Tc = L / Vf
 * @param length_mm  Longitud de corte [mm]
 * @param vf_mm_min  Velocidad de avance [mm/min]
 * @returns Tiempo de corte [min]
 */
export function calcTc(length_mm: number, vf_mm_min: number): number {
  if (vf_mm_min <= 0) return 0;
  return length_mm / vf_mm_min;
}

/**
 * Potencia de corte neta (referida a la máquina, considerando eficiencia).
 * Pc_neta = kc × ap × fn × Vc / 60000
 * Pc_máquina = Pc_neta / η
 * Combinado: Pc = (kc × ap × fn × Vc) / (60000 × η)
 * @param kc  Fuerza específica de corte [N/mm²]
 * @param ap_mm  Profundidad de corte axial [mm]
 * @param fn_mm_rev  Avance por revolución [mm/rev]
 * @param vc_m_min  Velocidad de corte [m/min]
 * @param efficiency  Eficiencia mecánica del husillo [0–1]
 * @returns Potencia requerida en la máquina [kW]
 */
export function calcPc(
  kc: number,
  ap_mm: number,
  fn_mm_rev: number,
  vc_m_min: number,
  efficiency: number,
): number {
  if (efficiency <= 0) return 0;
  return (kc * ap_mm * fn_mm_rev * vc_m_min) / (60_000 * efficiency);
}

/**
 * Torque de corte en el husillo.
 * Fc = kc × ap × fn         [N]
 * Mc = Fc × D / (2 × 1000)  [Nm]
 * Combinado: Mc = (kc × ap × fn × D) / 2000
 * @param kc  Fuerza específica de corte [N/mm²]
 * @param ap_mm  Profundidad de corte axial [mm]
 * @param fn_mm_rev  Avance por revolución [mm/rev]
 * @param diameter_mm  Diámetro de herramienta o pieza [mm]
 * @returns Torque de corte [Nm]
 */
export function calcMc(
  kc: number,
  ap_mm: number,
  fn_mm_rev: number,
  diameter_mm: number,
): number {
  return (kc * ap_mm * fn_mm_rev * diameter_mm) / 2_000;
}

export interface ViabilityResult {
  viable: boolean;
  reason: string | null;
}

/**
 * Verifica si la operación es viable dados los límites de la máquina.
 * @param pc_kw  Potencia de corte requerida [kW]
 * @param mc_nm  Torque de corte requerido [Nm]
 * @param maxPower_kw  Potencia máxima de la máquina [kW]
 * @param maxTorque_nm  Torque máximo de la máquina [Nm]
 * @returns { viable, reason } — reason es null si es viable
 */
export function checkViability(
  pc_kw: number,
  mc_nm: number,
  maxPower_kw: number,
  maxTorque_nm: number,
): ViabilityResult {
  const powerExceeded = pc_kw > maxPower_kw;
  const torqueExceeded = maxTorque_nm > 0 && mc_nm > maxTorque_nm;

  if (powerExceeded && torqueExceeded) {
    return {
      viable: false,
      reason: `Potencia requerida (${pc_kw.toFixed(2)} kW) y torque (${mc_nm.toFixed(2)} Nm) superan los límites de la máquina.`,
    };
  }
  if (powerExceeded) {
    return {
      viable: false,
      reason: `Potencia requerida (${pc_kw.toFixed(2)} kW) supera el máximo de la máquina (${maxPower_kw} kW).`,
    };
  }
  if (torqueExceeded) {
    return {
      viable: false,
      reason: `Torque requerido (${mc_nm.toFixed(2)} Nm) supera el máximo de la máquina (${maxTorque_nm} Nm).`,
    };
  }
  return { viable: true, reason: null };
}
