import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  MAX_MACHINES, MIN_MACHINES, daysProblem, formatMachinesFreed, formatUtilization, machinesProblem, type MachineScaleResult,
} from '@/lib/machine-scale';

/**
 * Máquinas en paralelo (Escala Comercial). Dos piezas:
 *  - MachineScaleFields: los dos campos opcionales (pantalla).
 *  - MachineScaleSummary: el resultado, para la pantalla y la página 1 del PDF. Solo se renderiza si
 *    computeMachineScale devolvió un resultado; con "Máquinas en paralelo" vacío no existe en el DOM.
 */

export const MACHINE_SCALE_NOTE =
  'Las horas liberadas generan ahorro solo si se utilizan (más producción, menos horas extra o una máquina evitada).';

/** 176000 -> "176.000"; 7,5 -> "7,5" (punto de miles y coma decimal, como el resto de la app en español). */
const num = (n: number) => {
  const [entero, decimal] = String(Number.isInteger(n) ? n : Math.round(n * 10) / 10).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimal ? `${miles},${decimal}` : miles;
};

/** "Base: 1 máq. × 8 h × 1 turno × 22 días = 176 hs/mes disponibles (…)": con qué se calculó el porcentaje. */
export function machineScaleBasis(s: MachineScaleResult): string {
  const turnos = `${num(s.shiftsPerDay)} ${s.shiftsPerDay === 1 ? 'turno' : 'turnos'}`;
  return `Base: ${num(s.machines)} máq. × ${num(s.hoursPerShift)} h × ${turnos} × ${num(s.daysPerMonth)} días = ${num(s.hoursAvailable)} hs/mes disponibles (teórico: sin paradas ni mantenimiento)`;
}

interface FieldsProps {
  machines: string | number;
  onMachinesChange: (value: string | number) => void;
  days: string | number;
  onDaysChange: (value: string | number) => void;
  /** Horas por turno y turnos por día: solo los edita la pantalla nueva. La edición no los pasa y se usan los del caso guardado. */
  hoursPerShift?: string | number;
  onHoursPerShiftChange?: (value: string | number) => void;
  shiftsPerDay?: string | number;
  onShiftsPerDayChange?: (value: string | number) => void;
  /** Aviso corto cuando las horas por turno no permiten calcular (valores de la pantalla o guardados). */
  shiftNotice?: string | null;
}

interface FieldProps {
  label: string;
  testId: string;
  value: string | number;
  onChange: (value: string | number) => void;
  min: number;
  max: number;
  step: string;
  placeholder?: string;
  invalid?: boolean;
}

/**
 * Campo numérico con la etiqueta ENCIMA (nunca dentro del input): el texto tipeado y el placeholder no pueden
 * quedar tapados por la etiqueta, sea cual sea el ancho de la columna. Mismo estilo que los demás campos del
 * bloque (alto 44 px, texto en negrita, fondo blanco y texto oscuro explícitos, legibles también si se activa el tema oscuro).
 */
function NumberField({ label, testId, value, onChange, min, max, step, placeholder, invalid }: FieldProps) {
  const id = React.useId();
  return (
    <div className="min-w-0 flex flex-col justify-end">
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1 leading-tight">{label}</label>
      <Input
        id={id} data-testid={testId} type="number" min={min} max={max} step={step} placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        className={cn(
          'w-full h-11 px-3 text-base font-bold bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors focus:border-blue-400',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          invalid && 'border-red-500',
        )}
        value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
      />
    </div>
  );
}

const Notice = ({ testId, children }: { testId: string; children: React.ReactNode }) => (
  <p data-testid={testId} className="col-span-2 text-[10px] font-bold text-red-600 -mt-1">⚠ {children}</p>
);

