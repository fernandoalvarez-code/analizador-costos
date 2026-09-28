import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatMagnitud } from '@/lib/formatters';

export interface VidaFiloChartPoint {
  speed: number;
  lifeActual: number;
  lifePremium: number;
}

interface VidaFiloChartProps {
  data: VidaFiloChartPoint[];
  unit: string;
  vcActual: number;
  vcPremium: number;
}

// Extraído de taylor-curve/page.tsx y taylor-curve/[id]/edit/page.tsx, que tenían
// esta card duplicada de forma idéntica.
export function VidaFiloChart({ data, unit, vcActual, vcPremium }: VidaFiloChartProps) {
  // Ventana del eje X: con n genérico por grupo ISO, la curva de Taylor no es
  // defendible lejos de las Vc que realmente se cargaron (a Vc bajas la vida
  // estimada explota y aplasta visualmente la zona útil, la que rodea las dos
  // velocidades que importan). Se recorta a [0.7×min(Vc), 1.4×max(Vc)]. Si falta
  // alguna de las dos Vc (0 o vacía → Number() da 0), se muestra el rango
  // completo como antes — no hay ventana que centrar.
  const hasBothVc = vcActual > 0 && vcPremium > 0;
  const windowMin = hasBothVc ? 0.7 * Math.min(vcActual, vcPremium) : null;
  const windowMax = hasBothVc ? 1.4 * Math.max(vcActual, vcPremium) : null;
  const chartData = hasBothVc
    ? data.filter(d => d.speed >= windowMin! && d.speed <= windowMax!)
    : data;

  // vcActual y vcPremium están siempre dentro de [windowMin, windowMax] por
  // construcción (min ≤ vcActual, vcPremium ≤ max), así que los ReferenceDot
  // quedan dentro de la ventana sin necesidad de un caso especial.
  const pointActual = data.find(d => d.speed === vcActual);
  const pointPremium = data.find(d => d.speed === vcPremium);

  return (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Vida del Filo vs. Velocidad</CardTitle>
            <CardDescription>
              Vida estimada según el modelo de Taylor (C = Vc·Tⁿ) a partir de tu dato de referencia — no es un valor medido ni un criterio de desgaste (VB).
            </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 15 }} tick={{fontSize: 12}} />
                <YAxis label={{ value: `Vida del Filo (${unit})`, angle: -90, position: 'insideLeft', offset: 0 }} tick={{fontSize: 12}} tickFormatter={(value: number) => formatMagnitud(value)} />
                <Tooltip formatter={(value: number) => [`${formatMagnitud(value)} ${unit}`, undefined]} labelFormatter={(label) => `Vc: ${label} m/min`} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="lifeActual" name="Vida Competidor" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#ef4444' }} />
                <Line type="monotone" dataKey="lifePremium" name="Vida Secocut" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#22c55e' }} />

                {pointActual && isFinite(pointActual.lifeActual) && <ReferenceDot x={vcActual} y={pointActual.lifeActual} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                {pointPremium && isFinite(pointPremium.lifePremium) && <ReferenceDot x={vcPremium} y={pointPremium.lifePremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
    </Card>
  );
}
