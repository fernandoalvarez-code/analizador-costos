"use client";
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const MATERIALS = [
  { id: 'alu', name: 'Aluminio (Ej: 6061)', n: 0.35, C: 900 },
  { id: 'low_c', name: 'Acero Bajo Carbono', n: 0.30, C: 350 },
  { id: 'med_c', name: 'Acero Medio Carbono', n: 0.25, C: 250 },
  { id: 'cast', name: 'Fundición de Hierro', n: 0.25, C: 200 },
  { id: 'inox', name: 'Acero Inoxidable', n: 0.20, C: 150 },
];

// Custom Dot to find the minimum point
const CustomMinDot = (props: any) => {
    const { cx, cy, stroke, payload, dataKey, data } = props;
    const minY = Math.min(...data.map((d: any) => d[dataKey]));

    if (payload[dataKey] === minY) {
        return <Dot cx={cx} cy={cy} r={6} stroke={stroke} fill={"#fff"} strokeWidth={2} />;
    }
    return null;
};


export default function TaylorCurvePage() {
  const [machineCostHr, setMachineCostHr] = useState<number>(35);
  const [toolCostCurrent, setToolCostCurrent] = useState<number>(6);
  const [toolCostPremium, setToolCostPremium] = useState<number>(13);
  const [toolChangeTime, setToolChangeTime] = useState<number>(2);
  const [materialId, setMaterialId] = useState('med_c');
  const [feedCurrent, setFeedCurrent] = useState<number>(0.2);
  const [feedPremium, setFeedPremium] = useState<number>(0.4);

  const { data, minCostCurrent, minCostPremium, optimalVcCurrent, optimalVcPremium, absoluteSavings, savingsPercentage } = useMemo(() => {
    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[2];
    const machineCostMin = machineCostHr / 60;
    const premiumC = mat.C * 1.25;

    const data = [];
    let minCostCurrent = Infinity;
    let minCostPremium = Infinity;
    let optimalVcCurrent = 0;
    let optimalVcPremium = 0;

    for (let v = 50; v <= mat.C * 1.2; v += 10) {
      // El tiempo base (normalizado a 1000) se divide por (V * avance)
      const tmCurrent = 1000 / (v * feedCurrent); 
      const tmPremium = 1000 / (v * feedPremium); 
      
      // Costo Actual
      const lifeCurrent = Math.pow((mat.C / v), (1 / mat.n));
      const costCurrent = (machineCostMin * tmCurrent) + ((machineCostMin * toolChangeTime + toolCostCurrent) * (tmCurrent / lifeCurrent));
      
      // Costo Premium
      const lifePremium = Math.pow((premiumC / v), (1 / mat.n));
      const costPremium = (machineCostMin * tmPremium) + ((machineCostMin * toolChangeTime + toolCostPremium) * (tmPremium / lifePremium));

      if (costCurrent < minCostCurrent) { minCostCurrent = costCurrent; optimalVcCurrent = v; }
      if (costPremium < minCostPremium) { minCostPremium = costPremium; optimalVcPremium = v; }

      data.push({
        speed: v,
        costoActual: Number(costCurrent.toFixed(2)),
        costoPremium: Number(costPremium.toFixed(2)),
      });
    }
    
    const absoluteSavings = minCostCurrent - minCostPremium;
    const savingsPercentage = (absoluteSavings / minCostCurrent) * 100;

    return { data, minCostCurrent, minCostPremium, optimalVcCurrent, optimalVcPremium, absoluteSavings, savingsPercentage };
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, feedCurrent, feedPremium]);

  return (
    <div className="container mx-auto space-y-8">
        <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Análisis de Curva de Taylor</h1>
                <p className="text-muted-foreground">Encuentra la Velocidad de Corte (Vc) óptima para minimizar el costo total.</p>
            </div>
        </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* PANEL DE INPUTS */}
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="text-lg">Variables del Proceso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="material-select">Material</Label>
                    <Select value={materialId} onValueChange={setMaterialId}>
                        <SelectTrigger id="material-select">
                            <SelectValue placeholder="Selecciona un material" />
                        </SelectTrigger>
                        <SelectContent>
                            {MATERIALS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="machine-cost">Costo Máquina ($/hr)</Label>
                    <Input id="machine-cost" type="number" value={machineCostHr} onChange={e => setMachineCostHr(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tool-change-time">Cambio Herram. (min)</Label>
                    <Input id="tool-change-time" type="number" value={toolChangeTime} onChange={e => setToolChangeTime(Number(e.target.value) || 0)} />
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-tool-cost" className="text-destructive">Inserto Competidor ($)</Label>
                        <Input id="current-tool-cost" type="number" value={toolCostCurrent} onChange={e => setToolCostCurrent(Number(e.target.value) || 0)} className="border-destructive/50 focus-visible:ring-destructive" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="current-feed" className="text-destructive">Avance Competidor (mm/rev)</Label>
                        <Input id="current-feed" type="number" step="0.01" value={feedCurrent} onChange={e => setFeedCurrent(Number(e.target.value) || 0)} className="border-destructive/50 focus-visible:ring-destructive" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4">
                    <div className="space-y-2">
                        <Label htmlFor="premium-tool-cost" className="text-green-600">Inserto Premium ($)</Label>
                        <Input id="premium-tool-cost" type="number" value={toolCostPremium} onChange={e => setToolCostPremium(Number(e.target.value) || 0)} className="border-green-500/50 focus-visible:ring-green-500" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="premium-feed" className="text-green-600">Avance Premium (mm/rev)</Label>
                        <Input id="premium-feed" type="number" step="0.01" value={feedPremium} onChange={e => setFeedPremium(Number(e.target.value) || 0)} className="border-green-500/50 focus-visible:ring-green-500" />
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* GRÁFICO Y RESULTADOS */}
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Curva de Costo vs. Velocidad</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 15 }} tick={{fontSize: 12}} />
                        <YAxis label={{ value: 'Costo Total Relativo', angle: -90, position: 'insideLeft', offset: 0 }} tick={{fontSize: 12}} tickFormatter={(value) => formatCurrency(value).replace('USD ', '$')} />
                        <Tooltip contentStyle={{backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))"}} formatter={(value) => [`${formatCurrency(Number(value))}`, 'Costo']} labelFormatter={(label) => `Vc: ${label} m/min`} />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#ef4444' }} >
                             <CustomMinDot data={data} dataKey="costoActual" />
                        </Line>
                        <Line type="monotone" dataKey="costoPremium" name="Inserto Premium" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#22c55e' }} >
                             <CustomMinDot data={data} dataKey="costoPremium" />
                        </Line>

                        <ReferenceLine x={optimalVcCurrent} stroke="#ef4444" strokeDasharray="3 3" />
                        <ReferenceLine x={optimalVcPremium} stroke="#22c55e" strokeDasharray="3 3" />
                        <ReferenceLine y={minCostCurrent} stroke="#ef4444" strokeDasharray="3 3" />
                        <ReferenceLine y={minCostPremium} stroke="#22c55e" strokeDasharray="3 3" />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">Vc Óptima (Competidor)</p>
                        <p className="text-xl font-black text-red-700 dark:text-red-300">{optimalVcCurrent} m/min</p>
                    </div>
                     <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800/30">
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">Vc Óptima (Premium)</p>
                        <p className="text-xl font-black text-green-700 dark:text-green-300">{optimalVcPremium} m/min</p>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

       <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
            <Zap className="h-8 w-8 text-blue-600" />
            <div>
                <CardTitle className="text-blue-800">Impacto Comercial y Remate de Ventas</CardTitle>
                <CardDescription className="text-blue-700">Argumentos clave para cerrar la venta basados en los datos.</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
                 <h3 className="font-bold text-lg text-slate-800">Argumento Técnico-Comercial</h3>
                 {savingsPercentage > 0 ? (
                    <p className="text-slate-700">
                        Al implementar nuestro inserto premium, no solo optimizamos la velocidad de corte a <strong className="text-green-600">{optimalVcPremium} m/min</strong>, sino que también aprovechamos un avance superior de <strong className="text-green-600">{feedPremium} mm/rev</strong>. 
                        Esta combinación resulta en una reducción directa del costo por pieza de <strong className="text-green-700">{savingsPercentage.toFixed(1)}%</strong>, lo que demuestra que la inversión inicial en una herramienta de mayor calidad se traduce en un ahorro significativo a escala.
                    </p>
                 ) : (
                     <p className="text-slate-600 italic">
                        En este escenario, el costo del competidor es menor. Sin embargo, nuestro inserto premium podría justificarse si el cliente experimenta problemas de calidad, acabado superficial o roturas imprevistas que no se capturan en este análisis de costos. La estabilidad y confiabilidad de nuestro inserto premium pueden ser el factor decisivo.
                    </p>
                 )}
            </div>
            <div className="flex justify-center items-center">
                <div className="text-center bg-white p-6 rounded-xl border-2 border-primary shadow-2xl">
                    <p className="text-sm font-bold text-primary uppercase tracking-wider">Ahorro Relativo Final</p>
                    <p className={`text-6xl font-black my-2 ${savingsPercentage > 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {isFinite(savingsPercentage) ? `${savingsPercentage.toFixed(1)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                        {isFinite(absoluteSavings) ? `Equivalente a ${formatCurrency(absoluteSavings)} por ciclo` : 'Cálculo pendiente'}
                    </p>
                </div>
            </div>
        </CardContent>
      </Card>
      
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">¿Cómo leer este gráfico?</h3>
                <p className="text-sm text-blue-900 dark:text-blue-300 mb-2">La curva muestra cómo varía el costo de fabricar una pieza a medida que aumentamos la Velocidad de Corte (Vc).</p>
                <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1.5 list-disc pl-4">
                    <li>El <strong>punto más bajo</strong> de la curva (marcado con un punto) es la velocidad exacta donde la pieza sale más barata.</li>
                    <li>Si cortamos muy lento, el costo sube porque la hora-máquina nos come la ganancia.</li>
                    <li>Si cortamos muy rápido, el costo sube bruscamente porque el inserto se desgasta y gastamos más en herramientas.</li>
                </ul>
            </div>
        </div>
    </div>
  );
}
