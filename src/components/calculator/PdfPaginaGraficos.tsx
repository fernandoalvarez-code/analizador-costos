import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot, ReferenceLine } from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { formatLife, formatSignedPercent, pdfWindow, percentVariation, windowPdfData, xAxisFor, yAxisFor } from '@/lib/pdf-graficos';
import type { VidaFiloChartPoint } from './VidaFiloChart';
import { PdfLightHeader } from './PdfLightHeader';
import { PdfFooter } from './PdfFooter';

interface PdfPaginaGraficosProps {
  costData: { speed: number; costoActual: number; costoPremium: number }[];
  vcActual: number;
  vcPremium: number;
  actualCostCurrent: number;
  actualCostPremium: number;
  isStressTestActive: boolean;
  limiteTermicoActual: number | null;
  /** Vida del filo vs. Vc. Sin datos válidos en las dos Vc (o vacío) la hoja lleva solo la curva de costos, más grande. */
  lifeData: VidaFiloChartPoint[] | null;
  lifeUnit: string;
  logoUrl: string;
  pageNumber: number;
  totalPages: number;
}

const RED = '#ef4444';
const GREEN = '#22c55e';
const CHART_WIDTH = 690;
const CHART_HEIGHT_PAIR = 244;   // dos gráficos en la misma hoja (+ ~16 px de leyenda = ~260 px por bloque de gráfico)
const CHART_HEIGHT_SINGLE = 560; // un solo gráfico: usa el espacio para que la hoja no quede casi vacía

// Texto de notas: 11 px = 8,25 pt (mínimo pedido: 8 pt). El PDF se captura a 210 mm = 793 px, 1 px = 0,75 pt.
const NOTE = 'text-[11px] leading-snug text-slate-600';

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" data-testid="pdf-kpi">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-800 leading-tight">{children}</p>
    </div>
  );
}

const Actual = ({ children }: { children: React.ReactNode }) => <span className="text-red-600">{children}</span>;
const Propuesta = ({ children }: { children: React.ReactNode }) => <span className="text-green-700">{children}</span>;

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-2 border-l-4 border-blue-600">{children}</h2>
);

/** Etiqueta de valor con halo blanco para que se lea sobre la curva. `side` separa actual (izquierda) de propuesta (derecha). */
const pointLabel = (value: string, color: string, side: 'left' | 'right') => ({
  value, position: side, fill: color, fontSize: 12, fontWeight: 700, stroke: '#ffffff', strokeWidth: 4, paintOrder: 'stroke',
});

/** Leyenda propia (HTML) sobre el gráfico: la de Recharts se pisaba con el eje X y con las etiquetas de Vc. */
const ChartLegend = ({ items }: { items: { color: string; label: string }[] }) => (
  <div className="flex gap-4 px-2 pt-1 text-[11px] font-semibold text-slate-600" data-testid="pdf-leyenda">
    {items.map((i) => (
      <span key={i.label} className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded" style={{ backgroundColor: i.color }} />{i.label}</span>
    ))}
  </div>
);

/**
 * Línea vertical punteada en una Vc, con su etiqueta del lado de su condición: actual a la izquierda, propuesta a la derecha.
 * Es una FUNCIÓN y no un componente: Recharts solo reconoce ReferenceLine si es hijo directo del gráfico.
 */
const vcLine = (vc: number, color: string, side: 'left' | 'right', name: string) => (
  <ReferenceLine
    key={`vc-${name}`} x={vc} stroke={color} strokeWidth={1.5} strokeDasharray="5 4" ifOverflow="extendDomain"
    label={{ value: `${name} ${vc} m/min`, position: side === 'left' ? 'insideTopRight' : 'insideTopLeft', fill: color, fontSize: 11, fontWeight: 700 }}
  />
);

