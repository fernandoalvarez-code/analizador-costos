import React from 'react';
import { Input } from '@/components/ui/input';
import { formatMachinesFreed, formatUtilization, type MachineScaleResult } from '@/lib/machine-scale';

/**
 * Máquinas en paralelo (Escala Comercial). Dos piezas:
 *  - MachineScaleFields: los dos campos opcionales (pantalla).
 *  - MachineScaleSummary: el resultado, para la pantalla y la página 1 del PDF. Solo se renderiza si
 *    computeMachineScale devolvió un resultado; con "Máquinas en paralelo" vacío no existe en el DOM.
 */

export const MACHINE_SCALE_NOTE =
  'Las horas liberadas generan ahorro solo si se utilizan (más producción, menos horas extra o una máquina evitada).';

const num = (n: number) => String(Number.isInteger(n) ? n : Math.round(n * 10) / 10).replace('.', ',');

/** "Base: 1 máq. × 8 h × 1 turno × 22 días = 176 hs/mes disponibles (…)": con qué se calculó el porcentaje. */
export function machineScaleBasis(s: MachineScaleResult): string {
  const turnos = `${num(s.shiftsPerDay)} ${s.shiftsPerDay === 1 ? 'turno' : 'turnos'}`;
  return `Base: ${s.machines} máq. × ${num(s.hoursPerShift)} h × ${turnos} × ${num(s.daysPerMonth)} días = ${num(s.hoursAvailable)} hs/mes disponibles (teórico: sin paradas ni mantenimiento)`;
}

interface FieldsProps {
  machines: string | number;
  onMachinesChange: (value: string | number) => void;
  days: string | number;
  onDaysChange: (value: string | number) => void;
}

export function MachineScaleFields({ machines, onMachinesChange, days, onDaysChange }: FieldsProps) {
  return (
    <div data-testid="escala-maquinas-campos" className="mt-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Input
            type="number" min="1" step="1" placeholder="Opcional" aria-label="Máquinas en paralelo"
            className="w-full text-base font-bold pl-3 pr-16 h-11 bg-white text-slate-900 transition-colors focus:border-blue-400"
            value={machines} onChange={(e) => onMachinesChange(e.target.value ? Number(e.target.value) : '')}
          />
          <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Máq. en paralelo</span>
        </div>
        <div className="relative">
          <Input
            type="number" min="1" max="31" aria-label="Días de trabajo por mes"
            className="w-full text-base font-bold pl-3 pr-16 h-11 bg-white text-slate-900 transition-colors focus:border-blue-400"
            value={days} onChange={(e) => onDaysChange(e.target.value ? Number(e.target.value) : '')}
          />
          <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Días/Mes</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        Opcional. Con las máquinas en paralelo se muestra la utilización teórica y las máquinas evitadas. Los días de trabajo solo se usan en ese cálculo.
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
