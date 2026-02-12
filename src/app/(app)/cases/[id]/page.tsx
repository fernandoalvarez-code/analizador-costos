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

// --- SUB-COMPONENTES ---

interface RowProps { label: string; valA: any; valB: any; bold?: boolean; isRed?: boolean; }

const Row = ({ label, valA, valB, bold = false, isRed = false }: RowProps) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-200 py-1 px-3 bg-white text-center items-center text-[9px]", bold && "font-bold bg-slate-50")}>
        <div className="col-span-4 font-medium text-slate-700 text-left">{label}</div>
        <div className={cn("col-span-3", isRed ? "text-red-600 font-bold" : "text-slate-600")}>{valA}</div>
        <div className={cn("col-span-3", isRed ? "text-blue-600 font-bold" : "text-slate-600")}>{valB}</div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="bg-slate-100 px-3 py-1 text-[8px] font-bold text-slate-500 uppercase border-y border-slate-300 text-left">{title}</div>
);

interface FinancialRowProps { label: string; valA: any; valB: any; save: any; pct: any; }

const FinancialRow = ({ label, valA, valB, save, pct }: FinancialRowProps) => (
    <div className="grid grid-cols-12 border-b border-green-100 py-1 px-3 bg-white items-center text-center text-[9px]">
        <div className="col-span-3 font-medium text-slate-700 text-left">{label}</div>
        <div className="col-span-2 text-slate-600">{valA}</div>
        <div className="col-span-2 text-slate-600">{valB}</div>
        <div className="col-span-3 font-bold text-green-600">{save}</div>
        <div className="col-span-2 text-green-600 font-bold">{pct}</div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function CaseDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { id } = params;
  const [isDownloading, setIsDownloading] = useState(false);

  // 1. Obtener datos
  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);
  const { data: rawData, isLoading } = useDoc<any>(docRef);

  // 2. Configuración
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc<any>(settingsRef);

  const data = rawData || {};
  const r = data.results || {}; 

  // --- CÁLCULOS ---
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
  const piezasExtraMes = (r.piezasAdicionalesAnual || 0) / 12;
  const validImages = data.imageUrls?.filter((url: string) => url && url.trim() !== "") || [];

  // Descarga PDF
  const handleDownloadPDF = useCallback(async () => {
    if (!rawData) return;
    setIsDownloading(true);
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('report-container');
        
        const opt = {
            margin:       0, 
            filename:     `Informe_${data.name || 'Caso'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Hubo un error al generar el PDF.");
    } finally {
        setIsDownloading(false);
    }
  }, [rawData, data.name]);

  // Auto-imprimir (Legacy)
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      const timer = setTimeout(() => { window.print(); }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData]);

  // Auto-descarga
  useEffect(() => {
    const shouldDownload = searchParams.get("download") === "true";
    if (shouldDownload && !isLoading && rawData && !isDownloading) {
      const newUrl = window.location.pathname; 
      window.history.replaceState(null, '', newUrl);

      const timer = setTimeout(() => { 
        handleDownloadPDF(); 
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData, isDownloading, handleDownloadPDF]);

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData && !isLoading) return <div className="p-8 text-center text-red-500">Error: Caso no encontrado.</div>;

  return (
    <div className="bg-gray-100 text-slate-900 font-sans printable-area min-h-screen">
      <style jsx global>{`
        .pdf-page {
            width: 210mm;
            min-height: 290mm;
            padding: 25px 40px; 
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
        .pdf-page:not(:last-child) {
            page-break-after: always;
            border-bottom: 1px solid #eee; 
        }
      `}</style>
      
      {/* HEADER NO IMPRIMIBLE */}
      <div className="flex justify-between items-center p-6 max-w-5xl mx-auto no-print">
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
            <Button onClick={handleDownloadPDF} disabled={isDownloading} className="bg-green-600 hover:bg-green-700 text-white border-none"><Download className="mr-2 h-4 w-4" /> {isDownloading ? 'Generando...' : 'Descargar PDF'}</Button>
        </div>
      </div>

      {/* CONTENEDOR DEL REPORTE */}
      <div id="report-container" className="mx-auto w-fit bg-gray-100">
        
        {/* ================= PÁGINA 1 ================= */}
        <div className="pdf-page">
            
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6 h-14">
                <div className="w-1/3 flex justify-start">{settings?.companyLogoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */<img src={settings.companyLogoUrl} alt="Logo" className="h-12 object-contain" />) : <div className="h-10 w-32"></div>}</div>
                <div className="w-1/3 flex justify-end">{settings?.secoLogoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */<img src={settings.secoLogoUrl} alt="Seco" className="h-10 object-contain" />) : <div className="h-10 w-32"></div>}</div>
            </div>
            
            <div className="mb-6 border-b-2 border-slate-800 pb-2">
                <h1 className="text-2xl font-black text-slate-800 uppercase leading-none tracking-tight text-center">ANALIZADOR DE COSTOS</h1>
                <div className="flex justify-between items-end mt-2">
                    <p className="text-lg font-bold text-blue-600 truncate max-w-[70%]">{data.name}</p>
                    <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">INFORME TÉCNICO</p><p className="font-bold text-slate-800 text-xs">{new Date().toLocaleDateString()}</p></div>
                </div>
            </div>

            {/* Resumen */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200 shadow-sm">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    <div className="border-b border-slate-200 pb-1"><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span><span className="block text-lg font-bold text-slate-700 truncate">{data.cliente || '-'}</span></div>
                    <div className="border-b border-slate-200 pb-1"><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operación</span><span className="block text-lg font-bold text-slate-700 truncate">{data.operacion || '-'}</span></div>
                    <div className="border-b border-slate-200 pb-1"><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Material</span><span className="block text-lg font-bold text-slate-700 truncate">{data.material || '-'}</span></div>
                    <div className="border-b border-slate-200 pb-1"><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Anual</span><span className="block text-xl font-black text-green-600">{formatCurrency(r.ahorroAnual)}</span></div>
                </div>
            </div>

            {/* Fotos */}
            <div className="flex-1 flex flex-col justify-center mb-4 min-h-[220px]">
                 {validImages.length > 0 ? (
                    <div className="flex flex-col h-full justify-center">
                        <div className="text-center mb-2 px-4"><h3 className="text-xs font-bold text-blue-900 italic font-serif leading-relaxed">&ldquo;Se pueden conseguir Resultados o Excusas, no las dos cosas.&rdquo;</h3><div className="h-0.5 w-12 bg-blue-500 mx-auto mt-1 rounded-full opacity-50"></div></div>
                        <div className="flex items-center justify-center h-full">
                            {validImages.length === 1 && (<div className="flex flex-col items-center justify-center w-full"><div className="border-4 border-white shadow-lg rounded-lg overflow-hidden bg-white max-h-[320px] w-auto flex items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={validImages[0]} alt="Evidencia" className="object-contain max-h-[320px] max-w-full" /></div>{data.imageDescriptions?.[0] && <p className="mt-2 text-[10px] font-bold text-slate-700 bg-slate-100 px-3 py-0.5 rounded-full uppercase">{data.imageDescriptions[0]}</p>}</div>)}
                            {validImages.length > 1 && (<div className="grid grid-cols-2 gap-3 w-full items-center">{validImages.map((url: string, index: number) => (<div key={index} className="flex flex-col items-center"><div className="border-4 border-white shadow-md rounded-lg overflow-hidden w-full h-[160px] bg-white flex items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Evidencia ${index + 1}`} className="object-contain max-h-full max-w-full" /></div>{data.imageDescriptions?.[index] && <p className="mt-1 text-[9px] font-bold text-slate-600 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{data.imageDescriptions[index]}</p>}</div>))}</div>)}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl m-4 h-40"><p className="text-slate-300 italic mb-2 text-xs">Sin evidencia visual</p><p className="text-[10px] font-bold text-slate-400 italic font-serif">"Se pueden conseguir Resultados o Excusas, no las dos cosas."</p></div>
                )}
            </div>

            {/* Conclusión */}
            <div className="border-t border-slate-200 pt-3 mb-2">
                <h4 className="text-xs font-black text-slate-800 uppercase mb-2 tracking-wide">Conclusión Ejecutiva</h4>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] text-slate-800 leading-relaxed text-justify shadow-sm">
                    <p className="mb-2 text-xs">
                        Con la mejora de proceso su empresa se ahorra <strong className="text-green-700 text-sm">{formatCurrency(r.ahorroAnual)} anuales</strong>.
                        Además, esta mejora le da un potencial adicional, ya que la máquina queda libre para generar 
                        <strong className="text-blue-700"> {formatCurrency(r.machineHoursFreedValueAnnual)} extras</strong> o producir 
                        <strong className="text-slate-900"> {formatNumber(piezasExtraMes)} piezas más por mes</strong>.
                    </p>
                    <p className="text-slate-500 italic border-t border-slate-200 pt-2 mt-1 text-[9px]">
                        * Cálculos basados en una demanda de <strong>{data.piezasAlMes?.toLocaleString()} piezas/mes</strong>. 
                        Actualmente esto ocupa <strong>{r.tiempoMaquinaMensualHorasA?.toFixed(1)} horas/mes</strong> de máquina, 
                        equivalente a <strong>{turnosA.toFixed(1)} turnos</strong> de trabajo (base 8hs).
                    </p>
                </div>
            </div>
            
            {/* Footer */}
            <div className="text-center pt-2 mt-auto border-t border-slate-100"><p className="text-[9px] text-slate-400 uppercase tracking-widest">Generado con Analizador de Costos - Página 1/2</p></div>
        </div>

        {/* ================= PÁGINA 2 ================= */}
        <div className="pdf-page">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-2 h-14">
                <div className="flex items-center gap-3">
                    {settings?.companyLogoUrl && /* eslint-disable-next-line @next/next/no-img-element */<img src={settings.companyLogoUrl} alt="Logo" className="h-6 object-contain opacity-50 grayscale" />}
                    <div><span className="text-lg font-bold text-slate-700 uppercase border-l pl-3 border-slate-300 block leading-none">Análisis Detallado</span><span className="text-[9px] text-slate-400 pl-3 mt-1 block uppercase tracking-wide">Basado en {data.piezasAlMes?.toLocaleString()} pzs/mes @ {formatCurrency(data.machineHourlyRate)}/hr</span></div>
                </div>
                <div className="text-right"><span className="text-[10px] text-slate-400">Página 2/2</span></div>
            </div>

            <div className="mb-4">
                <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
                    <div className="text-center"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Actual</p><div className="text-xl font-bold text-red-500 mb-1">{formatCurrency(r.cppA)}</div><div className="w-full border border-red-200 rounded overflow-hidden"><div className="bg-red-600 text-white text-[8px] py-0.5 font-bold">MAQ {formatCurrency(r.costoMaquinaA)}</div><div className="bg-red-200 text-red-900 text-[8px] py-0.5 font-bold">HER {formatCurrency(r.costoHerramientaA)}</div></div></div>
                    <div className="text-center"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Propuesta</p><div className="text-xl font-bold text-blue-600 mb-1">{formatCurrency(r.cppB)}</div><div className="w-full border border-blue-200 rounded overflow-hidden"><div className="bg-blue-600 text-white text-[8px] py-0.5 font-bold">MAQ {formatCurrency(r.costoMaquinaB)}</div><div className="bg-blue-200 text-blue-900 text-[8px] py-0.5 font-bold">HER {formatCurrency(r.costoHerramientaB)}</div></div></div>
                </div>
            </div>

            <div className="mb-4 bg-blue-50/50 border border-blue-100 rounded-lg p-2 shadow-sm break-inside-avoid">
                <h3 className="text-center text-[10px] font-bold text-slate-800 mb-2 uppercase tracking-widest">Inversión vs. Ahorro</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded border border-slate-200 p-2 shadow-sm text-center"><p className="text-[8px] font-bold text-slate-500 uppercase mb-0">Inversión Herramienta</p><p className={cn("text-lg font-black mb-0", r.toolCostIncreasePercent > 0 ? "text-green-600" : "text-slate-700")}>{formatPercent(r.toolCostIncreasePercent)}</p></div>
                    <div className="bg-white rounded border border-slate-200 p-2 shadow-sm text-center"><p className="text-[8px] font-bold text-slate-500 uppercase mb-0">Mejora Costo Total</p><p className={cn("text-lg font-black mb-0", r.totalCostReductionPercent > 0 ? "text-red-500" : "text-slate-700")}>{formatPercent(r.totalCostReductionPercent)}</p></div>
                </div>
            </div>

            <div className="mb-4 border border-slate-300 rounded overflow-hidden text-sm shadow-sm">
                <div className="grid grid-cols-10 bg-slate-100 font-bold border-b border-slate-300 py-1 px-3 text-[9px]"><div className="col-span-4">PARÁMETRO</div><div className="col-span-3 text-center text-red-600">ACTUAL (A)</div><div className="col-span-3 text-center text-blue-600">PROPUESTA (B)</div></div>
                <SectionTitle title="DATOS DEL INSERTO" />
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos/Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="VIDA ÚTIL (Pzs/Filo)" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <Row label="Tiempo Proc. por Filo (min)" valA={`${r.minutosFiloA?.toFixed(1)}`} valB={`${r.minutosFiloB?.toFixed(1)}`} />
                <Row label="Tiempo Corte/Pieza" valA={`${timeInCutA.toFixed(3)} min`} valB={`${timeInCutB.toFixed(3)} min`} />
                <div className="grid grid-cols-10 border-b border-slate-200 py-1 px-3 bg-white text-[9px]"><div className="col-span-4 font-medium text-slate-700">Insertos/Mes</div><div className="col-span-3 text-center text-slate-600">{insertosMesA.toFixed(1)} <span className="text-[8px] text-slate-400">({formatCurrency(costoInsertosMesA)})</span></div><div className="col-span-3 text-center text-slate-600">{insertosMesB.toFixed(1)} <span className="text-[8px] text-slate-400">({formatCurrency(costoInsertosMesB)})</span></div></div>
                <Row label="Costo Herr./Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />
                <SectionTitle title="DATOS DEL PROCESO" />
                <Row label="Ciclo (min)" valA={tcA.toFixed(3)} valB={tcB.toFixed(3)} />
                <Row label="Costo Hora-Máq." valA={formatCurrency(data.machineHourlyRate)} valB={`(${formatCurrency(costoMinuto)}/min)`} />
                <Row label="Costo Parada/Pieza" valA={formatCurrency(r.costoParadaA)} valB={formatCurrency(r.costoParadaB)} />
                <Row label="Costo Máq./Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                <div className="grid grid-cols-10 bg-slate-200 py-1 px-3 font-black border-t border-slate-300 text-[9px]"><div className="col-span-4 uppercase">COSTO TOTAL / PIEZA</div><div className="col-span-3 text-center text-red-600">{formatCurrency(r.cppA)}</div><div className="col-span-3 text-center text-blue-600">{formatCurrency(r.cppB)}</div></div>
            </div>

            <div className="border border-green-200 rounded overflow-hidden text-sm shadow-sm break-inside-avoid">
                <div className="grid grid-cols-12 bg-green-50 py-1 px-3 font-bold text-green-900 border-b border-green-200 text-[9px] text-center"><div className="col-span-3 text-left">MÉTRICA</div><div className="col-span-2">ACTUAL</div><div className="col-span-2">PROPUESTA</div><div className="col-span-3">AHORRO</div><div className="col-span-2">%</div></div>
                <FinancialRow label="Costo Total por Pieza" valA={formatCurrency(r.cppA)} valB={formatCurrency(r.cppB)} save={formatCurrency(r.ahorroPorPieza)} pct={formatPercent(r.totalCostReductionPercent)} />
                <FinancialRow label="Costo Total (Mes)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                <div className="grid grid-cols-12 border-b border-green-100 py-1 px-3 bg-white items-center text-center text-[9px]"><div className="col-span-3 font-medium text-slate-700 text-left">Tiempo Máquina (Mes)</div><div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasA?.toFixed(0)} hs</div><div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasB?.toFixed(0)} hs</div><div className="col-span-3 font-bold text-green-600">{r.machineHoursFreedMonthly?.toFixed(1)} hs lib.</div><div className="col-span-2 text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div></div>
                <div className="grid grid-cols-12 border-b border-green-100 py-1 px-3 bg-white items-center text-center text-[9px]"><div className="col-span-3 font-medium text-slate-700 text-left">Turnos 8hs (Mes)</div><div className="col-span-2 text-slate-600">{turnosA.toFixed(1)}</div><div className="col-span-2 text-slate-600">{turnosB.toFixed(1)}</div><div className="col-span-3 font-bold text-green-600">{turnosAhorrados.toFixed(1)} lib.</div><div className="col-span-2 text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div></div>
                <div className="grid grid-cols-12 bg-green-100 py-1 px-3 font-black border-t border-green-300 text-center text-[9px]"><div className="col-span-3 text-left uppercase">ANUAL</div><div className="col-span-2 text-slate-800">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div><div className="col-span-2 text-blue-700">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div><div className="col-span-3 text-green-700 text-sm">{formatCurrency(r.ahorroAnual)}</div><div className="col-span-2 text-green-700">{formatPercent(r.totalCostReductionPercent)}</div></div>
            </div>

            {/* Footer Hoja 2 */}
            <div className="mt-auto text-center border-t border-slate-200 pt-3">
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Generado con Analizador de Costos</p>
                <p className="text-xs font-bold text-blue-600 mt-1">https://secocut-app.web.app</p>
            </div>
        </div>

      </div>
    </div>
  );
}