export function MachineScaleFields({
  machines, onMachinesChange, days, onDaysChange,
  hoursPerShift, onHoursPerShiftChange, shiftsPerDay, onShiftsPerDayChange, shiftNotice,
}: FieldsProps) {
  const editsShifts = !!onHoursPerShiftChange && !!onShiftsPerDayChange;
  const machinesInUse = String(machines).trim() !== '';
  const machinesMsg = machinesProblem(machines);
  const daysMsg = daysProblem(days, machinesInUse);

  return (
    <div data-testid="escala-maquinas-campos" className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
      <NumberField label="Máquinas en paralelo" testId="escala-input-maquinas" value={machines} onChange={onMachinesChange}
        min={MIN_MACHINES} max={MAX_MACHINES} step="1" placeholder="Opcional" invalid={!!machinesMsg} />
      {editsShifts && (<>
        <NumberField label="Horas por turno" testId="escala-input-horas" value={hoursPerShift ?? ''} onChange={onHoursPerShiftChange!}
          min={1} max={24} step="any" invalid={!!shiftNotice} />
        <NumberField label="Turnos por día" testId="escala-input-turnos" value={shiftsPerDay ?? ''} onChange={onShiftsPerDayChange!}
          min={1} max={5} step="1" invalid={!!shiftNotice && shiftNotice.includes('×')} />
      </>)}
      <NumberField label="Días de trabajo por mes" testId="escala-input-dias" value={days} onChange={onDaysChange}
        min={1} max={31} step="1" invalid={!!daysMsg} />
      {machinesMsg && <Notice testId="escala-aviso-maquinas">{machinesMsg}</Notice>}
      {editsShifts && shiftNotice && <Notice testId="escala-aviso-turnos">{shiftNotice}</Notice>}
      {daysMsg && <Notice testId="escala-aviso-dias">{daysMsg}</Notice>}
      {!editsShifts && shiftNotice && <Notice testId="escala-maquinas-aviso">{shiftNotice}</Notice>}
      <p className="col-span-2 text-[10px] text-slate-400">
        Las horas por turno, los turnos por día y los días de trabajo definen las horas disponibles por máquina. Opcional: con las máquinas en paralelo se muestra la utilización teórica y las máquinas evitadas.
      </p>
    </div>
  );
}

export function MachineScaleSummary({ scale, variant }: { scale: MachineScaleResult; variant: 'screen' | 'pdf' }) {
  const freed = formatMachinesFreed(scale.machinesFreed);
  const pdf = variant === 'pdf';
  const warn = <span className="font-black text-red-600 uppercase"> ⚠ capacidad insuficiente</span>;

  return (
    <div
      data-testid="escala-maquinas-resultado"
      className={pdf
        ? 'mt-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5'
        : 'mt-2 p-2 rounded-lg bg-blue-50/60 border border-blue-100 space-y-0.5 text-[10px]'}
    >
      <p className={pdf ? 'text-[10px] text-slate-600' : 'text-slate-700'}>
        Utilización teórica: <span className="text-red-600 font-bold">{formatUtilization(scale.utilizationCurrent)}</span>
        {scale.insufficientCurrent && warn}
        {' → '}
        <span className="text-green-700 font-bold">{formatUtilization(scale.utilizationProposed)}</span>
        {scale.insufficientProposed && warn}
      </p>
      <p className={pdf ? 'text-[10px] text-slate-600' : 'text-slate-700'}>
        Máquinas necesarias: <span className="text-red-600 font-bold">{scale.machinesNeededCurrent}</span>
        {' → '}
        <span className="text-green-700 font-bold">{scale.machinesNeededProposed}</span>
      </p>
      {freed && (
        <p className={pdf ? 'text-[10px] font-black text-emerald-700' : 'text-emerald-700 font-bold'}>
          ≈ {freed} máquinas equivalentes liberadas
        </p>
      )}
      <p className={pdf ? 'text-[9px] text-slate-500' : 'text-slate-500'}>{machineScaleBasis(scale)}</p>
      <p className={pdf ? 'text-[9px] text-slate-400 italic' : 'text-slate-400 italic'}>{MACHINE_SCALE_NOTE}</p>
    </div>
  );
}
