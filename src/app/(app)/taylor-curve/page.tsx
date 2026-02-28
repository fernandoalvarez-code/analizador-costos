"use client";
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Share2, FileText, Save } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase";

const MATERIALS = [
  { id: 'alu', name: 'Aluminio (Ej: 6061)', n: 0.35, C: 900, kc: 700 },
  { id: 'low_c', name: 'Acero Bajo Carbono', n: 0.30, C: 350, kc: 1500 },
  { id: 'med_c', name: 'Acero Medio Carbono', n: 0.25, C: 200, kc: 1500 },
  { id: 'cast', name: 'Fundición de Hierro', n: 0.25, C: 200, kc: 1200 },
  { id: 'inox', name: 'Acero Inoxidable', n: 0.20, C: 150, kc: 2500 },
];


export default function TaylorCurvePage() {
  // --- ESTADOS DEL FORMULARIO (Inician vacíos por requerimiento de UX) ---
  const [operationType, setOperationType] = useState<'turning' | 'milling'>('turning');
  const [materialId, setMaterialId] = useState('med_c'); // El select sí tiene default
  const [machineCostHr, setMachineCostHr] = useState<number | "">("");
  const [toolChangeTime, setToolChangeTime] = useState<number | "">("");
  const [pieceName, setPieceName] = useState<string>("");
  const [ap, setAp] = useState<number | "">(""); // Profundidad de corte
  const [machinePowerHP, setMachinePowerHP] = useState<number | "">(15); // Potencia del motor
  
  // Competidor
  const [toolCostCurrent, setToolCostCurrent] = useState<number | "">("");
  const [feedCurrent, setFeedCurrent] = useState<number | "">("");
  const [vcCurrent, setVcCurrent] = useState<number | "">("");
  const [pcsCurrent, setPcsCurrent] = useState<number | "">("");
  const [tcCurrentMin, setTcCurrentMin] = useState<number | "">("");
  const [tcCurrentSec, setTcCurrentSec] = useState<number | "">("");
  const [zCurrent, setZCurrent] = useState<number | "">("");
  const [edgesCurrent, setEdgesCurrent] = useState<number | "">("");
  const [geometryCurrent, setGeometryCurrent] = useState<'positive' | 'negative'>('positive');
  
  // Premium
  const [toolCostPremium, setToolCostPremium] = useState<number | "">("");
  const [feedPremium, setFeedPremium] = useState<number | "">("");
  const [vcPremium, setVcPremium] = useState<number | "">("");
  const [pcsPremium, setPcsPremium] = useState<number | "">("");
  const [zPremium, setZPremium] = useState<number | "">("");
  const [edgesPremium, setEdgesPremium] = useState<number | "">("");
  const [geometryPremium, setGeometryPremium] = useState<'positive' | 'negative'>('positive');
  
  // Volumen
  const [monthlyProduction, setMonthlyProduction] = useState<number | "">("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveClientName, setSaveClientName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const generatePdfBlob = async (): Promise<Blob | null> => {
    try {
      const element = document.getElementById('pdf-taylor-template');
      if (!element) throw new Error("No se encontró la plantilla del PDF.");

      element.style.position = 'absolute';
      element.style.top = '0px';
      element.style.left = '0px';
      element.style.zIndex = '-9999';

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
      element.style.top = '-9999px';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) {
      console.error("Error generando Blob del PDF:", error);
      return null;
    }
  };

  const handleGeneratePDF = async (action: 'download' | 'share') => {
    setIsGenerating(true);
    try {
      const pdfBlob = await generatePdfBlob();
      if (!pdfBlob) throw new Error("Fallo al crear el documento.");

      const fileName = `Reporte_Secocut_${new Date().getTime()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (action === 'share' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Reporte Secocut', files: [file] });
      } else {
        // Fallback a descarga si falla el share o si es acción download
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al procesar el PDF.");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const curveDataInfo = useMemo(() => {
    // Variables seguras para evitar NaN o Infinity
    const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
    const safeToolCostCurrent = Number(toolCostCurrent) || 0;
    const safeToolCostPremium = Number(toolCostPremium) || 0;
    const safeToolChangeTime = Number(toolChangeTime) || 0;
    
    // Tiempos y parámetros
    const safeTcCurrent = (Number(tcCurrentMin) || 0) + ((Number(tcCurrentSec) || 0) / 60);
    const safeVcCurrent = Number(vcCurrent) || 0.0001;
    const safeFeedCurrent = Number(feedCurrent) || 0.0001;
    const safeVcPremium = Number(vcPremium) || 0.0001;
    const safeFeedPremium = Number(feedPremium) || 0.0001;

    // Variables de Fresado (Z y Filos) controladas por el Toggle
    const safeZCurrent = operationType === 'turning' ? 1 : (Number(zCurrent) || 1);
    const safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || safeZCurrent);
    const safeEdgesCurrent = Number(edgesCurrent) || 1;
    const safeEdgesPremium = Number(edgesPremium) || 1;

    const safePcsCurrent = Number(pcsCurrent) || 1;
    const safePcsPremium = Number(pcsPremium) || 1;
    const safeMonthlyProduction = Number(monthlyProduction) || 0;

    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[2];
    const premiumC = mat.C * 1.25;

    // EL CORAZÓN DE LA AUTOMATIZACIÓN: Constante de proporción incluyendo Z
    const constantDistance = safeTcCurrent * safeVcCurrent * safeFeedCurrent * safeZCurrent;
    
    // CÁLCULO REACTIVO DEL TIEMPO PREMIUM (Se reduce automáticamente si sube Z, Vc o Avance)
    const tcPremium = constantDistance / (safeVcPremium * safeFeedPremium * safeZPremium);

    // Constante kc del material (Fallback a 1500 si no existe)
    const kc = mat.kc || 1500;
    const safeAp = Number(ap) || 2.0; // Profundidad por defecto: 2mm para evitar potencia 0
    const safeMachinePowerHP = Number(machinePowerHP) || 15; // Evitar división por cero

    // Multiplicadores de Geometría
    const geoFactorCurrent = geometryCurrent === 'negative' ? 1.15 : 1.0;
    const geoFactorPremium = geometryPremium === 'negative' ? 1.15 : 1.0;

    // CÁLCULO DE POTENCIA (kW a HP) CON GEOMETRÍA
    const kwCurrent = (safeAp * safeFeedCurrent * safeVcCurrent * kc * safeZCurrent) / 60000;
    const hpCurrent = kwCurrent * 1.341 * geoFactorCurrent;
    const loadCurrent = (hpCurrent / safeMachinePowerHP) * 100; // Porcentaje de carga

    const kwPremium = (safeAp * safeFeedPremium * safeVcPremium * kc * safeZPremium) / 60000;
    const hpPremium = kwPremium * 1.341 * geoFactorPremium;
    const loadPremium = (hpPremium / safeMachinePowerHP) * 100; // Porcentaje de carga


    // 1. Función Teórica
    const calcCost = (v: number, isPremium: boolean, feed: number) => {
      const C = isPremium ? premiumC : mat.C;
      const toolPrice = isPremium ? safeToolCostPremium : safeToolCostCurrent;
      const z = isPremium ? safeZPremium : safeZCurrent;
      const edges = isPremium ? safeEdgesPremium : safeEdgesCurrent;
      
      const tc = constantDistance / (v * feed * z); 
      const lifeMins = Math.pow((C / v), (1 / mat.n));
      
      const costPorPunta = toolPrice / edges;
      const costJuego = costPorPunta * z;
      
      return (safeMachineCostMin * tc) + ((safeMachineCostMin * safeToolChangeTime + costJuego) * (tc / lifeMins));
    };

    // 2. Función Empírica
    const calcEmpiricalCost = (tc: number, toolPrice: number, pcsPerEdge: number, z: number, edges: number) => {
      const costCorte = safeMachineCostMin * tc;
      const costPorPunta = toolPrice / edges;
      const costJuego = costPorPunta * z;
      const costHerr = costJuego / pcsPerEdge;
      const costCambio = (safeMachineCostMin * safeToolChangeTime) / pcsPerEdge;
      return costCorte + costHerr + costCambio;
    };

    // Crear Set para forzar las Vc en el eje X
    const speedsSet = new Set<number>();
    for (let v = 50; v <= mat.C * 1.3; v += 10) {
      speedsSet.add(v);
    }
    if (safeVcCurrent > 0) speedsSet.add(safeVcCurrent);
    if (safeVcPremium > 0) speedsSet.add(safeVcPremium);

    const sortedSpeeds = Array.from(speedsSet).sort((a, b) => a - b);
    const data = [];
    sortedSpeeds.forEach(v => {
      data.push({
        speed: v,
        costoActual: Number(calcCost(v, false, safeFeedCurrent).toFixed(2)),
        costoPremium: Number(calcCost(v, true, safeFeedPremium).toFixed(2)),
      });
    });
    
    // 3. Puntos Reales
    const actualCostCurrent = calcEmpiricalCost(safeTcCurrent, safeToolCostCurrent, safePcsCurrent, safeZCurrent, safeEdgesCurrent);
    const actualCostPremium = calcEmpiricalCost(tcPremium, safeToolCostPremium, safePcsPremium, safeZPremium, safeEdgesPremium);
    
    const realAbsoluteSavings = actualCostCurrent - actualCostPremium;
    const realSavingsPercentage = actualCostCurrent > 0 ? (realAbsoluteSavings / actualCostCurrent) * 100 : 0;
    
    // CÁLCULO DEL AHORRO MENSUAL PARA EL BANNER
    const monthlySavings = isFinite(realAbsoluteSavings) ? realAbsoluteSavings * safeMonthlyProduction : 0;

    return { 
      data, 
      actualCostCurrent, 
      actualCostPremium, 
      realAbsoluteSavings, 
      realSavingsPercentage,
      tcPremium,
      monthlySavings,
      hpCurrent,
      hpPremium,
      loadCurrent,
      loadPremium,
    };
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, feedCurrent, feedPremium, vcCurrent, vcPremium, pcsCurrent, pcsPremium, tcCurrentMin, tcCurrentSec, zCurrent, zPremium, edgesCurrent, edgesPremium, operationType, monthlyProduction, ap, machinePowerHP, geometryCurrent, geometryPremium]);

  const premiumMins = Math.floor(curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0);
  const premiumSecs = Math.round(((curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0) - premiumMins) * 60);

  // --- CUSTOM TOOLTIP PARA RECHARTS (Con % de Ahorro) ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // 1. Detectar si estamos en los puntos reales del usuario
      const isUserCurrentVc = label === (Number(vcCurrent) || 0);
      const isUserPremiumVc = label === (Number(vcPremium) || 0);

      // 2. Obtener los costos a mostrar
      const displayCostCurrent = isUserCurrentVc ? curveDataInfo.actualCostCurrent : payload[0]?.value;
      const displayCostPremium = isUserPremiumVc ? curveDataInfo.actualCostPremium : payload[1]?.value;

      // 3. Calcular el Porcentaje de Ahorro Real
      const currentCost = curveDataInfo.actualCostCurrent;
      const premiumCost = curveDataInfo.actualCostPremium;
      const savingsPercentage = currentCost > 0 ? ((currentCost - premiumCost) / currentCost) * 100 : 0;

      return (
        <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xl text-sm min-w-[220px]">
          <p className="font-black text-slate-700 mb-3 border-b pb-1">Vc: {label} m/min</p>
          
          <div className="space-y-3">
            {/* COMPETIDOR */}
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase">
                {isUserCurrentVc ? '🔴 COSTO REAL (Tu Parámetro)' : 'Costo Teórico (Competidor)'}
              </p>
              <p className="font-bold text-red-700">USD {Number(displayCostCurrent).toFixed(2)}</p>
            </div>
            
            {/* PREMIUM + BADGE DE AHORRO */}
            <div>
              <p className="text-[10px] font-bold text-green-600 uppercase">
                {isUserPremiumVc ? '🟢 COSTO REAL (Nuestra Propuesta)' : 'Costo Teórico (Premium)'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-bold text-green-700">USD {Number(displayCostPremium).toFixed(2)}</p>
                
                {/* Lógica Condicional: Mostrar etiqueta solo en puntos reales y si hay ahorro */}
                {(isUserCurrentVc || isUserPremiumVc) && savingsPercentage > 0.1 && (
                  <span className="bg-green-100 text-green-800 border border-green-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center shadow-sm">
                    ↓ {savingsPercentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Nota al pie condicional */}
          {(isUserCurrentVc || isUserPremiumVc) && (
            <p className="mt-3 pt-2 border-t text-[9px] text-slate-400 italic leading-tight">
              *Los puntos marcados usan el cálculo empírico exacto ingresado en el formulario (rendimiento y tiempos reales).
            </p>
          )}
        </div>
      );
    }
    return null;
  };

    const getLoadColor = (load: number) => {
        if (load < 20) return { bar: 'bg-red-500', text: 'text-red-700', label: 'Subutilizado (Sube Avance)' };
        if (load <= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Óptimo / Seguro' };
        if (load <= 95) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Desbaste Pesado' };
        return { bar: 'bg-red-600 animate-pulse', text: 'text-red-800 font-black', label: '¡PELIGRO: Sobrecarga!' };
    };

  return (
    <div className="container mx-auto space-y-8 pb-16">
      {/* HEADER Y BOTONES DE ACCIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-blue-600 h-7 w-7" />
            Análisis de Curva de Costos
          </h1>
          <p className="text-slate-500 text-sm mt-1">Compara la Vc actual vs. la propuesta para demostrar el ahorro real.</p>
        </div>

        {/* BOTONERA ESTILO "SIMULADOR PRINCIPAL" */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={() => handleGeneratePDF('download')}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳ Generando...</span> : <>
              <FileText size={16} />
              PDF
            </>}
          </button>
          
          <button
            onClick={() => handleGeneratePDF('share')}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳...</span> : <>
              <Share2 size={16} />
              WhatsApp
            </>}
          </button>
          <button
            onClick={() => setIsSaveModalOpen(true)}
            disabled={isSaving}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <Save size={16} />
            Guardar Análisis
          </button>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL: INPUTS ARRIBA, GRÁFICO ABAJO */}
      <div className="space-y-6">
        
        {/* PANEL DE INPUTS (Horizontal 4 Columnas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* 1. PARÁMETROS GENERALES */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <h2 className="font-bold text-slate-700 text-xs uppercase border-b border-slate-200 pb-2 mb-3">1. Parámetros del Taller</h2>
            {/* TOGGLE SWITCH: TORNEADO / FRESADO */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mb-4 mt-2">
              <button
                onClick={() => setOperationType('turning')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'turning' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🔄 Torneado
              </button>
              <button
                onClick={() => setOperationType('milling')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'milling' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                ⚙️ Fresado
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="block text-[11px] font-bold text-slate-500 mb-1">Pieza / Operación</Label>
                <Input type="text" placeholder="Ej: Eje principal" className="w-full" value={pieceName} onChange={e => setPieceName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="block text-[11px] font-bold text-slate-500 mb-1">Material</Label>
                  <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un material" />
                    </SelectTrigger>
                    <SelectContent>
                        {MATERIALS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-[11px] font-bold text-slate-500 mb-1">Prof. Corte (ap) mm</Label>
                  <Input type="number" step="0.1" placeholder="Ej: 2.0" value={ap} onChange={e => setAp(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div>
                  <Label className="block text-[11px] font-bold text-slate-500 mb-1">Motor Máquina (HP)</Label>
                  <Input type="number" step="0.5" className="font-bold text-blue-700" value={machinePowerHP} onChange={e => setMachinePowerHP(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="machine-cost" className="block text-[11px] font-bold text-slate-500 mb-1">Costo Máquina ($/hr)</Label>
                  <Input id="machine-cost" type="number" value={machineCostHr} onChange={e => setMachineCostHr(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="tool-change-time" className="block text-[11px] font-bold text-slate-500 mb-1">Cambio Herram. (min)</Label>
                  <Input id="tool-change-time" type="number" value={toolChangeTime} onChange={e => setToolChangeTime(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. SITUACIÓN ACTUAL (COMPETIDOR) */}
          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 flex flex-col justify-between">
            <h2 className="font-bold text-red-700 text-xs uppercase mb-3 flex items-center gap-1">🔴 Condición Actual</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">
                  Inserto {operationType === 'turning' ? 'Torno' : 'Fresa'} ($)
                </Label>
                <Input type="number" className="border-red-200" value={toolCostCurrent} onChange={e => setToolCostCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Filos / Inserto</Label>
                <Input type="number" placeholder="Ej: 4" className="border-red-200 placeholder:text-red-200/50" value={edgesCurrent} onChange={e => setEdgesCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1 flex items-center gap-1">
                  Geometría
                  {geometryCurrent === 'negative' && <span title="Suele tener el doble de filos" className="cursor-help text-red-400">💡</span>}
                </Label>
                <Select value={geometryCurrent} onValueChange={(value) => setGeometryCurrent(value as 'positive' | 'negative')}>
                    <SelectTrigger className="border-red-200 text-red-800 font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="positive">Positiva (1.0x)</SelectItem>
                        <SelectItem value="negative">Negativa (+15% HP)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              {operationType === 'milling' && (
                <div>
                  <Label className="block text-[10px] font-bold text-red-600 mb-1">Cant. Insertos (Z)</Label>
                  <Input type="number" placeholder="Ej: 6" className="border-red-200 placeholder:text-red-200/50" value={zCurrent} onChange={e => setZCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              )}
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">
                  Avance {operationType === 'turning' ? '(mm/rev)' : '(mm/z)'}
                </Label>
                <Input type="number" step="0.01" className="border-red-200" value={feedCurrent} onChange={e => setFeedCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Vc Actual (m/min)</Label>
                <Input type="number" className="border-red-200" value={vcCurrent} onChange={e => setVcCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-600 mb-1">Pzas / filo</Label>
                <Input type="number" className="border-red-200" value={pcsCurrent} onChange={e => setPcsCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-700 mb-1">Tiempo Actual (Corte)</Label>
                <div className="flex gap-2">
                  <div className="relative w-1/2">
                    <Input type="number" className="pr-7 border-red-300 font-bold" value={tcCurrentMin} onChange={e => setTcCurrentMin(e.target.value === "" ? "" : Number(e.target.value))} />
                    <span className="absolute right-2 top-2.5 text-[10px] font-bold text-red-400">min</span>
                  </div>
                  <div className="relative w-1/2">
                    <Input type="number" className="pr-7 border-red-300 font-bold" value={tcCurrentSec} onChange={e => setTcCurrentSec(e.target.value === "" ? "" : Number(e.target.value))} />
                    <span className="absolute right-2 top-2.5 text-[10px] font-bold text-red-400">seg</span>
                  </div>
                </div>
              </div>
              <div className="col-span-2 mt-3 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga de Husillo (HP)</span>
                  <span className={`text-xs font-black ${getLoadColor(curveDataInfo.loadCurrent).text}`}>
                    ⚡ {curveDataInfo.hpCurrent.toFixed(1)} HP ({curveDataInfo.loadCurrent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden border border-slate-200">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${getLoadColor(curveDataInfo.loadCurrent).bar}`} style={{ width: `${Math.min(curveDataInfo.loadCurrent, 100)}%` }}></div>
                </div>
                <p className={`text-[9px] font-bold text-right uppercase ${getLoadColor(curveDataInfo.loadCurrent).text}`}>
                  {getLoadColor(curveDataInfo.loadCurrent).label}
                </p>
              </div>
            </div>
          </div>

          {/* 3. PROPUESTA PREMIUM */}
          <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex flex-col justify-between">
            <h2 className="font-bold text-green-700 text-xs uppercase mb-3 flex items-center gap-1">🟢 Propuesta Premium</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">
                    Inserto {operationType === 'turning' ? 'Torno' : 'Fresa'} ($)
                </Label>
                <Input type="number" className="border-green-200" value={toolCostPremium} onChange={e => setToolCostPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Filos / Inserto</Label>
                <Input type="number" placeholder="Ej: 8" className="border-green-200 placeholder:text-green-200/50" value={edgesPremium} onChange={e => setEdgesPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1 flex items-center gap-1">
                  Geometría
                  {geometryPremium === 'negative' && <span title="Asegúrate de ajustar los filos" className="cursor-help text-green-500">💡</span>}
                </Label>
                <Select value={geometryPremium} onValueChange={(value) => setGeometryPremium(value as 'positive' | 'negative')}>
                    <SelectTrigger className="border-green-200 text-green-800 font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="positive">Positiva (1.0x)</SelectItem>
                        <SelectItem value="negative">Negativa (+15% HP)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              {operationType === 'milling' && (
                <div>
                  <Label className="block text-[10px] font-bold text-green-700 mb-1">Cant. Insertos (Z)</Label>
                  <Input type="number" placeholder="Ej: 5" className="border-green-200 placeholder:text-green-200/50" value={zPremium} onChange={e => setZPremium(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              )}
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">
                  Avance {operationType === 'turning' ? '(mm/rev)' : '(mm/z)'}
                </Label>
                <Input type="number" step="0.01" className="border-green-200" value={feedPremium} onChange={e => setFeedPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Vc Propuesta (m/min)</Label>
                <Input type="number" className="border-green-200" value={vcPremium} onChange={e => setVcPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-700 mb-1">Pzas / filo</Label>
                <Input type="number" className="border-green-200" value={pcsPremium} onChange={e => setPcsPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1">Tiempo Deducido (Corte)</Label>
                <div className="w-full p-2 border-2 border-green-300 bg-green-100 text-green-800 rounded-md text-sm font-bold flex items-center justify-center shadow-inner h-10">
                  {premiumMins} min {premiumSecs} seg
                </div>
              </div>
              <div className="col-span-2 mt-3 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga de Husillo (HP)</span>
                  <span className={`text-xs font-black ${getLoadColor(curveDataInfo.loadPremium).text}`}>
                    ⚡ {curveDataInfo.hpPremium.toFixed(1)} HP ({curveDataInfo.loadPremium.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden border border-slate-200">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${getLoadColor(curveDataInfo.loadPremium).bar}`} style={{ width: `${Math.min(curveDataInfo.loadPremium, 100)}%` }}></div>
                </div>
                <p className={`text-[9px] font-bold text-right uppercase ${getLoadColor(curveDataInfo.loadPremium).text}`}>
                  {getLoadColor(curveDataInfo.loadPremium).label}
                </p>
              </div>
            </div>
          </div>

          {/* 4. VOLUMEN DE PRODUCCIÓN */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h2 className="font-bold text-slate-700 text-xs uppercase border-b border-slate-200 pb-2 mb-3">4. Escala Comercial</h2>
            <div>
              <Label htmlFor="monthly-prod-input" className="block text-[11px] font-bold text-slate-500 mb-1">Prod. Mensual (Piezas)</Label>
              <Input id="monthly-prod-input" type="number" className="w-full text-2xl bg-slate-50 font-black text-blue-700 text-center" value={monthlyProduction} onChange={e => setMonthlyProduction(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>

        </div>

        {/* GRAFICO (Ancho Completo Abajo) */}
        <Card>
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
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }} />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#ef4444' }} />
                        <Line type="monotone" dataKey="costoPremium" name="Inserto Premium" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#22c55e' }} />

                        {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={Number(vcCurrent)} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                        {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={Number(vcPremium)} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

       {/* EL GRAN REMATE VISUAL - AHORRO MENSUAL */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-8 text-center shadow-2xl relative overflow-hidden mt-6">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black opacity-10 rounded-full blur-2xl"></div>
        
        <p className="relative z-10 text-green-100 font-bold tracking-widest uppercase text-sm mb-2">💰 Impacto Financiero Proyectado</p>
        <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white drop-shadow-md mb-3">
          {formatCurrency(curveDataInfo.monthlySavings)}
        </h2>
        <p className="relative z-10 text-lg text-green-50 font-medium">
          Ahorro mensual neto al fabricar <span className="font-bold text-white bg-green-700 px-2 py-1 rounded">{formatNumber(Number(monthlyProduction))} piezas</span> con tecnología Secocut Premium.
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

        {/* MODAL DE GUARDADO EN CRM */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 p-4">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                💾 Guardar Análisis
              </h3>
              <p className="text-xs text-slate-500 mt-1">Este análisis se guardará en la tabla de Historial.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="block text-xs font-bold text-slate-700 mb-1">Cliente / Empresa</Label>
                <Input type="text" placeholder="Ej: John Deere" className="w-full" value={saveClientName} onChange={e => setSaveClientName(e.target.value)} />
              </div>
              
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Ahorro Anual Proyectado (Automático)</p>
                <p className="font-black text-emerald-800 text-xl">
                  {formatCurrency((curveDataInfo.realAbsoluteSavings * (Number(monthlyProduction)||0)) * 12)}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <Button variant="ghost" onClick={() => setIsSaveModalOpen(false)}>Cancelar</Button>
              <Button 
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    // 1. Generar el PDF en segundo plano
                    const pdfBlob = await generatePdfBlob();
                    let pdfDownloadUrl = "";

                    // 2. Subir a Firebase Storage si se generó correctamente
                    if (pdfBlob && storage) {
                      const fileName = `taylor_reports/Simulacion_${pieceName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
                      const storageRef = ref(storage, fileName);
                      await uploadBytes(storageRef, pdfBlob);
                      pdfDownloadUrl = await getDownloadURL(storageRef);
                    }

                    // 3. Guardar en el Historial (No en el CRM principal)
                    const payload = {
                      clientName: saveClientName,
                      caseName: pieceName || 'Análisis sin nombre',
                      status: 'saved', // Estado base
                      annualSavings: (curveDataInfo.realAbsoluteSavings * (Number(monthlyProduction)||0)) * 12,
                      pdfUrl: pdfDownloadUrl,
                      dateCreated: serverTimestamp(),
                      taylorInputs: { 
                        operationType, 
                        materialId, 
                        ap, 
                        machinePowerHP, 
                        machineCostHr, 
                        toolChangeTime,
                        monthlyProduction,
                        current: { toolCostCurrent, edgesCurrent, geometryCurrent, zCurrent, feedCurrent, vcCurrent, pcsCurrent, tcCurrentMin, tcCurrentSec },
                        premium: { toolCostPremium, edgesPremium, geometryPremium, zPremium, feedPremium, vcPremium, pcsPremium }
                      }
                    };

                    await addDoc(collection(db, "simulaciones_historial"), payload);
                    
                    setIsSaveModalOpen(false);
                    alert("¡Análisis guardado en el Historial con éxito!");
                  } catch (error) {
                    console.error("Error al guardar:", error);
                    alert("Hubo un error al guardar el registro.");
                  } finally {
                    setIsSaving(false);
                  }
                }} 
                disabled={isSaving || !saveClientName}
                className="flex items-center gap-2"
              >
                {isSaving ? '⏳ Guardando...' : 'Guardar Registro'}
              </Button>
            </div>
          </div>
        </div>
      )}

        {/* PLANTILLA OCULTA PARA PDF (Renderizada fuera de pantalla para html2canvas) */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id="pdf-taylor-template" className="w-[210mm] min-h-[290mm] bg-white text-black p-10 font-sans box-border flex flex-col">
            
            {/* HEADER DEL PDF CON LOGOS */}
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="h-12 flex items-center justify-center bg-blue-600 text-white font-black px-4 rounded text-lg">
                  SECOCUT
                </div>
                
                <div className="ml-2">
                  <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Análisis de Curva de Costos: {pieceName || 'Sin Nombre'}</h1>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">Secocut SRL</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase">FECHA</p>
                <p className="text-base font-semibold text-slate-800">{new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">1. Condiciones de Trabajo Evaluadas</h2>
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div><p className="text-slate-500">Material:</p><p className="font-bold">{MATERIALS.find(m => m.id === materialId)?.name}</p></div>
                <div><p className="text-slate-500">Costo Máquina:</p><p className="font-bold">{formatCurrency(Number(machineCostHr))}</p></div>
                <div><p className="text-slate-500">Tiempo Cambio Herr.:</p><p className="font-bold">{toolChangeTime} min</p></div>
                <div><p className="text-slate-500">Producción Mensual:</p><p className="font-bold">{formatNumber(Number(monthlyProduction))} pzs/mes</p></div>
              </div>
            </div>

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
                    <td className="p-2 border border-slate-300">{formatCurrency(Number(toolCostCurrent))}</td>
                    <td className="p-2 border border-slate-300">{formatCurrency(Number(toolCostPremium))}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Tiempo de Corte (min)</td>
                    <td className="p-2 border border-slate-300">{`${tcCurrentMin || 0}m ${tcCurrentSec || 0}s`}</td>
                    <td className="p-2 border border-slate-300">{`${premiumMins}m ${premiumSecs}s`}</td>
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
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Consumo de Motor</td>
                    <td className="p-2 border border-slate-300">{curveDataInfo.hpCurrent.toFixed(1)} HP ({curveDataInfo.loadCurrent.toFixed(1)}%)</td>
                    <td className="p-2 border border-slate-300">{curveDataInfo.hpPremium.toFixed(1)} HP ({curveDataInfo.loadPremium.toFixed(1)}%)</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-300 font-bold text-slate-800">Costo Real por Pieza</td>
                    <td className="p-2 border border-slate-300 font-bold text-red-600">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</td>
                    <td className="p-2 border border-slate-300 font-bold text-green-600">{isFinite(curveDataInfo.actualCostPremium) ? formatCurrency(curveDataInfo.actualCostPremium) : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
              <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2 mt-2">Ahorro Mensual Proyectado</p>
              <p className="text-5xl font-black text-green-800 mb-2">
                {formatCurrency(curveDataInfo.monthlySavings)}
              </p>
              <div className="inline-block bg-green-100 px-4 py-2 rounded-full mt-2">
                <p className="text-sm font-bold text-green-800">
                  Basado en {formatNumber(Number(monthlyProduction))} piezas/mes • Ahorro unitario: {formatCurrency(curveDataInfo.realAbsoluteSavings)}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">2. Análisis de Curva de Costos</h2>
              <div className="w-[180mm] h-[300px] mx-auto border border-slate-200 p-2 bg-white">
                <LineChart width={650} height={280} data={curveDataInfo.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="speed" label={{ value: 'Vc (m/min)', position: 'bottom', offset: -5 }} />
                  <YAxis label={{ value: 'Costo USD', angle: -90, position: 'insideLeft' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="costoActual" stroke="#ef4444" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="costoPremium" stroke="#22c55e" strokeWidth={3} dot={false} />
                  {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={Number(vcCurrent)} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                  {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={Number(vcPremium)} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
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
