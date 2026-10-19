/**
 * Escala por máquinas en paralelo (Escala Comercial de la curva de costos).
 *
 * Función PURA: toma las horas requeridas que ya calcula la app (actual y propuesta) y las compara con la
 * capacidad teórica de N máquinas en paralelo. No toca el costo por pieza, el ahorro mensual ni ninguna
 * fórmula de la curva. Devuelve `null` si "Máquinas en paralelo" está vacío o si algún dato es inválido:
 * en ese caso la interfaz y el PDF no muestran nada nuevo.
 *
 *   horas por máquina  = Horas por turno × Turnos por día × días/mes
 *   horas disponibles  = N × horas por máquina
 *   utilización        = horas requeridas / horas disponibles       (teórica: sin paradas ni mantenimiento)
 *   máquinas necesarias = techo(horas requeridas / horas por máquina)
 *   máquinas liberadas  = (horas actual − horas propuesta) / horas por máquina
 */

export interface MachineScaleInput {
  /** Horas/mes requeridas con la condición actual (sin redondear). */
  hrsComp: number;
  /** Horas/mes requeridas con la propuesta (sin redondear). */
  hrsSeco: number;
  /** "Máquinas en paralelo": entero ≥ 1. Vacío = función apagada. */
  machines: string | number | null | undefined;
  hoursPerShift: string | number | null | undefined;
  shiftsPerDay: string | number | null | undefined;
  daysPerMonth: string | number | null | undefined;
}

export interface MachineScaleResult {
  machines: number;
  hoursPerShift: number;
  shiftsPerDay: number;
  daysPerMonth: number;
  /** Capacidad teórica de UNA máquina (hs/mes). */
  hoursPerMachine: number;
  /** Capacidad teórica de las N máquinas (hs/mes). */
  hoursAvailable: number;
  /** Fracción: 1,5 = 150 %. */
  utilizationCurrent: number;
  utilizationProposed: number;
  machinesNeededCurrent: number;
  machinesNeededProposed: number;
  /** Puede ser 0 o negativo si la propuesta no libera horas. */
  machinesFreed: number;
  /** Utilización > 100 %: la capacidad no alcanza. */
  insufficientCurrent: boolean;
  insufficientProposed: boolean;
}

/** Margen para que unas horas que coinciden con la capacidad (salvo ruido de coma flotante) no sumen una máquina de más. */
const CEIL_EPSILON = 1e-9;

const MAX_DAYS_PER_MONTH = 31;

/** "Máquinas en paralelo": entero entre 1 y 100. */
export const MIN_MACHINES = 1;
export const MAX_MACHINES = 100;

/** Un día no tiene más de 24 horas: Horas por turno entre 1 y 24 y Horas por turno × Turnos por día no mayor a 24. */
export const MIN_HOURS_PER_SHIFT = 1;
export const MAX_HOURS_PER_DAY = 24;

/** Número de un campo de formulario: acepta números y textos numéricos; todo lo demás es inválido. */
function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Mensaje corto si las horas por turno / turnos por día cargados no son posibles (8445 h por turno, 4 turnos de 8 h…),
 * o null si están bien o no están cargados (vacío no es un error: la app usa 8 y 1 por defecto, como siempre).
 * Lo usan la tarjeta de máquinas, el aviso junto al campo y la caja de productividad.
 */
export function shiftHoursProblem(
  hoursPerShift: string | number | null | undefined,
  shiftsPerDay: string | number | null | undefined,
): string | null {
  const h = toNumber(hoursPerShift);
  if (h === null) return null;
  if (h < MIN_HOURS_PER_SHIFT || h > MAX_HOURS_PER_DAY) return `Horas por turno debe estar entre ${MIN_HOURS_PER_SHIFT} y ${MAX_HOURS_PER_DAY}.`;
  const t = toNumber(shiftsPerDay);
  if (t !== null && t > 0 && h * t > MAX_HOURS_PER_DAY) return `Horas por turno × Turnos por día no puede superar ${MAX_HOURS_PER_DAY} h.`;
  return null;
}

