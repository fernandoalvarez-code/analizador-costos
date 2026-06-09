import React from 'react';
import { TrendingDown, TrendingUp, DollarSign, Zap, Factory } from 'lucide-react';

interface MonthlySavingsProps {
  monthlyVolume: number;
  compToolCost: number;
  secoToolCost: number;
  compMachineCost: number;
  secoMachineCost: number;
  compTime: number; 
  secoTime: number; 
  horasPorTurno?: number;
  turnosPorDia?: number;
}

export function MonthlySavingsSummary({
  monthlyVolume = 1000,
  compToolCost,
  secoToolCost,
  compMachineCost,
  secoMachineCost,
  compTime,
  secoTime,
  horasPorTurno = 8,
  turnosPorDia = 1
}: MonthlySavingsProps) {
  
  // 1. Cálculos de Costos Totales
  const compTotalCostPerPiece = compToolCost + compMachineCost;
  const secoTotalCostPerPiece = secoToolCost + secoMachineCost;
  const totalPieceSavings = compTotalCostPerPiece - secoTotalCostPerPiece;
  const percentageSavings = compTotalCostPerPiece > 0 ? (totalPieceSavings / compTotalCostPerPiece) * 100 : 0;
  
  const compTotalMonthly = compTotalCostPerPiece * monthlyVolume;
  const secoTotalMonthly = secoTotalCostPerPiece * monthlyVolume;
  const netSavings = compTotalMonthly - secoTotalMonthly;

  // 2. Cálculos de Productividad
  const compPcsHr = compTime > 0 ? 60 / compTime : 0;
  const secoPcsHr = secoTime > 0 ? 60 / secoTime : 0;
  const extraPcsHr = secoPcsHr - compPcsHr;
  const extraPcsShift = extraPcsHr * horasPorTurno; 
  const extraPcsDay = extraPcsShift * turnosPorDia;

  // Formateos
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const isWinner = percentageSavings > 0;

  return (
    <div className={`mt-8 rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 border-2 ${isWinner ? 'border-emerald-500/50 shadow-emerald-500/20 bg-gradient-to-br from-emerald-900 to-emerald-950' : 'border-rose-500/50 shadow-rose-500/20 bg-gradient-to-br from-rose-900 to-rose-950'}`}>
      
      {/* Background Decorator */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-10 pointer-events-none">
        <DollarSign className="w-64 h-64 text-white" />
      </div>

      {/* Hero Header */}
      <div className="p-6 md:p-8 relative z-10 text-center md:text-left border-b border-white/10">
        <h2 className="text-white/60 font-extrabold uppercase tracking-widest text-[10px] md:text-xs mb-2">Impacto Económico Total</h2>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 text-center md:text-left">
             <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                <span className={`text-6xl md:text-7xl font-black text-white tracking-tighter drop-shadow-lg`}>
                  {isWinner ? '-' : '+'}{Math.abs(percentageSavings).toFixed(1)}%
                </span>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isWinner ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                   {isWinner ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                </div>
             </div>
             <p className="text-white/80 text-base md:text-lg font-medium inline-block bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
               {isWinner ? '¡De reducción en el Costo por Pieza!' : 'De aumento en el Costo por Pieza'}
             </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 min-w-full md:min-w-[280px] text-center shadow-inner">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3"/> Ahorro Mensual Neto</p>
            <p className={`text-4xl md:text-5xl font-black tracking-tight ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
               {isWinner ? '+' : ''}{formatCurrency(netSavings)}
            </p>
            <p className="text-white/50 text-[10px] mt-2 font-medium">Basado en un lote de {monthlyVolume.toLocaleString()} piezas</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 bg-black/20 relative z-10">
         
         {/* Economic Breakdown */}
         <div className="p-6 border-b md:border-b-0 md:border-r border-white/10">
           <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
              <DollarSign className="w-4 h-4 text-white/50" />
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Desglose Financiero por Pieza</h3>
           </div>
           
           <div className="flex items-end justify-between bg-white/5 rounded-lg border border-white/10 p-4">
               <div className="text-center md:text-left">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">Costo Competidor</p>
                  <p className="text-white font-mono text-xl">{formatCurrency(compTotalCostPerPiece)}</p>
               </div>
               <div className="h-10 w-px bg-white/10 hidden md:block"></div>
               <div className="text-center md:text-right">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">Costo Secocut</p>
                  <p className={`font-mono text-2xl font-black ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(secoTotalCostPerPiece)}</p>
               </div>
           </div>
         </div>

         {/* Productivity Explosion */}
         <div className="p-6 relative overflow-hidden flex flex-col justify-center">
           {isWinner && extraPcsHr > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none"><Zap className="w-64 h-64 text-orange-400" /></div>}
           
           <div className="flex items-center justify-center md:justify-start gap-2 mb-6 relative z-10">
              <Factory className="w-4 h-4 text-orange-400" />
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Explosión de Productividad</h3>
           </div>
           
           {extraPcsHr > 0 ? (
             <div className="relative z-10 w-full">
                <div className="flex items-stretch gap-2">
                  <div className="bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl p-3 text-center flex-1 shadow-inner">
                    <p className="text-2xl font-black text-orange-400 drop-shadow-sm">+{extraPcsHr.toFixed(1)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Hora</p>
                  </div>
                  <div className="bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl p-3 text-center flex-1 shadow-inner">
                    <p className="text-2xl font-black text-orange-400 drop-shadow-sm">+{Math.floor(extraPcsShift)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Trn ({horasPorTurno}h)</p>
                  </div>
                  <div className="bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl p-3 text-center flex-1 shadow-inner relative overflow-hidden ring-1 ring-orange-500/50">
                    <div className="absolute top-0 right-0 px-1 py-0.5 bg-orange-500 text-white text-[7px] font-black uppercase rounded-bl-sm">Día</div>
                    <p className="text-2xl font-black text-orange-400 drop-shadow-sm">+{Math.floor(extraPcsDay)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Día</p>
                  </div>
                </div>
             </div>
           ) : (
             <div className="flex items-center justify-center h-full">
                <p className="text-white/40 text-xs italic">La ganancia es económica, no de tiempos de producción.</p>
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
