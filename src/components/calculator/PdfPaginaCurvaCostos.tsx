import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceDot, ReferenceLine } from 'recharts';
import { PdfLightHeader } from './PdfLightHeader';
import { PdfFooter } from './PdfFooter';

interface PdfPaginaCurvaCostosProps {
  data: { speed: number; costoActual: number; costoPremium: number }[];
  vcActual: number;
  vcPremium: number;
  actualCostCurrent: number;
  actualCostPremium: number;
  isStressTestActive: boolean;
  limiteTermicoActual: number | null;
  logoUrl: string;
  pageNumber: number;
  totalPages: number;
}

// Página 2 del PDF exportable: solo el gráfico de costo vs. Vc, sin compartir hoja
// con el dashboard (antes vivía arriba de la vieja página 2, apretado junto al
// dashboard). Mismo LineChart con tamaño fijo en píxeles que ya se usaba — ahora
// más grande porque tiene toda la hoja para sí.
export function PdfPaginaCurvaCostos({
  data, vcActual, vcPremium, actualCostCurrent, actualCostPremium,
  isStressTestActive, limiteTermicoActual, logoUrl, pageNumber, totalPages,
}: PdfPaginaCurvaCostosProps) {
  return (
    <div id="pdf-pagina-2" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
      <PdfLightHeader logoUrl={logoUrl} title="Análisis Gráfico" pageNumber={pageNumber} totalPages={totalPages} />
      <div>
        <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">2. Análisis de Curva de Costos</h2>
        <div className="w-full h-[520px] border border-slate-200 p-2 bg-white">
          <LineChart width={700} height={500} data={data} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="speed" label={{ value: 'Vc (m/min)', position: 'bottom', offset: 15 }} />
            <YAxis label={{ value: 'Costo USD', angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle' } }} />
            <Legend verticalAlign="top" height={36} />
            <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="costoPremium" name="Propuesta (Secocut)" stroke="#22c55e" strokeWidth={3} dot={false} isAnimationActive={false} />
            {isFinite(actualCostCurrent) && <ReferenceDot x={vcActual} y={actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
            {isFinite(actualCostPremium) && <ReferenceDot x={vcPremium} y={actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
            {isStressTestActive && limiteTermicoActual && (
              <ReferenceLine x={limiteTermicoActual} stroke="#ea580c" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '⚠️ Falla Térmica Compe.', fill: '#ea580c', fontSize: 9 }} />
            )}
          </LineChart>
        </div>
      </div>
      <PdfFooter />
    </div>
  );
}
