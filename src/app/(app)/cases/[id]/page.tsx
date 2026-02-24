"use client";

import { useEffect, useState, useCallback } from "react";
import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// --- FORMATOS (Helpers) ---
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}
const formatPercent = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
}
const formatNumber = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val);
}

// Función para convertir minutos decimales a formato legible (ej: 1m 50s)
const formatoMinutosYSegundos = (minutosDecimales: number): string => {
  if (!minutosDecimales || minutosDecimales <= 0) return "0m 0s";
  const min = Math.floor(minutosDecimales);
  const seg = Math.round((minutosDecimales - min) * 60);
  return seg === 60 ? `${min + 1}m 0s` : `${min}m ${seg}s`;
};

// --- SUB-COMPONENTES (Texto Grande 10px, pero Fila Compacta 22px) ---

interface RowProps { label: string; valA: any; valB: any; bold?: boolean; isRed?: boolean; }

// CLAVE: text-[10px] para leer bien, pero min-h-[22px] y py-0.5 para que entren todas las filas en la hoja
const Row = ({ label, valA, valB, bold = false, isRed = false }: RowProps) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-200 px-2 bg-white items-center text-[10px] min-h-[22px]", bold && "font-bold bg-slate-50")}>
        <div className="col-span-4 font-medium text-slate-600 text-left flex items-center h-full leading-none">{label}</div>
        <div className={cn("col-span-3 flex items-center justify-center h-full leading-none", isRed ? "text-[#D93025] font-bold" : "text-slate-700")}>{valA}</div>
        <div className={cn("col-span-3 flex items-center justify-center h-full leading-none", isRed ? "text-[#1A73E8] font-bold" : "text-slate-700")}>{valB}</div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="bg-[#F1F3F4] px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase border-y border-slate-300 text-left tracking-wider flex items-center h-5">{title}</div>
);

interface FinancialRowProps { label: string; valA: any; valB: any; save: any; pct: any; }

