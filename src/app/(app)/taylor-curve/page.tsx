"use client";
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Share2, FileText } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
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
  const [pcsCurrent, setPcsCurrent] = useState<number>(6);
  const [pcsPremium, setPcsPremium] = useState<number>(20);
  const [tcCurrent, setTcCurrent] = useState<number>(3);
  const [monthlyProduction, setMonthlyProduction] = useState<number>(1000);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById('pdf-taylor-template');
      if (!element) return;
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false
      });
      
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
    // Variables seguras para matemáticas (Evitar NaN e Infinity cuando están vacíos)
    const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
    const safeToolCostCurrent = Number(toolCostCurrent) || 0;
    const safeToolCostPremium = Number(toolCostPremium) || 0;
    const safeToolChangeTime = Number(toolChangeTime) || 0;
    
    // Para divisores, usamos un mínimo de 0.0001 o 1 para no romper el algoritmo de Taylor
    const safeFeedCurrent = Number(feedCurrent) || 0.0001;
    const safeFeedPremium = Number(feedPremium) || 0.0001;
    const safeVcCurrent = Number(vcCurrent) || 0.0001;
    const safeVcPremium = Number(vcPremium) || 0.0001;
    const safePcsCurrent = Number(pcsCurrent) || 1;
    const safePcsPremium = Number(pcsPremium) || 1;
    const safeTcCurrent = Number(tcCurrent) || 0;
    const safeMonthlyProduction = Number(monthlyProduction) || 0;

    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[2];
    const premiumC = mat.C * 1.25;

    // Constante de proporción usando variables seguras
    const constantDistance = safeTcCurrent * safeVcCurrent * safeFeedCurrent;
    const tcPremium = constantDistance / (safeVcPremium * safeFeedPremium);

    // 1. Función Teórica (Para las líneas de la Curva U)
    const calcCost = (v: number, isPremium: boolean, feed: number) => {
      if (v <= 0 || feed <= 0) return Infinity;
      const C = isPremium ? premiumC : mat.C;
      const toolCost = isPremium ? safeToolCostPremium : safeToolCostCurrent;
      const tc = constantDistance / (v * feed); 
      const lifeMins = Math.pow((C / v), (1 / mat.n));
      if (tc <= 0 || lifeMins <= 0 || !isFinite(lifeMins)) return Infinity;
      return (safeMachineCostMin * tc) + ((safeMachineCostMin * safeToolChangeTime + toolCost) * (tc / lifeMins));
    };

    // 2. Función Empírica / Real (Para los puntos y el remate de ventas)
    const calcEmpiricalCost = (tc: number, toolPrice: number, pcsPerEdge: number) => {
      if (tc <= 0 || toolPrice < 0 || pcsPerEdge <= 0) return Infinity;
      const costCorte = safeMachineCostMin * tc;
      const costHerr = toolPrice / pcsPerEdge;
      const costCambio = (safeMachineCostMin * safeToolChangeTime) / pcsPerEdge;
      return costCorte + costHerr + costCambio;
    };

    const data = [];
    for (let v = 50; v <= mat.C * 1.3; v += 10) {
      data.push({
        speed: v,
        costoActual: Number(calcCost(v, false, safeFeedCurrent).toFixed(2)),
        costoPremium: Number(calcCost(v, true, safeFeedPremium).toFixed(2)),
      });
    }
    
    // 3. Calcular los PUNTOS REALES operativos
    const actualCostCurrent = calcEmpiricalCost(safeTcCurrent, safeToolCostCurrent, safePcsCurrent);
    const actualCostPremium = calcEmpiricalCost(tcPremium, safeToolCostPremium, safePcsPremium);
    
    const realAbsoluteSavings = isFinite(actualCostCurrent) && isFinite(actualCostPremium) ? actualCostCurrent - actualCostPremium : 0;
    const monthlySavings = realAbsoluteSavings * safeMonthlyProduction;

    return { 
      data, 
      actualCostCurrent, 
      actualCostPremium, 
      realAbsoluteSavings,
      monthlySavings,
      tcPremium
    };
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, feedCurrent, feedPremium, vcCurrent, vcPremium, pcsCurrent, pcsPremium, tcCurrent, monthlyProduction]);


  return (
    <div className="container mx-auto space-y-8 pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-blue-600 h-7 w-7" />
            Análisis de Curva de Taylor
          </h1>
          <p className="text-slate-500 text-sm mt-1">Compara la Vc actual vs. la propuesta para demostrar el ahorro real.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳ Generando...</span> : <>
              <FileText size={16} />
              PDF
            </>}
          </button>
          
          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳...</span> : <>
              <Share2 size={16} />
              WhatsApp
            </>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* PANEL DE INPUTS (Izquierda) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6 lg:col-span-1">
          
          {/* 1. PARÁMETROS GENERALES */}
          <div>
            <h2 className="font-bold text-slate-700 text-xs uppercase border-b border-slate-200 pb-2 mb-3">1. Parámetros del Taller</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="material-select" className="block text-[11px] font-bold text-slate-500 mb-1">Material a Mecanizar</Label>
                 <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger id="material-select" className="w-full p-2 border-slate-300 rounded-md text-sm bg-slate-50">
                        <SelectValue placeholder="Selecciona un material" />
                    </SelectTrigger>
                    <SelectContent>
                        {MATERIALS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="machine-cost" className="block text-[11px] font-bold text-slate-500 mb-1">Costo Máquina ($/hr)</Label>
                  <Input id="machine-cost" type="number" className="w-full p-2 border-slate-300 rounded-md text-sm" value={machineCostHr} onChange={e => setMachineCostHr(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label htmlFor="tool-change-time" className="block text-[11px] font-bold text-slate-500 mb-1">Cambio Herram. (min)</Label>
                  <Input id="tool-change-time" type="number" className="w-full p-2 border-slate-300 rounded-md text-sm" value={toolChangeTime} onChange={e => setToolChangeTime(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. SITUACIÓN ACTUAL (COMPETIDOR) */}
          <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
            <h2 className="font-bold text-red-700 text-xs uppercase mb-3 flex items-center gap-1">🔴 Condición Actual</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Inserto Competidor ($)</Label>
                <Input type="number" className="w-full p-1.5 border border-red-200 rounded text-sm bg-white" value={toolCostCurrent} onChange={e => setToolCostCurrent(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Avance (mm/rev)</Label>
                <Input type="number" step="0.01" className="w-full p-1.5 border border-red-200 rounded text-sm bg-white" value={feedCurrent} onChange={e => setFeedCurrent(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Vc Actual (m/min)</Label>
                <Input type="number" className="w-full p-1.5 border border-red-200 rounded text-sm bg-white" value={vcCurrent} onChange={e => setVcCurrent(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Rendimiento (Pzas/filo)</Label>
                <Input type="number" className="w-full p-1.5 border border-red-200 rounded text-sm bg-white" value={pcsCurrent} onChange={e => setPcsCurrent(Number(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-700 mb-1">Tiempo de Corte Actual (minutos)</Label>
                <Input type="number" step="0.1" className="w-full p-2 border-2 border-red-300 rounded-md text-sm font-bold bg-white" value={tcCurrent} onChange={e => setTcCurrent(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* 3. PROPUESTA PREMIUM */}
          <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
            <h2 className="font-bold text-green-700 text-xs uppercase mb-3 flex items-center gap-1">🟢 Propuesta Premium</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Inserto Seco ($)</Label>
                <Input type="number" className="w-full p-1.5 border border-green-200 rounded text-sm bg-white" value={toolCostPremium} onChange={e => setToolCostPremium(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Avance (mm/rev)</Label>
                <Input type="number" step="0.01" className="w-full p-1.5 border border-green-200 rounded text-sm bg-white" value={feedPremium} onChange={e => setFeedPremium(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Vc Propuesta (m/min)</Label>
                <Input type="number" className="w-full p-1.5 border border-green-200 rounded text-sm bg-white" value={vcPremium} onChange={e => setVcPremium(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Rendimiento (Pzas/filo)</Label>
                <Input type="number" className="w-full p-1.5 border border-green-200 rounded text-sm bg-white" value={pcsPremium} onChange={e => setPcsPremium(Number(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1">Tiempo Propuesto Deducido (minutos)</Label>
                <div className="w-full p-2 border-2 border-green-300 bg-green-100 text-green-800 rounded-md text-sm font-bold flex items-center shadow-inner h-10">
                  {curveDataInfo.tcPremium > 0 && isFinite(curveDataInfo.tcPremium) ? `${curveDataInfo.tcPremium.toFixed(2)} min` : "0.00 min"}
                </div>
              </div>
            </div>
          </div>

          {/* 4. VOLUMEN DE PRODUCCIÓN */}
          <div>
            <h2 className="font-bold text-slate-700 text-xs uppercase border-b border-slate-200 pb-2 mb-3">4. Escala Comercial</h2>
            <div>
              <Label htmlFor="monthly-production" className="block text-[11px] font-bold text-slate-500 mb-1">Producción Mensual (Piezas/mes)</Label>
              <Input id="monthly-production" type="number" className="w-full p-2 border border-slate-300 rounded-md text-sm bg-slate-50 font-bold text-blue-700" value={monthlyProduction} onChange={e => setMonthlyProduction(Number(e.target.value) || 0)} />
            </div>
          </div>

        </div>

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
                        {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={vcCurrent} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                        {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={vcPremium} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

       {/* EL GRAN REMATE VISUAL - AHORRO MENSUAL */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-8 text-center shadow-2xl relative overflow-hidden mt-6">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black opacity-10 rounded-full blur-2xl"></div>
        
        <p className="relative z-10 text-green-100 font-bold tracking-widest uppercase text-sm mb-2">💰 Impacto Financiero Proyectado</p>
        <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white drop-shadow-md mb-3">
          {formatCurrency(curveDataInfo.monthlySavings)}
        </h2>
        <p className="relative z-10 text-lg text-green-50 font-medium">
          Ahorro mensual neto al fabricar <span className="font-bold text-white bg-green-700 px-2 py-1 rounded">{formatNumber(monthlyProduction)} piezas</span> con tecnología Secocut Premium.
        </p>
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

        {/* PLANTILLA OCULTA PARA PDF (Renderizada fuera de pantalla para html2canvas) */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id="pdf-taylor-template" className="w-[210mm] min-h-[290mm] bg-white text-black p-10 font-sans box-border flex flex-col">
            
            {/* HEADER */}
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="h-12 flex items-center justify-center bg-blue-600 text-white font-black px-4 rounded">
                  SECOCUT
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Análisis de Curva de Taylor</h1>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">Secocut SRL</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase">FECHA</p>
                <p className="text-base font-semibold text-slate-800">{new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>

            {/* DATOS INGRESADOS */}
            <div className="mb-6">
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">1. Condiciones de Trabajo Evaluadas</h2>
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div><p className="text-slate-500">Material:</p><p className="font-bold">{MATERIALS.find(m => m.id === materialId)?.name}</p></div>
                <div><p className="text-slate-500">Costo Máquina:</p><p className="font-bold">{formatCurrency(machineCostHr)} / hr</p></div>
                <div><p className="text-slate-500">Tiempo Cambio Herr.:</p><p className="font-bold">{toolChangeTime} min</p></div>
                <div><p className="text-slate-500">Producción Mensual:</p><p className="font-bold">{formatNumber(monthlyProduction)} pzs/mes</p></div>
              </div>
            </div>

            {/* TABLA COMPARATIVA */}
            <div className="mb-6">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-2 border border-slate-700">Parámetro</th>
                    <th className="p-2 border border-slate-700">Condición Actual (Competidor)</th>
                    <th className="p-2 border border-slate-700">Propuesta Premium (Secocut)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Precio Inserto</td>
                    <td className="p-2 border border-slate-300">{formatCurrency(toolCostCurrent)}</td>
                    <td className="p-2 border border-slate-300">{formatCurrency(toolCostPremium)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Tiempo de Corte (min)</td>
                    <td className="p-2 border border-slate-300">{tcCurrent.toFixed(2)}</td>
                    <td className="p-2 border border-slate-300">{isFinite(curveDataInfo.tcPremium) ? curveDataInfo.tcPremium.toFixed(2) : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Velocidad de Corte (Vc)</td>
                    <td className="p-2 border border-slate-300">{vcCurrent} m/min</td>
                    <td className="p-2 border border-slate-300">{vcPremium} m/min</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Avance (f)</td>
                    <td className="p-2 border border-slate-300">{feedCurrent} mm/rev</td>
                    <td className="p-2 border border-slate-300">{feedPremium} mm/rev</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Rendimiento (Pzas/Filo)</td>
                    <td className="p-2 border border-slate-300">{pcsCurrent} pzs</td>
                    <td className="p-2 border border-slate-300">{pcsPremium} pzs</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-300 font-bold text-slate-800">Costo Real por Pieza</td>
                    <td className="p-2 border border-slate-300 font-bold text-red-600">{formatCurrency(curveDataInfo.actualCostCurrent)}</td>
                    <td className="p-2 border border-slate-300 font-bold text-green-600">{formatCurrency(curveDataInfo.actualCostPremium)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* IMPACTO COMERCIAL - EL TITULAR DEL PDF */}
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
              <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2 mt-2">Ahorro Mensual Proyectado</p>
              <p className="text-5xl font-black text-green-800 mb-2">
                {formatCurrency(curveDataInfo.monthlySavings)}
              </p>
              <div className="inline-block bg-green-100 px-4 py-2 rounded-full mt-2">
                <p className="text-sm font-bold text-green-800">
                  Basado en {formatNumber(monthlyProduction)} piezas/mes • Ahorro unitario: {formatCurrency(curveDataInfo.realAbsoluteSavings)}
                </p>
              </div>
            </div>

            {/* GRÁFICA CAPTURADA */}
            <div>
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">2. Análisis de Optimización (Curva Vc vs Costo)</h2>
              <div className="w-[180mm] h-[300px] mx-auto border border-slate-200 p-2 bg-white">
                {/* Le damos width y height fijos a LineChart para que html2canvas lo capture sin fallar */}
                <LineChart width={650} height={280} data={curveDataInfo.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="speed" label={{ value: 'Vc (m/min)', position: 'bottom', offset: -5 }} />
                  <YAxis label={{ value: 'Costo USD', angle: -90, position: 'insideLeft' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="costoActual" stroke="#ef4444" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="costoPremium" stroke="#22c55e" strokeWidth={3} dot={false} />
                  {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={vcCurrent} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                  {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={vcPremium} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
                </LineChart>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
              Documento generado automáticamente por Simulador de Competitividad Secocut SRL.
            </div>
          </div>
        </div>
      </div>
  );
}
