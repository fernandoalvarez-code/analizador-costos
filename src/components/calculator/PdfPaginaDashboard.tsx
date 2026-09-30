import React from 'react';
import { MonthlySavingsSummary } from './MonthlySavingsSummary';
import { PdfFooter } from './PdfFooter';
import { formatCurrency, formatNumber } from '@/lib/formatters';

interface PdfPaginaDashboardProps {
  logos: { company: string; brand: string };
  saveClientName: string;
  pieceName: string;
  curveDataInfo: any;
  monthlyProduction: string | number;
  tcCurrent: string | number;
  tcPremiumInput: string | number;
  toolChangeTime: string | number;
  horasPorTurno: string | number;
  turnosPorDia: string | number;
  capacityCheck: { hrsComp: number; hrsSeco: number; hrsLiberadas: number } | null;
  pageNumber: number;
  totalPages: number;
}

// Página 1 del PDF exportable: dashboard ejecutivo. Es exactamente el contenido
// que antes vivía en la mitad inferior de la vieja página 2 (MonthlySavingsSummary
// + "Proyección de Ahorro Mensual" + línea de capacidad), movido acá para que el
// resultado económico sea lo primero que se lee — ningún número se recalcula.
// El header "de tapa" (los dos logos grandes, título, cliente y fecha) también se
// mudó para acá desde la vieja página 1, porque esta es ahora la portada del informe.
export function PdfPaginaDashboard({
  logos, saveClientName, pieceName, curveDataInfo, monthlyProduction,
  tcCurrent, tcPremiumInput, toolChangeTime, horasPorTurno, turnosPorDia,
  capacityCheck, pageNumber, totalPages,
}: PdfPaginaDashboardProps) {
  return (
    <div id="pdf-pagina-1" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">

      <div className="relative mb-8 pb-4 border-b-2 border-slate-800">
        <div className="flex justify-between items-start mb-8 h-16">
          {logos.company ? <img src={logos.company} alt="Logo Empresa" crossOrigin="anonymous" className="h-full object-contain max-w-[250px] object-left" /> : <div className="h-12 flex items-center justify-center bg-blue-600 text-white font-black px-4 rounded text-lg">SECOCUT</div>}
          {logos.brand ? <img src={logos.brand} alt="Logo Marca" crossOrigin="anonymous" className="h-full object-contain max-w-[200px] object-right" /> : <div className="h-12 flex items-center justify-center text-slate-800 font-black text-3xl">Seco</div>}
        </div>

        <div className="text-center mb-10 mt-4">
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Análisis de Curva de Costos</h1>
        </div>

        <div className="flex justify-between items-end">
          <h2 className="text-2xl font-bold text-blue-600">{saveClientName || pieceName || 'Reporte de Análisis'}</h2>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Informe Técnico</p>
            <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
        <p className="text-right text-xs font-bold text-slate-500 mt-1">Página {pageNumber} de {totalPages}</p>
      </div>

      {/* Impacto Económico Total + Explosión de Productividad — mismo panel que la app (sin recalcular) */}
      {isFinite(curveDataInfo.monthlySavings) && Number(monthlyProduction) > 0 && (
        <MonthlySavingsSummary
          disableAnimation
          compact
          monthlyVolume={Number(monthlyProduction)}
          compToolCost={curveDataInfo.desgloseActualReal.inserto}
          secoToolCost={curveDataInfo.desglosePremiumReal.inserto}
          compMachineCost={curveDataInfo.desgloseActualReal.maquina + curveDataInfo.desgloseActualReal.parada}
          secoMachineCost={curveDataInfo.desglosePremiumReal.maquina + curveDataInfo.desglosePremiumReal.parada}
          compTime={Number(tcCurrent)}
          secoTime={Number(tcPremiumInput)}
          toolChangeTime={Number(toolChangeTime) || 0}
          compPiecesPerEdge={curveDataInfo.effectivePcsCurrent}
          secoPiecesPerEdge={curveDataInfo.effectivePcsPremium}
          horasPorTurno={Number(horasPorTurno) || 8}
          turnosPorDia={Number(turnosPorDia) || 1}
        />
      )}

      {isFinite(curveDataInfo.monthlySavings) && Number(monthlyProduction) > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">
            1. Proyección de Ahorro Mensual (Base: {formatNumber(Number(monthlyProduction))} piezas)
          </h2>

          {(() => {
            const vol = Number(monthlyProduction) || 0;
            const compTool = curveDataInfo.desgloseActualReal.inserto * vol;
            const secoTool = curveDataInfo.desglosePremiumReal.inserto * vol;
            const toolSavings = compTool - secoTool;

            const compMach = (curveDataInfo.desgloseActualReal.maquina + curveDataInfo.desgloseActualReal.parada) * vol;
            const secoMach = (curveDataInfo.desglosePremiumReal.maquina + curveDataInfo.desglosePremiumReal.parada) * vol;
            const machineSavings = compMach - secoMach;

            const netSavings = toolSavings + machineSavings;

            return (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 font-bold mb-1">1. Impacto en Compras</p>
                  <p className="text-[9px] text-slate-400 leading-tight mb-2">Diferencia en gasto de insertos</p>
                  <p className={`text-xl font-black tracking-tight ${toolSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {toolSavings > 0 ? '+' : ''}{formatCurrency(toolSavings)}
                  </p>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 font-bold mb-1">2. Impacto en Producción</p>
                  <p className="text-[9px] text-slate-400 leading-tight mb-2">Ahorro en horas máquina y operador</p>
                  <p className={`text-xl font-black tracking-tight ${machineSavings >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {machineSavings > 0 ? '+' : ''}{formatCurrency(machineSavings)}
                  </p>
                </div>
                <div className={`p-3 border-2 rounded-lg ${netSavings >= 0 ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
                  <p className={`text-xs font-bold mb-1 ${netSavings >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>3. AHORRO NETO TOTAL</p>
                  <p className={`text-[9px] leading-tight mb-2 ${netSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Impacto financiero final</p>
                  <p className={`text-2xl font-black tracking-tight ${netSavings >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {netSavings > 0 ? '+' : ''}{formatCurrency(netSavings)}
                  </p>
                </div>
              </div>
            );
          })()}
          {capacityCheck && (
            <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-600">
                Capacidad requerida: <span className="text-red-600 font-bold">{capacityCheck.hrsComp.toLocaleString()} hs/mes</span> (actual) → <span className="text-green-700 font-bold">{capacityCheck.hrsSeco.toLocaleString()} hs/mes</span> (Secocut)
              </span>
              {capacityCheck.hrsLiberadas > 0 ? (
                <span className="text-xs font-black text-emerald-700">⚡ {capacityCheck.hrsLiberadas.toLocaleString()} hs máquina liberadas/mes</span>
              ) : (
                <span className="text-[10px] text-slate-400">Sin variación de horas máquina</span>
              )}
            </div>
          )}
        </div>
      )}
      <PdfFooter />
    </div>
  );
}
