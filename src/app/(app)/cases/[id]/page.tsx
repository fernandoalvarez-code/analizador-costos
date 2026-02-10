"use client";

import { useEffect, use, useState } from "react";
import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Edit, Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// --- FORMATOS ---
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}
const formatPercent = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
}

export default function CaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { id } = use(params);
  const [isDownloading, setIsDownloading] = useState(false);

  // 1. Obtener datos del CASO
  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);
  const { data: rawData, isLoading } = useDoc<any>(docRef);

  // 2. Obtener CONFIGURACIÓN DE LOGOS
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc<any>(settingsRef);

  const data = rawData || {};
  const r = data.results || {}; 

  // --- CÁLCULOS ---
  const costoMinuto = (data.machineHourlyRate || 0) / 60;
  const totalPiezasPorInsertoA = (data.filosA || 1) * (data.piezasFiloA || 1);
  const insertosMesA = totalPiezasPorInsertoA > 0 ? (data.piezasAlMes || 0) / totalPiezasPorInsertoA : 0;
  const costoInsertosMesA = insertosMesA * (data.precioA || 0);
  const totalPiezasPorInsertoB = (data.filosB || 1) * (data.piezasFiloB || 1);
  const insertosMesB = totalPiezasPorInsertoB > 0 ? (data.piezasAlMes || 0) / totalPiezasPorInsertoB : 0;
  const costoInsertosMesB = insertosMesB * (data.precioB || 0);
  const turnosA = (r.tiempoMaquinaMensualHorasA || 0) / 8;
  const turnosB = (r.tiempoMaquinaMensualHorasB || 0) / 8;
  const turnosAhorrados = turnosA - turnosB;

  const validImages = data.imageUrls?.filter((url: string) => url && url.trim() !== "") || [];

  // Auto-imprimir
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      const timer = setTimeout(() => { window.print(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData]);

  // --- FUNCIÓN DE DESCARGA DIRECTA (CORREGIDA) ---
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('report-container');
        
        const opt = {
            margin:       0,
            filename:     `Informe_${data.name || 'Caso'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            // CORRECCIÓN: scrollY: 0 obliga a capturar desde arriba, evitando hojas en blanco
            html2canvas:  { scale: 2, useCORS: true, logging: true, scrollY: 0, x: 0 }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(element).save();

    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Hubo un error al generar el PDF. Intenta usar el botón de Imprimir.");
    } finally {
        setIsDownloading(false);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData) return <div className="p-8 text-center text-red-500">Caso no encontrado.</div>;

  return (
    <div className="bg-white text-slate-900 font-sans printable-area">
      
      {/* BOTONES (NO IMPRIMIBLES) */}
      <div className="flex justify-between items-center p-6 max-w-5xl mx-auto no-print">
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
            
            {/* BOTÓN DESCARGAR */}
            <Button onClick={handleDownloadPDF} disabled={isDownloading} className="bg-green-600 hover:bg-green-700 text-white border-none">
                <Download className="mr-2 h-4 w-4" /> 
                {isDownloading ? 'Generando...' : 'Descargar PDF'}
            </Button>

            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </div>
      </div>

      {/* ================= CONTENEDOR DEL REPORTE ================= */}
      {/* Es importante que este ID envuelva todo el contenido imprimible y tenga fondo blanco */}
      <div id="report-container" className="bg-white">
        
        {/* ================= HOJA 1: CARÁTULA ================= */}
        <div className="min-h-screen w-full max-w-[210mm] mx-auto p-10 flex flex-col page-break-after-always relative border-b border-slate-100 print:border-none bg-white">
            
            {/* ENCABEZADO CON LOGOS DINÁMICOS */}
            <div className="flex justify-between items-center mb-10 h-20">
                <div className="w-1/3 flex justify-start">
                    {settings?.companyLogoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.companyLogoUrl} alt="Logo Empresa" className="h-16 object-contain" />
                    ) : ( <div className="h-12 w-32"></div> )}
                </div>
                <div className="w-1/3 flex justify-end">
                    {settings?.secoLogoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.secoLogoUrl} alt="Logo Seco" className="h-14 object-contain" />
                    ) : ( <div className="h-12 w-32"></div> )}
                </div>
            </div>

            {/* Título Principal */}
            <div className="mb-10 border-b-2 border-slate-800 pb-6">
                <h1 className="text-3xl font-black text-slate-800 uppercase leading-none tracking-tight text-center">
                    ANALIZADOR DE COSTOS
                </h1>
                <div className="flex justify-between items-end mt-4">
                    <p className="text-xl font-bold text-blue-600">{data.name}</p>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">INFORME TÉCNICO</p>
                        <p className="font-bold text-slate-800 text-sm">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Datos Principales */}
            <div className="bg-slate-50 rounded-xl p-8 mb-8 border border-slate-200 shadow-sm">
                <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                    <div className="border-b border-slate-200 pb-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span>
                        <span className="block text-2xl font-bold text-slate-700">{data.cliente || '-'}</span>
                    </div>
                    <div className="border-b border-slate-200 pb-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operación</span>
                        <span className="block text-2xl font-bold text-slate-700">{data.operacion || '-'}</span>
                    </div>
                    <div className="border-b border-slate-200 pb-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material</span>
                        <span className="block text-2xl font-bold text-slate-700">{data.material || '-'}</span>
                    </div>
                    <div className="border-b border-slate-200 pb-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Anual</span>
                        <span className="block text-2xl font-black text-green-600">{formatCurrency(r.ahorroAnual)}</span>
                    </div>
                </div>
            </div>

            {/* Imágenes */}
            {validImages.length > 0 ? (
                <div className="flex-grow flex flex-col justify-center mb-4">
                    <div className="text-center mb-6 px-4">
                        <h3 className="text-sm font-bold text-blue-900 italic font-serif leading-relaxed">
                            &ldquo;Se pueden conseguir Resultados o Excusas, no las dos cosas.&rdquo;
                        </h3>
                        <div className="h-0.5 w-16 bg-blue-500 mx-auto mt-2 rounded-full opacity-50"></div>
                    </div>

                    {validImages.length === 1 && (
                        <div className="flex flex-col items-center justify-center">
                            <div className="border-4 border-white shadow-xl rounded-lg overflow-hidden bg-white max-h-[350px]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={validImages[0]} alt="Evidencia" className="object-contain max-h-[350px] w-auto mx-auto" />
                            </div>
                            {data.imageDescriptions?.[0] && <p className="mt-3 text-xs font-bold text-slate-700 bg-slate-100 px-4 py-1 rounded-full uppercase">{data.imageDescriptions[0]}</p>}
                        </div>
                    )}
                    {validImages.length > 1 && (
                        <div className="grid grid-cols-2 gap-6 items-center">
                            {validImages.map((url: string, index: number) => (
                                <div key={index} className="flex flex-col items-center">
                                    <div className="border-4 border-white shadow-lg rounded-lg overflow-hidden w-full h-[250px] bg-white flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={`Evidencia ${index + 1}`} className="object-contain max-h-full max-w-full" />
                                    </div>
                                    {data.imageDescriptions?.[index] && <p className="mt-2 text-xs font-bold text-slate-600 uppercase bg-slate-50 px-3 py-1 rounded border border-slate-200">{data.imageDescriptions[index]}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl m-4 h-40">
                    <p className="text-slate-300 italic mb-2">Sin evidencia visual</p>
                    <p className="text-xs font-bold text-slate-400 italic font-serif">"Se pueden conseguir Resultados o Excusas, no las dos cosas."</p>
                </div>
            )}

            <div className="text-center pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Generado con Analizador de Costos</p>
            </div>
        </div>


        {/* ================= HOJA 2: DATOS ================= */}
        <div className="min-h-screen w-full max-w-[210mm] mx-auto p-10 pt-12 page-break-before-always bg-white">
            
            {/* Cabecera Hoja 2 */}
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-4">
                    {settings?.companyLogoUrl && 
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.companyLogoUrl} alt="Logo" className="h-8 object-contain opacity-50 grayscale" />
                    }
                    <span className="text-lg font-bold text-slate-700 uppercase border-l pl-4 border-slate-300">Análisis Detallado</span>
                </div>
                <div className="text-right">
                    <span className="text-xs text-slate-400">Página 2/2</span>
                </div>
            </div>

            {/* 1. Barras */}
            <div className="mb-8">
                <div className="grid grid-cols-2 gap-10 max-w-lg mx-auto">
                    <div className="text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Actual</p>
                        <div className="text-2xl font-bold text-red-500 mb-2">{formatCurrency(r.cppA)}</div>
                        <div className="w-full border border-red-200 rounded overflow-hidden">
                            <div className="bg-red-600 text-white text-[9px] py-1 font-bold">MAQ {formatCurrency(r.costoMaquinaA)}</div>
                            <div className="bg-red-200 text-red-900 text-[9px] py-1 font-bold">HER {formatCurrency(r.costoHerramientaA)}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Propuesta</p>
                        <div className="text-2xl font-bold text-blue-600 mb-2">{formatCurrency(r.cppB)}</div>
                        <div className="w-full border border-blue-200 rounded overflow-hidden">
                            <div className="bg-blue-600 text-white text-[9px] py-1 font-bold">MAQ {formatCurrency(r.costoMaquinaB)}</div>
                            <div className="bg-blue-200 text-blue-900 text-[9px] py-1 font-bold">HER {formatCurrency(r.costoHerramientaB)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Análisis de Inversión vs Ahorro */}
            <div className="mb-8 bg-blue-50/50 border border-blue-100 rounded-lg p-4 shadow-sm break-inside-avoid">
                <h3 className="text-center text-lg font-bold text-slate-800 mb-4 uppercase">Análisis de Inversión vs. Ahorro</h3>
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Inversión en Herramienta</p>
                        <p className={cn("text-3xl font-black mb-1", r.toolCostIncreasePercent > 0 ? "text-green-600" : "text-slate-700")}>
                            {formatPercent(r.toolCostIncreasePercent)}
                        </p>
                        <p className="text-[10px] text-slate-400">Variación en costo de herramienta por pieza</p>
                    </div>
                    <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Mejora en Costo Total</p>
                        <p className={cn("text-3xl font-black mb-1", r.totalCostReductionPercent > 0 ? "text-red-500" : "text-slate-700")}>
                            {formatPercent(r.totalCostReductionPercent)}
                        </p>
                        <p className="text-[10px] text-slate-400">Reducción de costo total por pieza</p>
                    </div>
                </div>
            </div>

            {/* 3. Análisis Capacidad */}
            <div className="mb-8 border border-blue-200 rounded-lg overflow-hidden shadow-sm break-inside-avoid">
                <div className="bg-blue-600 text-white text-center py-1.5 font-bold uppercase tracking-widest text-[10px]">
                    Análisis de Horas de Máquina Liberadas (Anual)
                </div>
                <div className="p-3 grid grid-cols-3 gap-4 bg-blue-50/30">
                    <div className="bg-white p-2 rounded border border-blue-100 shadow-sm text-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Tiempo Liberado</p>
                        <p className="text-xl font-bold text-blue-600">{r.machineHoursFreedAnnual?.toFixed(2)} hs</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100 shadow-sm text-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Valor Prod. Adicional</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(r.machineHoursFreedValueAnnual)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5">a {formatCurrency(data.machineHourlyRate)}/hr</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100 shadow-sm text-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Piezas Adicionales</p>
                        <p className="text-xl font-bold text-slate-700">{r.piezasAdicionalesAnual?.toFixed(0)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5">Potencial Extra</p>
                    </div>
                </div>
            </div>

            {/* 4. Tabla Datos Técnicos */}
            <div className="mb-8 border border-slate-300 rounded overflow-hidden text-sm shadow-sm">
                <div className="grid grid-cols-10 bg-slate-100 font-bold border-b border-slate-300 py-2 px-3 text-[11px]">
                    <div className="col-span-4">PARÁMETRO</div>
                    <div className="col-span-3 text-center text-red-600">ACTUAL (A)</div>
                    <div className="col-span-3 text-center text-blue-600">PROPUESTA (B)</div>
                </div>

                <SectionTitle title="DATOS DEL INSERTO" />
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos/Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="Vida/Filo" valA={`${r.minutosFiloA?.toFixed(1)} min`} valB={`${r.minutosFiloB?.toFixed(1)} min`} />
                <Row label="Piezas/Filo" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <div className="grid grid-cols-10 border-b border-slate-200 py-1 px-3 bg-white">
                    <div className="col-span-4 font-medium text-slate-700">Insertos/Mes</div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesA.toFixed(1)} <span className="text-[9px] text-slate-400">({formatCurrency(costoInsertosMesA)})</span></div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesB.toFixed(1)} <span className="text-[9px] text-slate-400">({formatCurrency(costoInsertosMesB)})</span></div>
                </div>
                <Row label="Costo Herr./Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />

                <SectionTitle title="DATOS DEL PROCESO" />
                <Row label="Ciclo (min)" valA={r.tiempoCicloA?.toFixed(3)} valB={r.tiempoCicloB?.toFixed(3)} />
                <Row label="Costo Hora-Máq." valA={formatCurrency(data.machineHourlyRate)} valB={`(${formatCurrency(costoMinuto)}/min)`} />
                <Row label="Costo Máq./Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                
                <div className="grid grid-cols-10 bg-slate-200 py-2 px-3 font-black border-t border-slate-300 text-xs">
                    <div className="col-span-4 uppercase">COSTO TOTAL / PIEZA</div>
                    <div className="col-span-3 text-center text-red-600">{formatCurrency(r.cppA)}</div>
                    <div className="col-span-3 text-center text-blue-600">{formatCurrency(r.cppB)}</div>
                </div>
            </div>

            {/* 5. Tabla Financiera */}
            <div className="border border-green-200 rounded overflow-hidden text-sm shadow-sm break-inside-avoid">
                <div className="grid grid-cols-12 bg-green-50 py-2 px-3 font-bold text-green-900 border-b border-green-200 text-[11px] text-center">
                    <div className="col-span-3 text-left">MÉTRICA</div>
                    <div className="col-span-2">ACTUAL</div>
                    <div className="col-span-2">PROPUESTA</div>
                    <div className="col-span-3">AHORRO</div>
                    <div className="col-span-2">%</div>
                </div>
                <FinancialRow label="Costo Total (Mes)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                <div className="grid grid-cols-12 border-b border-green-100 py-1 px-3 bg-white items-center text-center">
                    <div className="col-span-3 font-medium text-slate-700 text-left">Tiempo Máquina</div>
                    <div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasA?.toFixed(0)} hs</div>
                    <div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasB?.toFixed(0)} hs</div>
                    <div className="col-span-3 font-bold text-green-600">{r.machineHoursFreedMonthly?.toFixed(1)} hs lib.</div>
                    <div className="col-span-2 text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>
                <div className="grid grid-cols-12 bg-green-100 py-2 px-3 font-black border-t border-green-300 text-center text-xs">
                    <div className="col-span-3 text-left uppercase">ANUAL</div>
                    <div className="col-span-2 text-slate-800">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div>
                    <div className="col-span-2 text-blue-700">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div>
                    <div className="col-span-3 text-green-700 text-sm">{formatCurrency(r.ahorroAnual)}</div>
                    <div className="col-span-2 text-green-700">{formatPercent(r.totalCostReductionPercent)}</div>
                </div>
            </div>

            <div className="mt-8 text-center border-t border-slate-100 pt-2">
                <p className="text-[10px] text-slate-400">https://secocut-app.web.app</p>
            </div>

        </div>
      </div>
    </div>
  );
}

// Componentes
const Row = ({ label, valA, valB, bold = false, isRed = false }: any) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-200 py-1 px-3 bg-white text-center items-center text-[11px]", bold && "font-bold bg-slate-50")}>
        <div className="col-span-4 font-medium text-slate-700 text-left">{label}</div>
        <div className={cn("col-span-3", isRed ? "text-red-600 font-bold" : "text-slate-600")}>{valA}</div>
        <div className={cn("col-span-3", isRed ? "text-blue-600 font-bold" : "text-slate-600")}>{valB}</div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase border-y border-slate-300 text-left">{title}</div>
);

const FinancialRow = ({ label, valA, valB, save, pct }: any) => (
    <div className="grid grid-cols-12 border-b border-green-100 py-1 px-3 bg-white items-center text-center text-[11px]">
        <div className="col-span-3 font-medium text-slate-700 text-left">{label}</div>
        <div className="col-span-2 text-slate-600">{valA}</div>
        <div className="col-span-2 text-slate-600">{valB}</div>
        <div className="col-span-3 font-bold text-green-600">{save}</div>
        <div className="col-span-2 text-green-600 font-bold">{pct}</div>
    </div>
);