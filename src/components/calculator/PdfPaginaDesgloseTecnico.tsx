import React from 'react';
import { PdfLightHeader } from './PdfLightHeader';
import { PdfFooter } from './PdfFooter';
import { obtenerAnguloTexto, calcularVf } from '@/lib/taylor-helpers';
import { formatCurrency, formatoMinutosYSegundos, formatLoteConsumo } from '@/lib/formatters';

interface PdfPaginaDesgloseTecnicoProps {
  operationType: 'turning' | 'milling' | 'drilling';
  toolNameCurrent: string;
  toolNamePremium: string;
  toolCostCurrent: string | number;
  toolCostPremium: string | number;
  dcCurrent: string | number;
  dcPremium: string | number;
  apCurrent: string | number;
  apPremium: string | number;
  profundidadAgujero: string | number;
  tcCurrent: string | number;
  tcPremiumInput: string | number;
  vcCurrent: string | number;
  vcPremium: string | number;
  feedCurrent: string | number;
  feedPremium: string | number;
  pcsCurrent: string | number;
  pcsPremium: string | number;
  lifeModeCurrent: 'piezas' | 'minutos' | 'mm';
  lifeModePremium: 'piezas' | 'minutos' | 'mm';
  raActual: string | null;
  raPropuesta: string | null;
  curveDataInfo: any;
  logoUrl: string;
  pageNumber: number;
  totalPages: number;
}

