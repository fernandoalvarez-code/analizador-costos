"use client";
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Share2, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MATERIALS = [
  { id: 'alu', name: 'Aluminio (Ej: 6061)', n: 0.35, C: 900 },
  { id: 'low_c', name: 'Acero Bajo Carbono', n: 0.30, C: 350 },
  { id: 'med_c', name: 'Acero Medio Carbono', n: 0.25, C: 250 },
  { id: 'cast', name: 'Fundición de Hierro', n: 0.25, C: 200 },
  { id: 'inox', name: 'Acero Inoxidable', n: 0.20, C: 150 },
];


export default function TaylorCurvePage() {
  const [machineCostHr, setMachineCostHr] = useState<number>(35);
  const [toolCostCurrent, setToolCostCurrent] = useState<number>(6);
  const [toolCostPremium, setToolCostPremium] = useState<number>(13);
  const [toolChangeTime, setToolChangeTime] = useState<number>(2);
  const [materialId, setMaterialId] = useState('med_c');
  const [feedCurrent, setFeedCurrent] = useState<number>(0.2);
  const [feedPremium, setFeedPremium] = useState<number>(0.4);
  const [vcCurrent, setVcCurrent] = useState<number>(100);
  const [vcPremium, setVcPremium] = useState<number>(120);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById('pdf-taylor-template');
      if (!element) return;

      // Hacemos el elemento temporalmente visible para html2canvas
      element.style.display = 'block';
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false
      });
      
      element.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Intentar usar la API Nativa de Compartir (WhatsApp, Email, etc en Móvil)
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Reporte_Taylor_${new Date().getTime()}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Reporte de Optimización CNC',
          text: 'Adjunto el análisis de la Curva de Taylor y el cálculo de ahorro de mecanizado.',
          files: [file],
        });
      } else {
        // Fallback: Descargar tradicional si está en PC o no soporta Share
        pdf.save(`Reporte_Taylor_Secocut.pdf`);
      }
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Hubo un problema al generar el reporte.");
    } finally {
      setIsGenerating(false);
    }
  };

  const curveDataInfo = useMemo(() => {
    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[2];
    const machineCostMin = machineCostHr / 60;
    const premiumC = mat.C * 1.25;

    // Función pura para calcular costo en un punto exacto
    const calcCost = (v: number, isPremium: boolean, feed: number) => {
      const C = isPremium ? premiumC : mat.C;
      const toolCost = isPremium ? toolCostPremium : toolCostCurrent;
      const tm = 1000 / (v * feed); 
      const life = Math.pow((C / v), (1 / mat.n));
      return (machineCostMin * tm) + ((machineCostMin * toolChangeTime + toolCost) * (tm / life));
    };

    // 1. Generar la curva (teoría)
    const data = [];
    for (let v = 50; v <= mat.C * 1.3; v += 10) {
      data.push({
        speed: v,
        costoActual: Number(calcCost(v, false, feedCurrent).toFixed(2)),
        costoPremium: Number(calcCost(v, true, feedPremium).toFixed(2)),
      });
    }
    
    // 2. Calcular los PUNTOS REALES operativos
    const actualCostCurrent = calcCost(vcCurrent, false, feedCurrent);
    const actualCostPremium = calcCost(vcPremium, true, feedPremium);
    
    // 3. Calcular el Ahorro Real
    const realAbsoluteSavings = actualCostCurrent - actualCostPremium;
    const realSavingsPercentage = (realAbsoluteSavings / actualCostCurrent) * 100;

    return { 
      data, 
      actualCostCurrent, 
      actualCostPremium, 
      realAbsoluteSavings, 
      realSavingsPercentage 
    };
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, feedCurrent, feedPremium, vcCurrent, vcPremium]);

  return (
    <div className="container mx-auto space-y-8">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Análisis de Curva de Taylor</h1>
                    <p className="text-muted-foreground">Compara la Vc actual vs. la propuesta para demostrar el ahorro real.</p>
                </div>
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
                        <Input id="current-feed" type="number" step="0.05" value={feedCurrent} onChange={e => setFeedCurrent(Number(e.target.value) || 0)} className="border-destructive/50 focus-visible:ring-destructive" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4">
                    <div className="space-y-2">
                        <Label htmlFor="premium-tool-cost" className="text-green-600">Inserto Premium ($)</Label>
                        <Input id="premium-tool-cost" type="number" value={toolCostPremium} onChange={e => setToolCostPremium(Number(e.target.value) || 0)} className="border-green-500/50 focus-visible:ring-green-500" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="premium-feed" className="text-green-600">Avance Premium (mm/rev)</Label>
                        <Input id="premium-feed" type="number" step="0.05" value={feedPremium} onChange={e => setFeedPremium(Number(e.target.value) || 0)} className="border-green-500/50 focus-visible:ring-green-500" />
                    </div>
                </div>

                 <div className="pt-4 mt-2 border-t border-slate-200">
                    <h3 className="font-bold text-slate-700 text-xs uppercase mb-3">Condiciones Reales de Trabajo</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vc-current" className="text-destructive">Vc Actual Competidor (m/min)</Label>
                            <Input id="vc-current" type="number" value={vcCurrent} onChange={e => setVcCurrent(Number(e.target.value) || 0)} className="border-destructive/50 focus-visible:ring-destructive" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vc-premium" className="text-green-600">Vc Propuesta Premium (m/min)</Label>
                            <Input id="vc-premium" type="number" value={vcPremium} onChange={e => setVcPremium(Number(e.target.value) || 0)} className="border-green-500/50 focus-visible:ring-green-500" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* GRÁFICO Y RESULTADOS */}
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Curva de Costo vs. Velocidad</CardTitle>
                <CardDescription>Los puntos marcan el costo operativo real en la Vc seleccionada.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curveDataInfo.data} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 15 }} tick={{fontSize: 12}} />
                        <YAxis label={{ value: 'Costo Total Relativo', angle: -90, position: 'insideLeft', offset: 0 }} tick={{fontSize: 12}} tickFormatter={(value) => formatCurrency(value).replace('USD ', '$')} />
                        <Tooltip contentStyle={{backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))"}} formatter={(value) => [`${formatCurrency(Number(value))}`, 'Costo']} labelFormatter={(label) => `Vc: ${label} m/min`} />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#ef4444' }} />
                        <Line type="monotone" dataKey="costoPremium" name="Inserto Premium" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#22c55e' }} />

                        {/* Puntos de operación real */}
                        <ReferenceDot x={vcCurrent} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />
                        <ReferenceDot x={vcPremium} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

       {/* PANEL DE RESULTADOS COMERCIALES (REMATE DE VENTAS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center flex flex-col justify-center">
          <p className="text-xs font-bold text-red-700 uppercase mb-1">Costo Operativo Competidor</p>
          <p className="text-2xl font-black text-red-800">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</p>
          <p className="text-[10px] text-red-600 mt-1">Vc: {vcCurrent} m/min | f: {feedCurrent} mm/rev</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center flex flex-col justify-center">
          <p className="text-xs font-bold text-green-700 uppercase mb-1">Costo Operativo Premium</p>
          <p className="text-2xl font-black text-green-800">{isFinite(curveDataInfo.actualCostPremium) ? formatCurrency(curveDataInfo.actualCostPremium) : 'N/A'}</p>
          <p className="text-[10px] text-green-600 mt-1">Vc: {vcPremium} m/min | f: {feedPremium} mm/rev</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border-2 border-green-400 text-center shadow-lg flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-1">Ahorro Real por Pieza</p>
          <p className="text-4xl font-black text-white mb-1">{isFinite(curveDataInfo.realAbsoluteSavings) ? formatCurrency(curveDataInfo.realAbsoluteSavings) : 'N/A'}</p>
          <p className="text-sm font-medium text-slate-300">
            {isFinite(curveDataInfo.realSavingsPercentage) && curveDataInfo.realSavingsPercentage > 0 && (
                <>Reducción del <span className="text-green-400 font-bold">{curveDataInfo.realSavingsPercentage.toFixed(1)}%</span> en el costo de fabricación</>
            )}
            {isFinite(curveDataInfo.realSavingsPercentage) && curveDataInfo.realSavingsPercentage <= 0 && (
                <>Aumento del <span className="text-red-400 font-bold">{Math.abs(curveDataInfo.realSavingsPercentage).toFixed(1)}%</span> en el costo</>
            )}
          </p>
        </div>
      </div>
      
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">¿Cómo leer este gráfico?</h3>
                <p className="text-sm text-blue-900 dark:text-blue-300 mb-2">La curva muestra cómo varía el costo de fabricar una pieza a medida que aumentamos la Velocidad de Corte (Vc).</p>
                <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1.5 list-disc pl-4">
                    <li>El <strong>punto rojo</strong> marca tu costo operativo actual, mientras que el <strong>punto verde</strong> marca el costo con la Vc y Avance que proponemos para el inserto premium.</li>
                    <li>El objetivo es que el punto verde esté por debajo del rojo, lo que significa un ahorro real por cada pieza fabricada.</li>
                </ul>
            </div>
        </div>

        {/* PDF Template */}
        <div id="pdf-taylor-template" style={{ display: 'none', position: 'absolute', left: '-9999px', width: '210mm', height: '297mm', background: 'white', color: 'black', padding: '15mm' }}>
          <div className="h-full w-full flex flex-col font-sans">
              
              <header className="flex justify-between items-center pb-4 border-b-2 border-slate-800">
                  <div className="text-left">
                      <h1 className="text-3xl font-extrabold text-slate-900 uppercase">Reporte de Optimización</h1>
                      <p className="text-lg font-bold text-blue-600">Análisis de Curva de Taylor</p>
                  </div>
                  {/* Logos can be added here if available as base64 or via CORS-enabled URLs */}
              </header>

              <main className="flex-1 mt-8">
                  <div className="h-[120mm] w-full mb-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={curveDataInfo.data} margin={{ top: 5, right: 5, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cccccc" />
                          <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 0, fontSize: 10 }} tick={{fontSize: 10}} />
                          <YAxis label={{ value: 'Costo Total', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} tick={{fontSize: 10}} tickFormatter={(value) => formatCurrency(value).replace('USD ', '$')} />
                          <Tooltip formatter={(value) => [`${formatCurrency(Number(value))}`, 'Costo']} labelFormatter={(label) => `Vc: ${label} m/min`} />
                          <Legend verticalAlign="top" height={30} iconSize={10} wrapperStyle={{fontSize: "10px"}} />
                          <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="costoPremium" name="Inserto Premium" stroke="#22c55e" strokeWidth={2} dot={false} />
                          <ReferenceDot x={vcCurrent} y={curveDataInfo.actualCostCurrent} r={5} fill="#ef4444" stroke="white" strokeWidth={1} />
                          <ReferenceDot x={vcPremium} y={curveDataInfo.actualCostPremium} r={5} fill="#22c55e" stroke="white" strokeWidth={1} />
                        </LineChart>
                      </ResponsiveContainer>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-xs">
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                          <p className="font-bold text-red-700 uppercase mb-1">Costo Operativo (Actual)</p>
                          <p className="text-xl font-extrabold text-red-800">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</p>
                          <p className="text-[9px] text-red-600 mt-1">Vc: {vcCurrent} m/min | f: {feedCurrent} mm/rev</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                          <p className="font-bold text-green-700 uppercase mb-1">Costo Operativo (Propuesta)</p>
                          <p className="text-xl font-extrabold text-green-800">{isFinite(curveDataInfo.actualCostPremium) ? formatCurrency(curveDataInfo.actualCostPremium) : 'N/A'}</p>
                           <p className="text-[9px] text-green-600 mt-1">Vc: {vcPremium} m/min | f: {feedPremium} mm/rev</p>
                      </div>
                      <div className="bg-slate-800 text-white p-3 rounded-lg flex flex-col justify-center items-center text-center">
                          <p className="font-bold text-green-400 uppercase text-[10px] tracking-wide">Ahorro Real</p>
                          <p className="text-2xl font-extrabold">{isFinite(curveDataInfo.realAbsoluteSavings) ? formatCurrency(curveDataInfo.realAbsoluteSavings) : 'N/A'}</p>
                           {isFinite(curveDataInfo.realSavingsPercentage) && <p className="text-sm font-medium text-slate-300">({curveDataInfo.realSavingsPercentage.toFixed(1)}%)</p>}
                      </div>
                  </div>
              </main>

              <footer className="text-center mt-8 pt-4 border-t border-slate-200">
                  <p className="text-[9px] text-slate-500">Reporte generado con el Analizador de Costos de Secocut | {new Date().toLocaleDateString()}</p>
              </footer>
          </div>
        </div>

        <button 
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all z-50 disabled:opacity-50"
            title="Generar Reporte PDF"
        >
            {isGenerating ? <span className="animate-spin text-xl">⏳</span> : <Share2 size={24} />}
        </button>
    </div>
  );
}