const FinancialRow = ({ label, valA, valB, save, pct }: FinancialRowProps) => (
    <div className="grid grid-cols-12 border-b border-green-100 px-2 bg-white text-[10px] min-h-[24px]">
        <div className="col-span-3 font-medium text-slate-600 text-left flex items-center h-full leading-none">{label}</div>
        <div className="col-span-2 text-slate-600 flex items-center justify-center h-full leading-none">{valA}</div>
        <div className="col-span-2 text-slate-600 flex items-center justify-center h-full leading-none">{valB}</div>
        <div className="col-span-3 font-bold text-[#137333] flex items-center justify-center h-full leading-none">{save}</div>
        <div className="col-span-2 text-[#137333] font-bold flex items-center justify-center h-full leading-none">{pct}</div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function CaseDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { id } = params;
  const [isDownloading, setIsDownloading] = useState(false);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);
  const { data: rawData, isLoading } = useDoc<any>(docRef);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc<any>(settingsRef);

  const data = rawData || {};
  const r = data.results || {}; 

  // Cálculos
  const costoMinuto = (data.machineHourlyRate || 0) / 60;
  const tcA = (data.cicloMinA || 0) + ((data.cicloSegA || 0) / 60);
  const tcB = (data.cicloMinB || 0) + ((data.cicloSegB || 0) / 60);
  const timeInCutA = (data.tiempoCorteA && data.tiempoCorteA > 0) ? data.tiempoCorteA : tcA;
  const timeInCutB = (data.tiempoCorteB && data.tiempoCorteB > 0) ? data.tiempoCorteB : tcB;
  const insertosMesA = r.insertosNecesariosA || 0;
  const insertosMesB = r.insertosNecesariosB || 0;
  const costoInsertosMesA = insertosMesA * (data.precioA || 0);
  const costoInsertosMesB = insertosMesB * (data.precioB || 0);
  const turnosA = (r.turnosMensualesA || 0);
  const turnosB = (r.turnosMensualesB || 0);
  const turnosAhorrados = turnosA - turnosB;
  
  // Variables para el desglose (y para actualizar la conclusión)
  const piezasAlMes = data.piezasAlMes || 0;
  const costoHora = data.machineHourlyRate || 0;
  const horasA = (tcA * piezasAlMes) / 60;
  const horasB = (tcB * piezasAlMes) / 60;
  const horasLiberadas = horasA - horasB;
  const dineroExtraAnual = horasLiberadas * costoHora * 12;
  const piezasExtraMes = tcB > 0 ? Math.floor((horasLiberadas * 60) / tcB) : 0;
  const impactoEconomicoTotal = (r.ahorroAnual || 0) + (dineroExtraAnual || 0);
  
  const validImages = data.imageUrls?.filter((url: string) => url && url.trim() !== "") || [];
  const hasThirdPage = data.technicalConclusion && data.technicalConclusion.trim() !== '';
  const piecesBase = data.piezasAlMes || 1;
  const pctIncrementoProduccion = piezasExtraMes > 0 ? (piezasExtraMes / piecesBase) * 100 : 0;

  const handleDownloadPDF = useCallback(async () => {
    if (!rawData) return;
    setIsDownloading(true);
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('report-container');
        
        const opt = {
            margin:       0, // IMPORTANTE: Margen 0
            filename:     `Informe_${data.name || 'Caso'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            // Evitamos cortes automáticos
            pagebreak:    { mode: 'css', before: '.pdf-page' }
        };
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Hubo un error al generar el PDF.");
    } finally {
        setIsDownloading(false);
    }
  }, [rawData, data.name]);

  useEffect(() => {
    const shouldDownload = searchParams.get("download") === "true";
    if (shouldDownload && !isLoading && rawData && !isDownloading) {
      const newUrl = window.location.pathname; 
      window.history.replaceState(null, '', newUrl);
      const timer = setTimeout(() => { handleDownloadPDF(); }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData, isDownloading, handleDownloadPDF]);

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData && !isLoading) return <div className="p-8 text-center text-red-500">Error: Caso no encontrado.</div>;

  return (
    <div className="bg-gray-100 text-slate-900 font-sans printable-area min-h-screen">
      {/* CSS: Height 296mm y Overflow Hidden = No más hojas blancas */}
      <style jsx global>{`
        @media print {
            @page { margin: 0; size: A4; }
            body { margin: 0; padding: 0; }
        }
        .pdf-page { 
            width: 210mm; 
            height: 296mm; 
            padding: 25px 40px; 
            background: white; 
            position: relative; 
            display: flex; 
            flex-direction: column; 
            box-sizing: border-box; 
            overflow: hidden; 
            page-break-after: always;
        }
        .pdf-page:last-child { 
            page-break-after: avoid; 
        }
      `}</style>
      
      <div className="flex justify-between items-center p-6 max-w-5xl mx-auto no-print">
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
            <Button onClick={handleDownloadPDF} disabled={isDownloading} className="bg-green-600 hover:bg-green-700 text-white border-none"><Download className="mr-2 h-4 w-4" /> {isDownloading ? 'Generando...' : 'Descargar PDF'}</Button>
        </div>
      </div>

      <div id="report-container" className="mx-auto w-fit bg-gray-100">
        
        {/* ================= PÁGINA 1 ================= */}
        <div className="pdf-page">
            <div className="flex justify-between items-center mb-6 h-12">
                <div className="w-1/3 flex justify-start">{settings?.companyLogoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */<img src={settings.companyLogoUrl} alt="Logo" className="h-10 object-contain" />) : <div className="h-10 w-32"></div>}</div>
                <div className="w-1/3 flex justify-end">{settings?.secoLogoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */<img src={settings.secoLogoUrl} alt="Seco" className="h-8 object-contain" />) : <div className="h-10 w-32"></div>}</div>
            </div>
            
            <div className="mb-6 border-b-2 border-slate-800 pb-3">
                <h1 className="text-3xl font-black text-slate-800 uppercase leading-none tracking-tight text-center">ANALIZADOR DE COSTOS</h1>
                <div className="flex justify-between items-end mt-3">
                    <p className="text-xl font-bold text-blue-600 truncate max-w-[70%] leading-normal pb-1">{data.name}</p>
                    <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">INFORME TÉCNICO</p><p className="font-bold text-slate-800 text-sm">{new Date().toLocaleDateString()}</p></div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200 shadow-sm">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div className="border-b border-slate-300 pb-2 flex flex-col justify-end">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</span>
                        <span className="block text-lg font-bold text-slate-700 truncate leading-normal pb-0.5">{data.cliente || '-'}</span>
                    </div>
                    <div className="border-b border-slate-300 pb-2 flex flex-col justify-end">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Operación</span>
                        <span className="block text-lg font-bold text-slate-700 truncate leading-normal pb-0.5">{data.operacion || '-'}</span>
                    </div>
                    <div className="border-b border-slate-300 pb-2 flex flex-col justify-end">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Material</span>
                        <span className="block text-lg font-bold text-slate-700 truncate leading-normal pb-0.5">{data.material || '-'}</span>
                    </div>
                    <div className="border-b border-slate-300 pb-2 flex flex-col justify-end">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impacto Económico Total</span>
                        <span className="block text-2xl font-black text-green-600 leading-normal pb-0.5">{formatCurrency(impactoEconomicoTotal)}</span>
                        <p className="text-[9px] text-slate-500 -mb-1">(Ahorro Directo + Ganancia Potencial)</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center mb-6 min-h-[220px]">
                 {validImages.length > 0 ? (
                    <div className="flex flex-col h-full justify-center">
                        <div className="text-center mb-4 px-4"><h3 className="text-sm font-bold text-blue-900 italic font-serif leading-relaxed">&ldquo;Se pueden conseguir Resultados o Excusas, no las dos cosas.&rdquo;</h3><div className="h-0.5 w-16 bg-blue-500 mx-auto mt-2 rounded-full opacity-50"></div></div>
                        <div className="flex items-center justify-center h-full">
                            {validImages.length === 1 && (<div className="flex flex-col items-center justify-center w-full"><div className="border-4 border-white shadow-lg rounded-lg overflow-hidden bg-white max-h-[320px] w-auto flex items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={validImages[0]} alt="Evidencia" className="object-contain max-h-[320px] max-w-full" /></div>{data.imageDescriptions?.[0] && <p className="mt-2 text-[10px] font-bold text-slate-700 bg-slate-100 px-3 py-0.5 rounded-full uppercase border border-slate-200">{data.imageDescriptions[0]}</p>}</div>)}
                            {validImages.length > 1 && (<div className="grid grid-cols-2 gap-3 w-full items-center">{validImages.map((url: string, index: number) => (<div key={index} className="flex flex-col items-center"><div className="border-4 border-white shadow-md rounded-lg overflow-hidden w-full h-[160px] bg-white flex items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Evidencia ${index + 1}`} className="object-contain max-h-full max-w-full" /></div>{data.imageDescriptions?.[index] && <p className="mt-1 text-[10px] font-bold text-slate-600 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{data.imageDescriptions[index]}</p>}</div>))}</div>)}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl m-4 h-40 bg-slate-50"><p className="text-slate-400 italic mb-2 text-sm">Sin evidencia visual</p><p className="text-xs font-bold text-slate-400 italic font-serif">"Se pueden conseguir Resultados o Excusas, no las dos cosas."</p></div>
                )}
            </div>

            {/* IMPACTO ECONÓMICO TOTAL (NUEVO BLOQUE) */}
            <div className="mt-4 bg-green-50 p-4 border border-green-200 rounded-lg text-center shadow-sm">
              <span className="block text-xs text-green-700 font-bold uppercase tracking-wider mb-1">
                Impacto Económico Total Estimado (Anual)
              </span>
              <span className="block text-2xl text-green-700 font-extrabold">
                ${impactoEconomicoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="block text-xs text-green-600 mt-2 font-medium">
                (Ahorro directo en costos + Potencial de facturación por horas de máquina liberadas)
              </span>
            </div>

            {/* DESGLOSE DE CAPACIDAD LIBERADA */}
            <div className="mt-6 bg-slate-50 p-5 border border-slate-200 rounded-lg">
              <h4 className="font-bold text-slate-800 mb-3 uppercase text-sm tracking-wide">
                Desglose de Capacidad Liberada
              </h4>
              <ul className="text-sm text-slate-700 space-y-2 mb-4 list-disc pl-5">
                <li>
                  <strong>Tiempo Actual:</strong> Hacer {piezasAlMes.toLocaleString()} piezas a {formatoMinutosYSegundos(tcA)} cada una, toma {horasA.toFixed(1)} horas al mes.
                </li>
                <li>
                  <strong>Tiempo Propuesto:</strong> Hacer {piezasAlMes.toLocaleString()} piezas a {formatoMinutosYSegundos(tcB)} cada una, toma {horasB.toFixed(1)} horas al mes.
                </li>
                <li>
                  <strong>Ahorro:</strong> La máquina ahora termina el mismo trabajo en menos tiempo, liberando <span className="font-bold text-green-600">{horasLiberadas.toFixed(1)} horas al mes</span>.
                </li>
              </ul>
              
              <div className="bg-white p-3 border-l-4 border-blue-500 rounded text-sm text-slate-800 italic shadow-sm">
                "Ya que la máquina queda libre, usted puede generar <strong>${dineroExtraAnual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} extras al año</strong>, o lo que es lo mismo, producir <strong>{piezasExtraMes.toLocaleString()} piezas más cada mes</strong>."
              </div>
            </div>
            
            <div className="text-center pt-2 mt-auto border-t border-slate-100"><p className="text-[10px] text-slate-400 uppercase tracking-widest">Generado con Analizador de Costos - Página {hasThirdPage ? '1/3' : '1/2'}</p></div>
        </div>

        {/* ================= PÁGINA 2 (AJUSTADA AL MILÍMETRO) ================= */}
        <div className="pdf-page">
            
            <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2 h-12">
                <div className="flex items-center gap-4">
                    {settings?.companyLogoUrl && /* eslint-disable-next-line @next/next/no-img-element */<img src={settings.companyLogoUrl} alt="Logo" className="h-6 object-contain opacity-50 grayscale" />}
                    <div className="border-l border-slate-300 pl-4">
                        <span className="block text-lg font-bold text-slate-700 uppercase leading-none">Análisis Detallado</span>
                        <span className="block text-[9px] text-slate-400 mt-1 uppercase tracking-wider">Basado en {data.piezasAlMes?.toLocaleString()} pzs/mes @ {formatCurrency(data.machineHourlyRate)}/hr</span>
                    </div>
                </div>
                <div className="text-right"><span className="text-[10px] text-slate-400 font-medium">Página {hasThirdPage ? '2/3' : '2/2'}</span></div>
            </div>

            {/* Visuals - MB reducido a 2 */}
            <div className="mb-2">
                <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Actual</p>
                        <div className="text-3xl font-black text-[#D93025] mb-1 leading-none">{formatCurrency(r.cppA)}</div>
                        <div className="flex w-full h-6 rounded overflow-hidden shadow-sm">
                            <div className="bg-[#D93025] flex items-center justify-center text-white text-[8px] font-bold h-full" style={{ width: '70%' }}>MAQ {formatCurrency(r.costoMaquinaA)}</div>
                            <div className="bg-[#FAD2CF] flex items-center justify-center text-[#8C1B15] text-[8px] font-bold h-full" style={{ width: '30%' }}>HER {formatCurrency(r.costoHerramientaA)}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Propuesta</p>
                        <div className="text-3xl font-black text-[#1A73E8] mb-1 leading-none">{formatCurrency(r.cppB)}</div>
                        <div className="flex w-full h-6 rounded overflow-hidden shadow-sm">
                            <div className="bg-[#1A73E8] flex items-center justify-center text-white text-[8px] font-bold h-full" style={{ width: '70%' }}>MAQ {formatCurrency(r.costoMaquinaB)}</div>
                            <div className="bg-[#D2E3FC] flex items-center justify-center text-[#174EA6] text-[8px] font-bold h-full" style={{ width: '30%' }}>HER {formatCurrency(r.costoHerramientaB)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI - MB reducido a 2 */}
            <div className="mb-2 bg-[#F8F9FA] border border-slate-200 rounded-lg p-2 shadow-sm">
                <h3 className="text-center text-[9px] font-bold text-slate-700 uppercase mb-2 tracking-widest">Inversión vs. Ahorro</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded p-1.5 text-center shadow-sm">
                        <p className={cn("text-[8px] font-bold uppercase mb-0.5 tracking-wide", r.toolCostIncreasePercent < 0 ? "text-[#137333]" : "text-slate-500")}>
                            {r.toolCostIncreasePercent < 0 ? "Ahorro en Herramientas" : "Inversión Herramienta"}
                        </p>
                        <p className={cn("text-2xl font-black mb-0.5 leading-none", r.toolCostIncreasePercent < 0 ? "text-[#137333]" : "text-slate-700")}>
                            {formatPercent(Math.abs(r.toolCostIncreasePercent || 0))}
                        </p>
                        <p className="text-[7px] text-slate-400 uppercase tracking-widest font-semibold">
                            {r.toolCostIncreasePercent < 0 ? "(Menor consumo)" : "(Mayor costo compra)"}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-1.5 text-center shadow-sm">
                        <p className="text-[8px] font-bold text-slate-500 uppercase mb-0.5 tracking-wide">Mejora Costo Total</p>
                        <p className={cn("text-2xl font-black mb-0.5 leading-none", r.totalCostReductionPercent > 0 ? "text-[#1A73E8]" : "text-slate-700")}>
                            {formatPercent(r.totalCostReductionPercent)}
                        </p>
                        <p className="text-[7px] text-slate-400 uppercase tracking-widest font-semibold">
                            (Impacto final en pieza)
                        </p>
                    </div>
                </div>
            </div>

            {/* Payback - MB reducido a 2 */}
            {(r.inversionInicial > 0) && (
                <div className="mb-2 bg-[#FEF7E0] border border-[#FEEFC3] rounded-lg p-2 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-[9px] font-bold text-[#B06000] uppercase tracking-widest mb-0.5">Retorno de Inversión (ROI)</p>
                        <p className="text-[10px] text-slate-600">Costo Implementación: <span className="font-bold text-slate-900">{formatCurrency(r.inversionInicial)}</span></p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1">
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">Se paga en:</span>
                            <p className="text-2xl font-black text-slate-800 leading-none">{r.paybackMonths < 0.1 ? "Inmediato" : r.paybackMonths.toFixed(1)}</p>
                            <span className="text-[10px] font-bold text-slate-600">Meses</span>
                        </div>
                        {r.paybackMonths > 0 && (<p className="text-[8px] text-green-600 font-bold mt-0.5 uppercase tracking-wide">A partir del mes {Math.ceil(r.paybackMonths)}, ganancia pura.</p>)}
                    </div>
                </div>
            )}

            {/* Tabla Técnica (TEXTO 10PX) */}
            <div className="mb-2 border border-slate-300 rounded-t-lg rounded-b-lg overflow-hidden text-[10px] shadow-sm break-inside-avoid">
                <div className="grid grid-cols-10 bg-[#F1F3F4] font-bold border-b border-slate-300 py-1 px-2 text-[10px] tracking-wide items-center"><div className="col-span-4 text-slate-700">PARÁMETRO</div><div className="col-span-3 text-center text-[#D93025]">ACTUAL (A)</div><div className="col-span-3 text-center text-[#1A73E8]">PROPUESTA (B)</div></div>
                <SectionTitle title="DATOS DEL INSERTO" />
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos/Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="VIDA ÚTIL (Pzs/Filo)" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <Row label="Tiempo Proc. por Filo (min)" valA={`${r.minutosFiloA?.toFixed(1)}`} valB={`${r.minutosFiloB?.toFixed(1)}`} />
                <Row label="Tiempo Corte/Pieza" valA={formatoMinutosYSegundos(timeInCutA)} valB={formatoMinutosYSegundos(timeInCutB)} />
                <div className="grid grid-cols-10 border-b border-slate-200 px-2 bg-white items-center text-[10px] min-h-[22px]"><div className="col-span-4 font-medium text-slate-600 flex items-center h-full">Insertos/Mes</div><div className="col-span-3 flex items-center justify-center h-full text-slate-700">{insertosMesA.toFixed(1)} <span className="text-slate-400 ml-1">({formatCurrency(costoInsertosMesA)})</span></div><div className="col-span-3 flex items-center justify-center h-full text-slate-700">{insertosMesB.toFixed(1)} <span className="text-slate-400 ml-1">({formatCurrency(costoInsertosMesB)})</span></div></div>
                <Row label="Costo Herr./Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />
                <SectionTitle title="DATOS DEL PROCESO" />
                <Row label="Tiempo de Ciclo" valA={formatoMinutosYSegundos(tcA)} valB={formatoMinutosYSegundos(tcB)} />
                <Row label="Costo Hora-Máq." valA={formatCurrency(data.machineHourlyRate)} valB={`(${formatCurrency(costoMinuto)}/min)`} />
                <Row label="Costo Parada/Pieza" valA={formatCurrency(r.costoParadaA)} valB={formatCurrency(r.costoParadaB)} />
                <Row label="Costo Máq./Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                <div className="grid grid-cols-10 bg-[#E8EAED] px-2 font-black border-t border-slate-300 text-[10px] tracking-wide min-h-[22px] items-center"><div className="col-span-4 uppercase text-slate-800 flex items-center h-full">COSTO TOTAL / PIEZA</div><div className="col-span-3 flex items-center justify-center h-full text-[#D93025]">{formatCurrency(r.cppA)}</div><div className="col-span-3 flex items-center justify-center h-full text-[#1A73E8]">{formatCurrency(r.cppB)}</div></div>
            </div>

            {/* Tabla Financiera (TEXTO 10PX) */}
            <div className="border border-green-200 rounded-t-lg rounded-b-lg overflow-hidden text-[10px] shadow-sm break-inside-avoid">
                <div className="grid grid-cols-12 bg-[#E6F4EA] py-1 px-2 font-bold text-[#137333] border-b border-green-200 text-[10px] text-center tracking-wide items-center"><div className="col-span-3 text-left">MÉTRICA</div><div className="col-span-2 text-slate-700">ACTUAL</div><div className="col-span-2 text-slate-700">PROPUESTA</div><div className="col-span-3">AHORRO</div><div className="col-span-2">%</div></div>
                <FinancialRow label="Costo Total por Pieza" valA={formatCurrency(r.cppA)} valB={formatCurrency(r.cppB)} save={formatCurrency(r.ahorroPorPieza)} pct={formatPercent(r.totalCostReductionPercent)} />
                <FinancialRow label="Costo Total (Mes)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                <div className="grid grid-cols-12 border-b border-green-100 px-2 bg-white items-center text-center text-[10px] min-h-[26px]"><div className="col-span-3 font-medium text-slate-600 text-left flex items-center h-full">Tiempo Máquina (Mes)</div><div className="col-span-2 text-slate-600 flex items-center justify-center h-full">{r.tiempoMaquinaMensualHorasA?.toFixed(0)} hs</div><div className="col-span-2 text-slate-600 flex items-center justify-center h-full">{r.tiempoMaquinaMensualHorasB?.toFixed(0)} hs</div><div className="col-span-3 font-bold text-[#188038] flex items-center justify-center h-full">{r.machineHoursFreedMonthly?.toFixed(1)} hs lib.</div><div className="col-span-2 text-[#188038] font-bold flex items-center justify-center h-full">{formatPercent(r.timeReductionPercent)}</div></div>
                <div className="grid grid-cols-12 border-b border-green-100 px-2 bg-white items-center text-center text-[10px] min-h-[26px]"><div className="col-span-3 font-medium text-slate-600 text-left flex items-center h-full">Turnos 8hs (Mes)</div><div className="col-span-2 text-slate-600 flex items-center justify-center h-full">{turnosA.toFixed(1)}</div><div className="col-span-2 text-slate-600 flex items-center justify-center h-full">{turnosB.toFixed(1)}</div><div className="col-span-3 font-bold text-[#188038] flex items-center justify-center h-full">{turnosAhorrados.toFixed(1)} lib.</div><div className="col-span-2 text-[#188038] font-bold flex items-center justify-center h-full">{formatPercent(r.timeReductionPercent)}</div></div>
                <div className="grid grid-cols-12 bg-[#CEEAD6] px-2 font-black border-t border-green-300 text-center text-[10px] tracking-wide min-h-[26px] items-center"><div className="col-span-3 text-left uppercase text-slate-800 flex items-center h-full">ANUAL</div><div className="col-span-2 text-slate-800 flex items-center justify-center h-full">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div><div className="col-span-2 text-[#1A73E8] flex items-center justify-center h-full">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div><div className="col-span-3 text-[#137333] text-sm flex items-center justify-center h-full">{formatCurrency(r.ahorroAnual)}</div><div className="col-span-2 text-[#137333] flex items-center justify-center h-full">{formatPercent(r.totalCostReductionPercent)}</div></div>
            </div>

            <div className="mt-auto text-center border-t border-slate-200 pt-3">
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Generado con Analizador de Costos - Página {hasThirdPage ? '2/3' : '2/2'}</p>
                <p className="text-xs font-bold text-blue-600 mt-1">https://secocut-app.web.app</p>
            </div>
        </div>
        
        {/* ================= PÁGINA 3 (TEXTO AUMENTADO A 11PX) ================= */}
        {hasThirdPage && (
            <div className="pdf-page">
                <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-3 h-14">
                    <div className="flex items-center gap-4">
                        {settings?.companyLogoUrl && /* eslint-disable-next-line @next/next/no-img-element */<img src={settings.companyLogoUrl} alt="Logo" className="h-6 object-contain opacity-50 grayscale" />}
                        <div className="border-l border-slate-300 pl-4">
                            <span className="block text-lg font-bold text-slate-700 uppercase leading-none">Informe Técnico</span>
                            <span className="block text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{data.name}</span>
                        </div>
                    </div>
                    <div className="text-right"><span className="text-[10px] text-slate-400 font-medium">Página 3/3</span></div>
                </div>

                <div className="prose prose-sm max-w-none text-justify flex-1">
                    <h2 className="text-lg font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Análisis y Conclusiones Adicionales</h2>
                    {/* TEXTO AUMENTADO A 11PX */}
                    <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {data.technicalConclusion}
                    </div>
                </div>
                
                <div className="mt-auto text-center border-t border-slate-200 pt-4">
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Generado con Analizador de Costos - Página 3/3</p>
                    <p className="text-xs font-bold text-blue-600 mt-1">https://secocut-app.web.app</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}