// Página 3 del PDF exportable: la misma tabla de 14 filas que antes era toda la
// vieja página 1, reagrupada en 3 tablas más chicas (A/B/C) en vez de una sola
// larga. Mismos datos, mismo criterio visual (columna Secocut resaltada en verde)
// — no se recalcula ni se agrega ningún número nuevo.
//
// Tres filas no estaban explícitamente nombradas en ninguno de los 3 grupos
// pedidos y las ubiqué con este criterio (a revisar si no convence):
//  - "Precio Inserto" → grupo A, es un dato de configuración del inserto.
//  - "Costo Real por Pieza" (el total en negrita) → grupo C, como encabezado de
//    sus propias 3 sub-filas (Costo de Máquina/Inserto Puro/Paradas) — quitarlo
//    dejaría esas 3 sub-filas sin el total que las contextualiza.
//  - "Rugosidad Teórica (Ra)" → grupo C, es un resultado estimado más que un
//    parámetro de corte cargado por el usuario.
export function PdfPaginaDesgloseTecnico({
  operationType, toolNameCurrent, toolNamePremium, toolCostCurrent, toolCostPremium,
  dcCurrent, dcPremium, apCurrent, apPremium, profundidadAgujero, tcCurrent, tcPremiumInput,
  vcCurrent, vcPremium, feedCurrent, feedPremium, pcsCurrent, pcsPremium,
  lifeModeCurrent, lifeModePremium, raActual, raPropuesta, curveDataInfo,
  logoUrl, pageNumber, totalPages,
}: PdfPaginaDesgloseTecnicoProps) {
  const showDc = operationType === 'milling' || operationType === 'drilling';
  const showIncidencia = operationType === 'turning' || operationType === 'milling';
  const showVf = operationType === 'drilling';
  const showRa = operationType !== 'drilling';

  return (
    <div id="pdf-pagina-3" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
      <PdfLightHeader logoUrl={logoUrl} title="Análisis Gráfico" pageNumber={pageNumber} totalPages={totalPages} />

      <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-4 border-l-4 border-blue-600">3. Desglose Técnico Comparativo</h2>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">A. Configuración de la Herramienta</h3>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700">Parámetro</th>
              <th className="p-2 border border-slate-700 text-center">Condición Actual (Competidor)</th>
              <th className="p-2 border border-slate-700 text-center">Propuesta (Secocut)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 font-bold bg-slate-50">Herramienta</td>
              <td className="p-2 border border-slate-300 text-center">{toolNameCurrent || 'No especificada'}</td>
              <td className="p-2 border border-slate-300 font-bold text-green-700 bg-green-50 text-center">{toolNamePremium || 'No especificada'}</td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Precio Inserto</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostCurrent))}</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostPremium))}</td>
            </tr>
            {showDc && (
              <tr>
                <td className="p-2 border border-slate-300 font-bold">{operationType === 'drilling' ? 'Diámetro de Broca (Dc)' : 'Diámetro Fresa (Dc)'}</td>
                <td className="p-2 border border-slate-300 text-center">{dcCurrent} mm</td>
                <td className="p-2 border border-slate-300 text-center font-bold text-green-700">{dcPremium} mm</td>
              </tr>
            )}
            {showIncidencia && (
              <tr>
                <td className="p-2 border border-slate-300 font-bold">Incidencia (Holgura)</td>
                <td className="p-2 border border-slate-300 text-center">{obtenerAnguloTexto(toolNameCurrent)}</td>
                <td className="p-2 border border-slate-300 text-center bg-green-50 font-medium">{obtenerAnguloTexto(toolNamePremium)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">B. Parámetros de Corte</h3>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700">Parámetro</th>
              <th className="p-2 border border-slate-700 text-center">Condición Actual (Competidor)</th>
              <th className="p-2 border border-slate-700 text-center">Propuesta (Secocut)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Velocidad de Corte (Vc)</td>
              <td className="p-2 border border-slate-300 text-center">{vcCurrent} m/min</td>
              <td className="p-2 border border-slate-300 text-center">{vcPremium} m/min</td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Avance ({operationType === 'milling' ? 'fz' : 'fn'})</td>
              <td className="p-2 border border-slate-300 text-center">{feedCurrent} {operationType === 'milling' ? 'mm/z' : 'mm/rev'}</td>
              <td className="p-2 border border-slate-300 text-center text-green-700 font-bold">{feedPremium} {operationType === 'milling' ? 'mm/z' : 'mm/rev'}</td>
            </tr>
            {showVf && (
              <tr className="bg-green-50">
                <td className="font-bold p-2 text-gray-800 border border-slate-300">Velocidad de Penetración (Vf)</td>
                <td className="p-2 text-center border border-slate-300">{calcularVf(feedCurrent, vcCurrent, dcCurrent).toFixed(0)} mm/min</td>
                <td className="p-2 text-center text-green-800 font-black border border-slate-300">
                  {calcularVf(feedPremium, vcPremium, dcPremium).toFixed(0)} mm/min
                </td>
              </tr>
            )}
            <tr>
              <td className="p-2 border border-slate-300 font-bold">
                {operationType === 'drilling' ? 'Prof. del Agujero (L)' : 'Profundidad de Corte (ap)'}
              </td>
              <td className="p-2 border border-slate-300 text-center">{operationType === 'drilling' ? profundidadAgujero : apCurrent} mm</td>
              <td className="p-2 border border-slate-300 text-center text-green-700">{operationType === 'drilling' ? profundidadAgujero : apPremium} mm</td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Consumo de Motor</td>
              <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpCurrent.toFixed(1)} HP ({curveDataInfo.loadCurrent.toFixed(1)}%)</td>
              <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpPremium.toFixed(1)} HP ({curveDataInfo.loadPremium.toFixed(1)}%)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">C. Resultados Reales</h3>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700">Parámetro</th>
              <th className="p-2 border border-slate-700 text-center">Condición Actual (Competidor)</th>
              <th className="p-2 border border-slate-700 text-center">Propuesta (Secocut)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Tiempo de Corte (min)</td>
              <td className="p-2 border border-slate-300 text-center">{formatoMinutosYSegundos(Number(tcCurrent))}</td>
              <td className="p-2 border border-slate-300 text-center">{formatoMinutosYSegundos(Number(tcPremiumInput))}</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="p-2 border border-slate-300 font-black text-slate-800">Costo Real por Pieza</td>
              <td className="p-2 border border-slate-300 font-black text-red-600 text-center text-lg">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</td>
              <td className="p-2 border border-slate-300 text-center">
                {isFinite(curveDataInfo.actualCostPremium) ? (
                  <span className="font-black text-green-800 text-xl">
                    {formatCurrency(curveDataInfo.actualCostPremium)}
                  </span>
                ) : (
                  'N/A'
                )}
              </td>
            </tr>
            <tr className="text-[10px] text-slate-500 bg-white">
              <td className="p-2 border border-slate-300 pl-6">↳ Costo de Máquina</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.maquina)}</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.maquina)}</td>
            </tr>
            <tr className="text-[10px] text-slate-500 bg-white">
              <td className="p-2 border border-slate-300 pl-6">↳ Costo de Inserto Puro</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.inserto)}</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.inserto)}</td>
            </tr>
            <tr className="text-[10px] text-slate-500 bg-white">
              <td className="p-2 border border-slate-300 pl-6">↳ Costo de Paradas</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.parada)}</td>
              <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.parada)}</td>
            </tr>
            <tr>
              <td className="p-2 border border-slate-300 font-bold">Rendimiento Estimado</td>
              <td className="p-2 border border-slate-300 text-center">{pcsCurrent} {lifeModeCurrent === 'minutos' ? 'minutos' : lifeModeCurrent === 'mm' ? 'mm' : (operationType === 'drilling' ? 'agujeros' : 'pzs')}/filo</td>
              <td className="p-2 border border-slate-300 text-center text-green-700 font-bold">{pcsPremium} {lifeModePremium === 'minutos' ? 'minutos' : lifeModePremium === 'mm' ? 'mm' : (operationType === 'drilling' ? 'agujeros' : 'pzs')}/filo</td>
            </tr>
            {showRa && (
              <tr className="bg-slate-100">
                <td className="p-2 border border-slate-300 font-bold">Rugosidad Teórica (Ra)</td>
                <td className="p-2 border border-slate-300 text-center">
                  {`${raActual ?? 'N/A'} µm`}
                </td>
                <td className="p-2 border border-slate-300 text-center bg-slate-50 font-medium">
                  {`${raPropuesta ?? 'N/A'} µm`}
                </td>
              </tr>
            )}
            <tr className="bg-amber-50/40">
              <td className="p-2 border border-slate-300 font-bold text-amber-900">📦 Consumo de Insertos (Lote)</td>
              <td className="p-2 border border-slate-300 text-center font-black text-amber-700">
                {formatLoteConsumo(curveDataInfo.desgloseActualReal?.loteContinuo || 0)} unds. <span className="font-normal text-[9px] text-slate-500">(≈ {(curveDataInfo.desgloseActualReal?.lote || 0).toFixed(0)} a comprar)</span>
              </td>
              <td className="p-2 border border-slate-300 text-center font-black text-emerald-700">
                {formatLoteConsumo(curveDataInfo.desglosePremiumReal?.loteContinuo || 0)} unds. <span className="font-normal text-[9px] text-slate-500">(≈ {(curveDataInfo.desglosePremiumReal?.lote || 0).toFixed(0)} a comprar)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PdfFooter />
    </div>
  );
}
