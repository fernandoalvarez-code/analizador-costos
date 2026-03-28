import React from 'react';

interface MonthlySavingsProps {
  monthlyVolume: number;
  compToolCost: number;   // Costo de inserto puro por pieza (Competidor)
  secoToolCost: number;   // Costo de inserto puro por pieza (Secocut)
  compMachineCost: number; // Costo de tiempo de máquina por pieza (Competidor)
  secoMachineCost: number; // Costo de tiempo de máquina por pieza (Secocut)
}

export function MonthlySavingsSummary({
  monthlyVolume = 1000, // Valor por defecto si no se especifica
  compToolCost,
  secoToolCost,
  compMachineCost,
  secoMachineCost
}: MonthlySavingsProps) {
  
  // 1. Cálculos de Herramientas (Compras)
  const compTotalTool = compToolCost * monthlyVolume;
  const secoTotalTool = secoToolCost * monthlyVolume;
  const toolSavings = compTotalTool - secoTotalTool; 
  // Si toolSavings es negativo, Secocut es más caro en la factura de compras.

  // 2. Cálculos de Tiempo de Máquina (Producción)
  const compTotalMachine = compMachineCost * monthlyVolume;
  const secoTotalMachine = secoMachineCost * monthlyVolume;
  const machineSavings = compTotalMachine - secoTotalMachine;

  // 3. Ahorro Neto Total
  const netSavings = toolSavings + machineSavings;

  // Formateador de moneda
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="mt-8 border-t border-slate-200 pt-6 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-bold text-slate-800 mb-4">
        Proyección de Ahorro Mensual (Base: {monthlyVolume} piezas)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Tarjeta 1: Diferencia en Herramientas */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-500 font-semibold">1. Impacto en Compras</p>
            <p className="text-xs text-slate-400 leading-tight mt-1">Diferencia en gasto de insertos</p>
          </div>
          <div className="mt-4">
            <span className={`text-2xl font-bold tracking-tight ${toolSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {toolSavings > 0 ? '+' : ''}{formatCurrency(toolSavings)}
            </span>
          </div>
        </div>

        {/* Tarjeta 2: Ahorro en Máquina */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-500 font-semibold">2. Impacto en Producción</p>
            <p className="text-xs text-slate-400 leading-tight mt-1">Ahorro en horas máquina y operador</p>
          </div>
          <div className="mt-4">
            <span className={`text-2xl font-bold tracking-tight ${machineSavings >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
              {machineSavings > 0 ? '+' : ''}{formatCurrency(machineSavings)}
            </span>
          </div>
        </div>

        {/* Tarjeta 3: Ahorro TOTAL NETO */}
        <div className={`p-4 rounded-xl border-2 flex flex-col justify-between ${netSavings >= 0 ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50'}`}>
          <div>
            <p className={`text-sm font-bold ${netSavings >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              3. AHORRO NETO TOTAL
            </p>
            <p className={`text-xs mt-1 font-medium ${netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Impacto financiero final
            </p>
          </div>
          <div className="mt-4">
            <span className={`text-3xl font-black tracking-tight ${netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netSavings > 0 ? '+' : ''}{formatCurrency(netSavings)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
