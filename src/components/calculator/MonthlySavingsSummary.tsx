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
  disableAnimation?: boolean;
  toolChangeTime?: number;
  compPiecesPerEdge?: number;
  secoPiecesPerEdge?: number;
  compact?: boolean;
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
  turnosPorDia = 1,
  disableAnimation = false,
  toolChangeTime = 0,
  compPiecesPerEdge = 0,
  secoPiecesPerEdge = 0,
  compact = false
}: MonthlySavingsProps) {

  // 1. Cálculos de Costos Totales
  const compTotalCostPerPiece = compToolCost + compMachineCost;
  const secoTotalCostPerPiece = secoToolCost + secoMachineCost;
  const totalPieceSavings = compTotalCostPerPiece - secoTotalCostPerPiece;
  const percentageSavings = compTotalCostPerPiece > 0 ? (totalPieceSavings / compTotalCostPerPiece) * 100 : 0;

  const compTotalMonthly = compTotalCostPerPiece * monthlyVolume;
  const secoTotalMonthly = secoTotalCostPerPiece * monthlyVolume;
  const netSavings = compTotalMonthly - secoTotalMonthly;

  // 2. Cálculos de Productividad (ciclo efectivo: corte + cambio de filo prorrateado)
  const compChangePerPiece = toolChangeTime > 0 && compPiecesPerEdge > 0 ? toolChangeTime / compPiecesPerEdge : 0;
  const secoChangePerPiece = toolChangeTime > 0 && secoPiecesPerEdge > 0 ? toolChangeTime / secoPiecesPerEdge : 0;
  const compCycleTime = compTime + compChangePerPiece;
  const secoCycleTime = secoTime + secoChangePerPiece;
  const compPcsHr = compCycleTime > 0 ? 60 / compCycleTime : 0;
  const secoPcsHr = secoCycleTime > 0 ? 60 / secoCycleTime : 0;
  const extraPcsHr = secoPcsHr - compPcsHr;
  const extraPcsShift = extraPcsHr * horasPorTurno;
  const extraPcsDay = extraPcsShift * turnosPorDia;

  // Formateos
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const isWinner = percentageSavings > 0;

  // Escala compacta (para el PDF): mismos datos, menor tamaño.
  // Los valores no-compact son idénticos a los actuales → la app no cambia.
  const heroPad  = compact ? 'p-3'      : 'p-6 md:p-8';
  const heroGap  = compact ? 'gap-3'    : 'gap-6';
  const pctGap   = compact ? 'gap-2'    : 'gap-4';
  const pctSize  = compact ? 'text-3xl' : 'text-6xl md:text-7xl';
  const iconWrap = compact ? 'w-8 h-8'  : 'w-12 h-12';
  const iconSize = compact ? 'w-4 h-4'  : 'w-6 h-6';
  const redLabel = compact ? 'text-[10px] px-2 py-0.5' : 'text-base md:text-lg px-4 py-1.5';
  const netCard  = compact ? 'p-3 md:min-w-[200px]'    : 'p-5 min-w-full md:min-w-[280px]';
  const netLabel = compact ? 'text-[9px]' : 'text-xs';
  const netSize  = compact ? 'text-2xl'   : 'text-4xl md:text-5xl';
  const cellPad  = compact ? 'p-3'        : 'p-6';
  const headMb   = compact ? 'mb-2'       : 'mb-6';
  const h3Size   = compact ? 'text-[9px]' : 'text-xs';
  const finCard  = compact ? 'p-2'        : 'p-4';
  const finLabel = compact ? 'text-[9px]' : 'text-[10px]';
  const compSize = compact ? 'text-sm'    : 'text-xl';
  const secoSize = compact ? 'text-base'  : 'text-2xl';
  const divH     = compact ? 'h-6'        : 'h-10';
  const prodCard = compact ? 'p-2'        : 'p-3';
  const prodSize = compact ? 'text-lg'    : 'text-2xl';

  return (
    <div className={`mt-8 rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-500 ${disableAnimation ? '' : 'animate-in fade-in slide-in-from-bottom-4'} border-2 ${isWinner ? 'border-emerald-500/50 shadow-emerald-500/20 bg-gradient-to-br from-emerald-900 to-emerald-950' : 'border-rose-500/50 shadow-rose-500/20 bg-gradient-to-br from-rose-900 to-rose-950'}`}>

      {/* Background Decorator */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-10 pointer-events-none">
        <DollarSign className="w-64 h-64 text-white" />
      </div>

      {/* Hero Header */}
      <div className={`${heroPad} relative z-10 text-center md:text-left border-b border-white/10`}>
        <h2 className="text-white/60 font-extrabold uppercase tracking-widest text-[10px] md:text-xs mb-2">Impacto Económico Total</h2>

        <div className={`flex flex-col md:flex-row items-center justify-between ${heroGap}`}>
          <div className="flex-1 text-center md:text-left">
             <div className={`flex items-center justify-center md:justify-start ${pctGap} mb-2`}>
                <span className={`${pctSize} font-black text-white tracking-tighter drop-shadow-lg`}>
                  {isWinner ? '-' : '+'}{Math.abs(percentageSavings).toFixed(1)}%
                </span>
                <div className={`${iconWrap} rounded-full flex items-center justify-center shrink-0 ${isWinner ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                   {isWinner ? <TrendingDown className={iconSize} /> : <TrendingUp className={iconSize} />}
                </div>
             </div>
             <p className={`text-white/80 ${redLabel} font-medium inline-block bg-white/5 rounded-full border border-white/10`}>
               {isWinner ? '¡De reducción en el Costo por Pieza!' : 'De aumento en el Costo por Pieza'}
             </p>
          </div>

          <div className={`bg-white/10 backdrop-blur-md rounded-xl ${netCard} border border-white/20 text-center shadow-inner`}>
            <p className={`text-white/70 ${netLabel} font-semibold uppercase tracking-wider mb-1 flex items-center justify-center gap-1`}><DollarSign className="w-3 h-3"/> Ahorro Mensual Neto</p>
            <p className={`${netSize} font-black tracking-tight ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
               {isWinner ? '+' : ''}{formatCurrency(netSavings)}
            </p>
            <p className="text-white/50 text-[10px] mt-2 font-medium">Basado en un lote de {monthlyVolume.toLocaleString()} piezas</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 bg-black/20 relative z-10">

         {/* Economic Breakdown */}
         <div className={`${cellPad} border-b md:border-b-0 md:border-r border-white/10`}>
           <div className={`flex items-center justify-center md:justify-start gap-2 ${headMb}`}>
              <DollarSign className="w-4 h-4 text-white/50" />
              <h3 className={`text-white font-bold ${h3Size} uppercase tracking-wider`}>Desglose Financiero por Pieza</h3>
           </div>

           <div className={`flex items-end justify-between bg-white/5 rounded-lg border border-white/10 ${finCard}`}>
               <div className="text-center md:text-left">
                  <p className={`text-white/50 ${finLabel} font-bold uppercase tracking-wider mb-1`}>Costo Competidor</p>
                  <p className={`text-white font-mono ${compSize}`}>{formatCurrency(compTotalCostPerPiece)}</p>
               </div>
               <div className={`${divH} w-px bg-white/10 hidden md:block`}></div>
               <div className="text-center md:text-right">
                  <p className={`text-white/50 ${finLabel} font-bold uppercase tracking-wider mb-1`}>Costo Secocut</p>
                  <p className={`font-mono ${secoSize} font-black ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(secoTotalCostPerPiece)}</p>
               </div>
           </div>
         </div>

         {/* Productivity Explosion */}
         <div className={`${cellPad} relative overflow-hidden flex flex-col justify-center`}>
           {isWinner && extraPcsHr > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none"><Zap className="w-64 h-64 text-orange-400" /></div>}

           <div className={`flex items-center justify-center md:justify-start gap-2 ${headMb} relative z-10`}>
              <Factory className="w-4 h-4 text-orange-400" />
              <h3 className={`text-white font-bold ${h3Size} uppercase tracking-wider`}>Explosión de Productividad</h3>
           </div>

           {extraPcsHr > 0 ? (
             <div className="relative z-10 w-full">
                <div className="flex items-stretch gap-2">
                  <div className={`bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl ${prodCard} text-center flex-1 shadow-inner`}>
                    <p className={`${prodSize} font-black text-orange-400 drop-shadow-sm`}>+{extraPcsHr.toFixed(1)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Hora</p>
                  </div>
                  <div className={`bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl ${prodCard} text-center flex-1 shadow-inner`}>
                    <p className={`${prodSize} font-black text-orange-400 drop-shadow-sm`}>+{Math.floor(extraPcsShift)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Trn ({horasPorTurno}h)</p>
                  </div>
                  <div className={`bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl ${prodCard} text-center flex-1 shadow-inner relative overflow-hidden ring-1 ring-orange-500/50`}>
                    <div className="absolute top-0 right-0 px-1 py-0.5 bg-orange-500 text-white text-[7px] font-black uppercase rounded-bl-sm">Día</div>
                    <p className={`${prodSize} font-black text-orange-400 drop-shadow-sm`}>+{Math.floor(extraPcsDay)}</p>
                    <p className="text-[8px] text-orange-200/80 font-bold uppercase tracking-widest mt-1">Pzas / Día</p>
                  </div>
                </div>
                <p className="text-[8px] text-white/40 mt-2 text-center md:text-left italic">* Capacidad teórica adicional a utilización 100% de máquina.</p>
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