/** Mensaje corto si "Máquinas en paralelo" está cargado pero no es un entero entre 1 y 100. Vacío no es un error: la función está apagada. */
export function machinesProblem(machines: string | number | null | undefined): string | null {
  if (typeof machines === 'string' ? machines.trim() === '' : machines === null || machines === undefined) return null;
  const n = toNumber(machines);
  if (n === null || !Number.isInteger(n) || n < MIN_MACHINES || n > MAX_MACHINES) return `Máquinas en paralelo: entero entre ${MIN_MACHINES} y ${MAX_MACHINES}.`;
  return null;
}

/**
 * Mensaje corto si los días de trabajo por mes no sirven: cargados fuera de 1–31, o vacíos mientras las máquinas
 * en paralelo están en uso (sin días no se puede calcular). Con la función apagada y el campo vacío no hay mensaje.
 */
export function daysProblem(days: string | number | null | undefined, machinesInUse: boolean): string | null {
  const vacio = typeof days === 'string' ? days.trim() === '' : days === null || days === undefined;
  if (vacio) return machinesInUse ? `Días/Mes: entre 1 y ${MAX_DAYS_PER_MONTH}.` : null;
  const n = toNumber(days);
  if (n === null || n < 1 || n > MAX_DAYS_PER_MONTH) return `Días/Mes: entre 1 y ${MAX_DAYS_PER_MONTH}.`;
  return null;
}

export function computeMachineScale(input: MachineScaleInput): MachineScaleResult | null {
  const machines = toNumber(input.machines);
  if (machines === null || !Number.isInteger(machines) || machines < MIN_MACHINES || machines > MAX_MACHINES) return null;

  const hoursPerShift = toNumber(input.hoursPerShift);
  const shiftsPerDay = toNumber(input.shiftsPerDay);
  const daysPerMonth = toNumber(input.daysPerMonth);
  if (hoursPerShift === null || hoursPerShift <= 0) return null;
  if (shiftsPerDay === null || shiftsPerDay <= 0) return null;
  if (shiftHoursProblem(hoursPerShift, shiftsPerDay) !== null) return null;
  if (daysPerMonth === null || daysPerMonth <= 0 || daysPerMonth > MAX_DAYS_PER_MONTH) return null;

  const { hrsComp, hrsSeco } = input;
  if (!Number.isFinite(hrsComp) || !Number.isFinite(hrsSeco) || hrsComp <= 0 || hrsSeco <= 0) return null;

  const hoursPerMachine = hoursPerShift * shiftsPerDay * daysPerMonth;
  const hoursAvailable = machines * hoursPerMachine;
  const needed = (hrs: number) => Math.max(1, Math.ceil(hrs / hoursPerMachine - CEIL_EPSILON));

  const utilizationCurrent = hrsComp / hoursAvailable;
  const utilizationProposed = hrsSeco / hoursAvailable;

  return {
    machines, hoursPerShift, shiftsPerDay, daysPerMonth, hoursPerMachine, hoursAvailable,
    utilizationCurrent, utilizationProposed,
    machinesNeededCurrent: needed(hrsComp),
    machinesNeededProposed: needed(hrsSeco),
    machinesFreed: (hrsComp - hrsSeco) / hoursPerMachine,
    insufficientCurrent: utilizationCurrent > 1,
    insufficientProposed: utilizationProposed > 1,
  };
}

// ── Formato (compartido por la pantalla y el PDF) ────────────────────────────────────────────────

/** 1,985 -> "199 %". */
export function formatUtilization(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/** Menor valor de "máquinas liberadas" que se muestra: por debajo, con un decimal sería "0,0". */
export const MIN_MACHINES_FREED_SHOWN = 0.05;

/** 0,639 -> "0,6" (coma decimal, como el resto de la app). Devuelve null si no hay nada que mostrar. */
export function formatMachinesFreed(machinesFreed: number): string | null {
  if (!(machinesFreed >= MIN_MACHINES_FREED_SHOWN)) return null;
  return machinesFreed.toFixed(1).replace('.', ',');
}
