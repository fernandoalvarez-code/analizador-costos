"use client";

import { useEffect, use } from "react";
import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Edit } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Función para formatear dinero
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

// Función para formatear porcentajes
const formatPercent = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
}

export default function CaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { id } = use(params);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);

  const { data: rawData, isLoading } = useDoc<any>(docRef);
  const data = rawData || {};
  const r = data.results || {}; 

  // --- CÁLCULOS AUXILIARES PARA REPLICAR TU TABLA EXACTA ---
  const costoMinuto = (data.machineHourlyRate || 0) / 60;
  
  // Insertos requeridos por mes = PiezasMes / (Filos * PiezasPorFilo)
  const totalPiezasPorInsertoA = (data.filosA || 1) * (data.piezasFiloA || 1);
  const insertosMesA = totalPiezasPorInsertoA > 0 ? (data.piezasAlMes || 0) / totalPiezasPorInsertoA : 0;
  const costoInsertosMesA = insertosMesA * (data.precioA || 0);

  const totalPiezasPorInsertoB = (data.filosB || 1) * (data.piezasFiloB || 1);
  const insertosMesB = totalPiezasPorInsertoB > 0 ? (data.piezasAlMes || 0) / totalPiezasPorInsertoB : 0;
  const costoInsertosMesB = insertosMesB * (data.precioB || 0);

  // Turnos (Horas mensuales / 8)
  const turnosA = (r.tiempoMaquinaMensualHorasA || 0) / 8;
  const turnosB = (r.tiempoMaquinaMensualHorasB || 0) / 8;
  const turnosAhorrados = turnosA - turnosB;

  // Auto-imprimir
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      const timer = setTimeout(() => { window.print(); }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData]);

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData) return <div className="p-8 text-center text-red-500">Caso no encontrado.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8 max-w-[210mm] mx-auto font-sans printable-area">
      
      {/* BOTONES (NO IMPRIMIBLES) */}
      <div className="flex justify-between items-center mb-8 no-print">
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      <div className="report-content">
        
        {/* 1. ENCABEZADO AZUL (Igual a captura 15.07.47) */}
        <div className="bg-blue-50 border-l-8 border-blue-600 p-6 mb-8 flex justify-between items-center">
            <div>
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">ANALIZADOR DE COSTOS DE CORTE</h3>
                <h1 className="text-4xl font-black text-slate-900 leading-tight">{data.name || 'Sin Título'}</h1>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <span className="font-semibold">Cliente:</span> {data.cliente || 'N/A'} 
                    <span className="mx-2">•</span>
                    <span className="font-semibold">{new Date().toLocaleDateString()}</span>
                </div>
            </div>
            <div className="text-right">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase">{data.status || 'Pendiente'}</span>
            </div>
        </div>

        {/* 2. RESUMEN KPI (Tarjetas superiores) */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <p className="text-xs font-bold text-blue-600 uppercase">AHORRO ANUAL</p>
                <p className={`text-3xl font-black ${r.ahorroAnual > 0 ? 'text-green-600' : 'text-slate-700'}`}>{formatCurrency(r.ahorroAnual)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <p className="text-xs font-bold text-blue-600 uppercase">ROI</p>
                <p className="text-3xl font-black text-slate-700">{r.roi?.toFixed(0)}%</p>
            </div>
        </div>

        {/* 3. DATOS DETALLADOS DEL PROCESO (Réplica exacta de captura 09.18.11) */}
        <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 border-l-4 border-blue-600 pl-3">Datos Detallados del Proceso</h2>
            
            <div className="border border-blue-200 rounded-lg overflow-hidden text-sm">
                {/* Header Tabla */}
                <div className="grid grid-cols-10 bg-blue-50 border-b border-blue-200 font-bold text-blue-900 py-3 px-4">
                    <div className="col-span-4">Parámetro</div>
                    <div className="col-span-3 text-center text-red-600 bg-red-50/50 rounded py-1">Inserto A (Actual)</div>
                    <div className="col-span-3 text-center text-blue-600 bg-blue-100/50 rounded py-1 ml-1">Inserto B (Propuesta)</div>
                </div>

                {/* Sección: Datos del Inserto */}
                <div className="bg-yellow-50/50 px-4 py-1 text-xs font-bold text-slate-500 uppercase border-b border-blue-100">Datos del Inserto</div>
                
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio del Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos por Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="Vida por Filo (Minutos)" valA={`${r.minutosFiloA?.toFixed(1)} min`} valB={`${r.minutosFiloB?.toFixed(1)} min`} />
                <Row label="Piezas por Filo" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <Row label="Piezas Totales / Inserto" valA={(data.filosA * data.piezasFiloA)} valB={(data.filosB * data.piezasFiloB)} />
                
                {/* Insertos Requeridos / Mes con Costo */}
                <div className="grid grid-cols-10 border-b border-slate-100 py-2 px-4 hover:bg-slate-50">
                    <div className="col-span-4 font-medium text-slate-700">Insertos Req. / Mes</div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesA.toFixed(2)} <span className="text-xs text-slate-400">({formatCurrency(costoInsertosMesA)})</span></div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesB.toFixed(2)} <span className="text-xs text-slate-400">({formatCurrency(costoInsertosMesB)})</span></div>
                </div>

                <Row label="Costo Herramienta / Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />

                {/* Sección: Datos del Proceso */}
                <div className="bg-blue-50/30 px-4 py-1 text-xs font-bold text-blue-500 uppercase border-y border-blue-100 mt-2">Datos del Proceso</div>
                
                <Row label="Tiempo de Ciclo (min)" valA={`${r.tiempoCicloA?.toFixed(3)} min`} valB={`${r.tiempoCicloB?.toFixed(3)} min`} />
                <Row label="Velocidad de Corte (Vc)" valA={`${data.vcA || 0} m/min`} valB={`${data.vcB || 0} m/min`} />
                
                {/* Costo Hora Máquina Especial */}
                <div className="grid grid-cols-10 border-b border-slate-100 py-2 px-4">
                    <div className="col-span-4 font-medium text-slate-700">Costo Hora-Máquina</div>
                    <div className="col-span-6 text-right pr-8 text-slate-600">{formatCurrency(data.machineHourlyRate)} <span className="text-slate-400">({formatCurrency(costoMinuto)}/min)</span></div>
                </div>

                <Row label="Parada por Cambio (costo/pza)" valA={formatCurrency(r.costoParadaA)} valB={formatCurrency(r.costoParadaB)} />
                <Row label="Costo Máquina / Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                
                {/* ROW FINAL TOTAL */}
                <div className="grid grid-cols-10 bg-slate-100 py-3 px-4 font-black text-base border-t border-slate-300">
                    <div className="col-span-4 text-slate-800 uppercase">COSTO TOTAL / PIEZA</div>
                    <div className="col-span-3 text-center text-red-600">{formatCurrency(r.cppA)}</div>
                    <div className="col-span-3 text-center text-blue-600">{formatCurrency(r.cppB)}</div>
                </div>
            </div>
        </div>

        {/* 4. RESUMEN FINANCIERO (Réplica exacta captura 15.42.58) */}
        <div className="mb-10 break-inside-avoid">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 text-center">Resumen Financiero (para {data.piezasAlMes?.toLocaleString()} piezas/mes)</h2>
            
            <div className="border border-green-200 rounded-lg overflow-hidden text-sm shadow-sm">
                <div className="grid grid-cols-12 bg-green-50/50 py-3 px-4 font-bold text-green-900 border-b border-green-200">
                    <div className="col-span-3">Métrica</div>
                    <div className="col-span-2 text-center text-slate-600">Actual</div>
                    <div className="col-span-2 text-center text-blue-600">Propuesta</div>
                    <div className="col-span-3 text-right">Ahorro</div>
                    <div className="col-span-2 text-right">% Mejora</div>
                </div>

                <FinancialRow label="Costo Total por Pieza" valA={formatCurrency(r.cppA)} valB={formatCurrency(r.cppB)} save={formatCurrency(r.ahorroPorPieza)} pct={formatPercent(r.totalCostReductionPercent)} />
                <FinancialRow label="Costo Total (Mensual)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                
                {/* Tiempo Máquina con Horas */}
                <div className="grid grid-cols-12 border-b border-slate-100 py-3 px-4 hover:bg-slate-50 items-center">
                    <div className="col-span-3 font-medium text-slate-700">Tiempo Máquina (Mensual)</div>
                    <div className="col-span-2 text-center text-slate-600">{formatCurrency(r.tiempoMaquinaMensualValorA)} <div className="text-xs text-slate-400">{r.tiempoMaquinaMensualHorasA?.toFixed(2)} hs</div></div>
                    <div className="col-span-2 text-center text-slate-600">{formatCurrency(r.tiempoMaquinaMensualValorB)} <div className="text-xs text-slate-400">{r.tiempoMaquinaMensualHorasB?.toFixed(2)} hs</div></div>
                    <div className="col-span-3 text-right font-bold text-green-600">- {r.machineHoursFreedMonthly?.toFixed(2)} hs liberadas</div>
                    <div className="col-span-2 text-right text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>

                <div className="grid grid-cols-12 border-b border-slate-100 py-3 px-4 hover:bg-slate-50 items-center">
                    <div className="col-span-3 font-medium text-slate-700">Turnos de 8hs (Mensual)</div>
                    <div className="col-span-2 text-center text-slate-600">{turnosA.toFixed(2)} turnos</div>
                    <div className="col-span-2 text-center text-slate-600">{turnosB.toFixed(2)} turnos</div>
                    <div className="col-span-3 text-right font-bold text-green-600">{turnosAhorrados.toFixed(2)} turnos liberados</div>
                    <div className="col-span-2 text-right text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>

                <div className="grid grid-cols-12 bg-green-100/50 py-4 px-4 font-black border-t border-green-200">
                    <div className="col-span-3 text-slate-800">COSTO TOTAL (ANUAL)</div>
                    <div className="col-span-2 text-center text-slate-800">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div>
                    <div className="col-span-2 text-center text-blue-700">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div>
                    <div className="col-span-3 text-right text-green-700 text-lg">{formatCurrency(r.ahorroAnual)}</div>
                    <div className="col-span-2 text-right text-green-700 text-lg">{formatPercent(r.totalCostReductionPercent)}</div>
                </div>
            </div>
        </div>

        {/* 5. EVIDENCIA FOTOGRÁFICA (2 Columnas) */}
        {data.imageUrls && data.imageUrls.length > 0 && (
          <div className="mt-8 break-inside-avoid page-break-before-always">
            <h3 className="text-2xl font-bold text-slate-800 mb-6 border-l-4 border-slate-800 pl-3">
              Evidencia Fotográfica
            </h3>
            <div className="grid grid-cols-2 gap-8">
              {data.imageUrls.map((url: string, index: number) => (
                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                   <div className="bg-blue-50 py-2 text-center border-b border-blue-100">
                     <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                       {data.imageDescriptions?.[index] ? "Evidencia" : `Imagen ${index + 1}`}
                     </span>
                   </div>
                   <div className="h-64 bg-white p-2 flex items-center justify-center">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img 
                        src={url} 
                        alt={`Evidencia ${index + 1}`} 
                        className="max-h-full max-w-full object-contain"
                        crossOrigin="anonymous" 
                     />
                   </div>
                   {data.imageDescriptions?.[index] && (
                     <div className="py-3 px-4 bg-slate-50 border-t border-slate-100 text-center">
                       <p className="text-sm font-bold text-slate-700 uppercase">{data.imageDescriptions[index]}</p>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>Generado con Analizador de Costos de Corte</p>
            <p>Documento confidencial - {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

// COMPONENTES AUXILIARES PARA LIMPIEZA DEL CÓDIGO
const Row = ({ label, valA, valB, bold = false, isRed = false }: any) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-100 py-2 px-4 hover:bg-slate-50", bold && "font-bold bg-slate-50/50")}>
        <div className="col-span-4 font-medium text-slate-700">{label}</div>
        <div className={cn("col-span-3 text-center", isRed ? "text-red-600 font-bold" : "text-slate-600")}>{valA}</div>
        <div className={cn("col-span-3 text-center", isRed ? "text-blue-600 font-bold" : "text-slate-600")}>{valB}</div>
    </div>
);

const FinancialRow = ({ label, valA, valB, save, pct }: any) => (
    <div className="grid grid-cols-12 border-b border-slate-100 py-3 px-4 hover:bg-slate-50 items-center">
        <div className="col-span-3 font-medium text-slate-700">{label}</div>
        <div className="col-span-2 text-center text-slate-600">{valA}</div>
        <div className="col-span-2 text-center text-slate-600">{valB}</div>
        <div className="col-span-3 text-right font-bold text-green-600">{save}</div>
        <div className="col-span-2 text-right text-green-600 font-bold">{pct}</div>
    </div>
);
