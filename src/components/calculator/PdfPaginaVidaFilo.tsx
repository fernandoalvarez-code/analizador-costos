import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceDot } from 'recharts';
import { formatMagnitud } from '@/lib/formatters';
import { windowVidaFiloData, type VidaFiloChartPoint } from './VidaFiloChart';

interface PdfPaginaVidaFiloProps {
  data: VidaFiloChartPoint[];
  unit: string;
  vcActual: number;
  vcPremium: number;
  pageNumber: number;
  totalPages: number;
}

// Página 3 del PDF exportable: mismo contenedor, header y footer que la
// página 2 (#pdf-pagina-2), capturada por html2canvas igual que las otras.
// El gráfico usa el mismo patrón que el de costos de la página 2: tamaño fijo
// en píxeles (no ResponsiveContainer, que puede reportar ancho 0 en un
// contenedor fuera de pantalla) y sin animación, para que html2canvas no
// capture el dibujo a mitad de camino (opacity:0 en el trazo).
export function PdfPaginaVidaFilo({ data, unit, vcActual, vcPremium, pageNumber, totalPages }: PdfPaginaVidaFiloProps) {
  const chartData = windowVidaFiloData(data, vcActual, vcPremium);
  const pointActual = data.find(d => d.speed === vcActual);
  const pointPremium = data.find(d => d.speed === vcPremium);

  // Con valores grandes (modo piezas, curvas altas) los ticks se ven más
  // prolijos como enteros; con valores chicos (modo minutos, taladrado)
  // formatMagnitud conserva los decimales que hacen falta.
  const maxLifeValue = chartData.reduce((max, d) => Math.max(max, d.lifeActual, d.lifePremium), 0);
  const yTickFormatter = (value: number) => maxLifeValue >= 20 ? `${Math.round(value)}` : formatMagnitud(value);

  return (
    <div id="pdf-pagina-3" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-slate-800 uppercase">Análisis Gráfico</h2>
            <p className="text-sm font-bold text-slate-500">Página {pageNumber} de {totalPages}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">4. Vida del Filo vs. Velocidad</h2>
          <div className="w-full h-[420px] border border-slate-200 p-2 bg-white">
            <LineChart width={650} height={400} data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Vc (m/min)', position: 'bottom', offset: 20 }} />
              <YAxis width={100} label={{ value: `Vida del Filo (${unit})`, angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle' } }} tickFormatter={yTickFormatter} />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="lifeActual" name="Vida Competidor" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lifePremium" name="Vida Secocut" stroke="#22c55e" strokeWidth={3} dot={false} isAnimationActive={false} />
              {pointActual && isFinite(pointActual.lifeActual) && (
                <ReferenceDot
                  x={vcActual}
                  y={pointActual.lifeActual}
                  r={6}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={2}
                  isFront={true}
                  label={{ value: formatMagnitud(pointActual.lifeActual), position: 'top', fill: '#ef4444', fontSize: 11, fontWeight: 'bold' }}
                />
              )}
              {pointPremium && isFinite(pointPremium.lifePremium) && (
                <ReferenceDot
                  x={vcPremium}
                  y={pointPremium.lifePremium}
                  r={6}
                  fill="#22c55e"
                  stroke="white"
                  strokeWidth={2}
                  isFront={true}
                  label={{ value: formatMagnitud(pointPremium.lifePremium), position: 'top', fill: '#22c55e', fontSize: 11, fontWeight: 'bold' }}
                />
              )}
            </LineChart>
          </div>
          <div className="mt-3 text-[10px] text-slate-500 leading-snug">
            <p>Las vidas en las velocidades de trabajo corresponden a los rendimientos de referencia cargados en el análisis; el resto de la curva es una estimación según el modelo de Taylor (C = Vc·Tⁿ). No constituye una medición.</p>
            <p className="mt-1">A mayor velocidad de corte, menor vida del filo. Cada curva varía solo la velocidad y mantiene el avance cargado en su condición. Los puntos marcan la condición actual (rojo) y la propuesta (verde).</p>
          </div>
        </div>
        <div className="mt-auto pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
          Documento generado automáticamente por Simulador de Competitividad Secocut SRL.
        </div>
    </div>
  );
}