export function PdfPaginaGraficos({
  costData, vcActual, vcPremium, actualCostCurrent, actualCostPremium, isStressTestActive, limiteTermicoActual,
  lifeData, lifeUnit, logoUrl, pageNumber, totalPages,
}: PdfPaginaGraficosProps) {
  const hasLife = !!lifeData && lifeData.length > 0;
  const height = hasLife ? CHART_HEIGHT_PAIR : CHART_HEIGHT_SINGLE;
  const win = pdfWindow(vcActual, vcPremium);

  // Costos
  const costWindow = windowPdfData(costData, vcActual, vcPremium);
  const costVar = percentVariation(actualCostCurrent, actualCostPremium);

  // Vida del filo
  const lifeWindow = hasLife ? windowPdfData(lifeData!, vcActual, vcPremium) : [];
  const pointActual = hasLife ? lifeData!.find((d) => d.speed === vcActual) : undefined;
  const pointPremium = hasLife ? lifeData!.find((d) => d.speed === vcPremium) : undefined;
  const lifeVar = pointActual && pointPremium ? percentVariation(pointActual.lifeActual, pointPremium.lifePremium) : null;
  const yLife = yAxisFor(lifeWindow.flatMap((d) => [d.lifeActual, d.lifePremium]), { zeroBased: true });
  const yCost = yAxisFor(costWindow.flatMap((d) => [d.costoActual, d.costoPremium, actualCostCurrent, actualCostPremium]));
  const xAx = win ? xAxisFor(win.min, win.max) : null;

  const xAxis = (
    <XAxis
      type="number" dataKey="speed" domain={xAx ? xAx.domain : ['dataMin', 'dataMax']} ticks={xAx ? xAx.ticks : undefined}
      allowDataOverflow tick={{ fontSize: 11 }} label={{ value: 'Vc (m/min)', position: 'insideBottom', offset: -2, fontSize: 11 }}
    />
  );
  const margin = { top: 8, right: 26, left: 6, bottom: 4 };

  return (
    <div id="pdf-pagina-2" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
      <PdfLightHeader logoUrl={logoUrl} title="Análisis Gráfico" pageNumber={pageNumber} totalPages={totalPages} />

      <section data-testid="pdf-grafico-costos">
        <SectionTitle>2. Curva de Costos vs. Velocidad</SectionTitle>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Kpi label="Costo por pieza">
            <Actual>{formatCurrency(actualCostCurrent)}</Actual> <span className="text-slate-400 font-bold">→</span> <Propuesta>{formatCurrency(actualCostPremium)}</Propuesta>
          </Kpi>
          <Kpi label="Variación del costo">
            {costVar === null ? 'N/A' : <span className={costVar <= 0 ? 'text-green-700' : 'text-red-600'}>{formatSignedPercent(costVar)}</span>}
          </Kpi>
          <Kpi label="Velocidad de corte (Vc)">
            <Actual>{vcActual} m/min</Actual> <span className="text-slate-400 font-bold">→</span> <Propuesta>{vcPremium} m/min</Propuesta>
          </Kpi>
        </div>
        <div className="w-full border border-slate-200 bg-white p-1">
          <ChartLegend items={[{ color: RED, label: 'Inserto Competidor' }, { color: GREEN, label: 'Propuesta (Secocut)' }]} />
          <LineChart width={CHART_WIDTH} height={height} data={costWindow} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            {xAxis}
            <YAxis tick={{ fontSize: 11 }} width={54} domain={yCost.domain} ticks={yCost.ticks} tickFormatter={(v: number) => v.toFixed(2)} allowDataOverflow label={{ value: 'Costo USD', angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle', fontSize: 11 } }} />
                        <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke={RED} strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="costoPremium" name="Propuesta (Secocut)" stroke={GREEN} strokeWidth={3} dot={false} isAnimationActive={false} />
            {vcActual > 0 && vcLine(vcActual, RED, 'left', 'Actual')}
            {vcPremium > 0 && vcLine(vcPremium, GREEN, 'right', 'Propuesta')}
            {isFinite(actualCostCurrent) && <ReferenceDot x={vcActual} y={actualCostCurrent} r={6} fill={RED} stroke="white" strokeWidth={2} isFront label={pointLabel(formatCurrency(actualCostCurrent), RED, 'left')} />}
            {isFinite(actualCostPremium) && <ReferenceDot x={vcPremium} y={actualCostPremium} r={6} fill={GREEN} stroke="white" strokeWidth={2} isFront label={pointLabel(formatCurrency(actualCostPremium), GREEN, 'right')} />}
            {isStressTestActive && limiteTermicoActual && (!win || (limiteTermicoActual >= win.min && limiteTermicoActual <= win.max)) && (
              <ReferenceLine x={limiteTermicoActual} stroke="#ea580c" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Falla térmica (competidor)', fill: '#ea580c', fontSize: 11 }} />
            )}
          </LineChart>
        </div>
        <p className={`mt-1 ${NOTE}`}>
          Costo por pieza = máquina + herramienta + cambios de filo. Los puntos marcan la condición actual (rojo) y la propuesta (verde); las líneas punteadas, la Vc de cada una.
        </p>
      </section>

      {hasLife && pointActual && pointPremium && (
        <section className="mt-5" data-testid="pdf-grafico-vida">
          <SectionTitle>3. Vida del Filo vs. Velocidad</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Kpi label={`Vida del filo (${lifeUnit})`}>
              <Actual>{formatLife(pointActual.lifeActual)}</Actual> <span className="text-slate-400 font-bold">→</span> <Propuesta>{formatLife(pointPremium.lifePremium)}</Propuesta>
            </Kpi>
            <Kpi label="Mejora de la vida">
              {lifeVar === null ? 'N/A' : <span className={lifeVar >= 0 ? 'text-green-700' : 'text-red-600'}>{formatSignedPercent(lifeVar)}</span>}
            </Kpi>
            <Kpi label="Velocidad de corte (Vc)">
              <Actual>{vcActual} m/min</Actual> <span className="text-slate-400 font-bold">→</span> <Propuesta>{vcPremium} m/min</Propuesta>
            </Kpi>
          </div>
          <div className="w-full border border-slate-200 bg-white p-1">
            <ChartLegend items={[{ color: RED, label: 'Vida Competidor' }, { color: GREEN, label: 'Vida Secocut' }]} />
            <LineChart width={CHART_WIDTH} height={CHART_HEIGHT_PAIR} data={lifeWindow} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              {xAxis}
              <YAxis tick={{ fontSize: 11 }} width={54} domain={yLife.domain} ticks={yLife.ticks} tickFormatter={formatLife} allowDataOverflow label={{ value: `Vida (${lifeUnit})`, angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle', fontSize: 11 } }} />
                            <Line type="monotone" dataKey="lifeActual" name="Vida Competidor" stroke={RED} strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lifePremium" name="Vida Secocut" stroke={GREEN} strokeWidth={3} dot={false} isAnimationActive={false} />
              {vcLine(vcActual, RED, 'left', 'Actual')}
              {vcLine(vcPremium, GREEN, 'right', 'Propuesta')}
              {isFinite(pointActual.lifeActual) && <ReferenceDot x={vcActual} y={pointActual.lifeActual} r={6} fill={RED} stroke="white" strokeWidth={2} isFront label={pointLabel(formatLife(pointActual.lifeActual), RED, 'left')} />}
              {isFinite(pointPremium.lifePremium) && <ReferenceDot x={vcPremium} y={pointPremium.lifePremium} r={6} fill={GREEN} stroke="white" strokeWidth={2} isFront label={pointLabel(formatLife(pointPremium.lifePremium), GREEN, 'right')} />}
            </LineChart>
          </div>
          <p className={`mt-1 ${NOTE}`}>
            Las vidas en las velocidades de trabajo corresponden a los rendimientos de referencia cargados en el análisis; el resto de la curva es una estimación según el modelo de Taylor (C = Vc·Tⁿ). No constituye una medición. A mayor velocidad de corte, menor vida del filo; cada curva varía solo la velocidad y mantiene el avance de su condición.
          </p>
        </section>
      )}

      {!hasLife && (
        <p className={`mt-4 ${NOTE}`} data-testid="pdf-nota-sin-vida">
          La curva de vida del filo no se grafica en este informe: requiere el rendimiento de referencia (piezas o minutos por filo) cargado en las dos condiciones.
        </p>
      )}

      <PdfFooter />
    </div>
  );
}
