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

  // Cálculos auxiliares
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

  // Auto-imprimir
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      // Damos 2 segundos para asegurar que las imágenes bajen antes de imprimir
      const timer = setTimeout(() => { window.print(); }, 2000);
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

      <div className="report-content space-y-6">
        
        {/* 1. ENCABEZADO */}
        <div className="flex justify-between items-end border-b-2 border-slate-300 pb-4">
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-1">Analizador de Costos de Corte</h3>
                <h1 className="text-3xl font-black text-slate-900">{data.name || 'Sin Título'}</h1>
            </div>
            <div className="text-right">
                <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest">SECOCUT SRL</h2>
                <p className="text-xs text-slate-500 mt-1">Análisis de Productividad</p>
            </div>
        </div>

        {/* Datos Generales */}
        <div className="grid grid-cols-4 gap-4 text-sm border-b border-slate-200 pb-6">
            <div><span className="block text-xs font-bold text-slate-400 uppercase">Cliente</span><span className="font-semibold">{data.cliente || 'N/A'}</span></div>
            <div><span className="block text-xs font-bold text-slate-400 uppercase">Fecha</span><span className="font-semibold">{data.fecha || '-'}</span></div>
            <div><span className="block text-xs font-bold text-slate-400 uppercase">Operación</span><span className="font-semibold">{data.operacion || '-'}</span></div>
            <div><span className="block text-xs font-bold text-slate-400 uppercase">Material</span><span className="font-semibold">{data.material || '-'}</span></div>
        </div>

        {/* 2. RESUMEN KPI */}
        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-lg text-center break-inside-avoid">
            <h3 className="text-sm font-bold text-blue-800 uppercase mb-4">Resumen de Impacto Económico</h3>
            <div className="grid grid-cols-3 gap-8 divide-x divide-blue-200">
                <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Costo Actual (Mes)</p>
                    <p className="text-2xl font-bold text-slate-700">{formatCurrency(r.costoTotalMensualA)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Costo Propuesto (Mes)</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(r.costoTotalMensualB)}</p>
                </div>
                <div>
                    <p className="text-xs text-green-600 uppercase font-bold">Ahorro Anual</p>
                    <p className="text-3xl font-black text-green-600">{formatCurrency(r.ahorroAnual)}</p>
                </div>
            </div>
        </div>

        {/* 3. TABLA DETALLADA */}
        <div className="break-inside-avoid">
            <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-slate-500 pl-3">Datos Detallados</h3>
            
            <div className="border border-slate-300 text-sm">
                {/* Header */}
                <div className="grid grid-cols-10 bg-slate-100 font-bold border-b border-slate-300 py-2 px-2 text-center">
                    <div className="col-span-4 text-left">Parámetro</div>
                    <div className="col-span-3 text-red-600">Actual (A)</div>
                    <div className="col-span-3 text-blue-600">Propuesta (B)</div>
                </div>

                <SectionTitle title="Datos del Inserto" />
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio del Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos por Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="Vida por Filo (min)" valA={r.minutosFiloA?.toFixed(1)} valB={r.minutosFiloB?.toFixed(1)} />
                <Row label="Piezas por Filo" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <div className="grid grid-cols-10 border-b border-slate-200 py-1 px-2">
                    <div className="col-span-4 font-medium text-slate-700">Insertos Req. / Mes</div>
                    <div className="col-span-3 text-center">{insertosMesA.toFixed(1)} <span className="text-[10px] text-slate-400">({formatCurrency(costoInsertosMesA)})</span></div>
                    <div className="col-span-3 text-center">{insertosMesB.toFixed(1)} <span className="text-[10px] text-slate-400">({formatCurrency(costoInsertosMesB)})</span></div>
                </div>
                <Row label="Costo Herramienta / Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />

                <SectionTitle title="Datos del Proceso" />
                <Row label="Tiempo de Ciclo (min)" valA={r.tiempoCicloA?.toFixed(3)} valB={r.tiempoCicloB?.toFixed(3)} />
                <Row label="Costo Hora-Máquina" valA={formatCurrency(data.machineHourlyRate)} valB={`(${formatCurrency(costoMinuto)}/min)`} />
                <Row label="Costo Máquina / Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                
                {/* TOTAL ROW */}
                <div className="grid grid-cols-10 bg-slate-200 py-2 px-2 font-black border-t border-slate-300">
                    <div className="col-span-4 uppercase">Costo Total / Pieza</div>
                    <div className="col-span-3 text-center text-red-600">{formatCurrency(r.cppA)}</div>
                    <div className="col-span-3 text-center text-blue-600">{formatCurrency(r.cppB)}</div>
                </div>
            </div>
        </div>

        {/* 4. RESUMEN FINANCIERO */}
        <div className="break-inside-avoid">
            <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-green-500 pl-3">Resumen Financiero</h3>
            <div className="border border-green-200 rounded text-sm overflow-hidden">
                <div className="grid grid-cols-12 bg-green-50 py-2 px-2 font-bold text-green-900 border-b border-green-200 text-center">
                    <div className="col-span-3 text-left">Métrica</div>
                    <div className="col-span-2">Actual</div>
                    <div className="col-span-2">Propuesta</div>
                    <div className="col-span-3">Ahorro</div>
                    <div className="col-span-2">%</div>
                </div>
                <FinancialRow label="Costo Total (Mensual)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                <div className="grid grid-cols-12 border-b border-green-100 py-2 px-2 hover:bg-white items-center text-center">
                    <div className="col-span-3 font-medium text-slate-700 text-left">Tiempo Máquina</div>
                    <div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasA?.toFixed(0)} hs</div>
                    <div className="col-span-2 text-slate-600">{r.tiempoMaquinaMensualHorasB?.toFixed(0)} hs</div>
                    <div className="col-span-3 font-bold text-green-600">-{r.machineHoursFreedMonthly?.toFixed(0)} hs</div>
                    <div className="col-span-2 text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>
                <div className="grid grid-cols-12 bg-green-100 py-3 px-2 font-black border-t border-green-300 text-center">
                    <div className="col-span-3 text-slate-800 text-left">ANUAL</div>
                    <div className="col-span-2 text-slate-800">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div>
                    <div className="col-span-2 text-blue-700">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div>
                    <div className="col-span-3 text-green-700 text-lg">{formatCurrency(r.ahorroAnual)}</div>
                    <div className="col-span-2 text-green-700">{formatPercent(r.totalCostReductionPercent)}</div>
                </div>
            </div>
        </div>

        {/* 5. EVIDENCIA FOTOGRÁFICA (CORREGIDA) */}
        {data.imageUrls && data.imageUrls.length > 0 && (
          <div className="mt-6 break-inside-avoid page-break-before-always">
            <h3 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-slate-800 pl-3">
              Evidencia Fotográfica
            </h3>
            
            {/* GRID SIMPLE DE 2 COLUMNAS */}
            <div className="grid grid-cols-2 gap-6">
              {data.imageUrls.map((url: string, index: number) => (
                <div key={index} className="border border-slate-300 bg-white p-1 shadow-sm break-inside-avoid">
                   {/* Título */}
                   <div className="bg-slate-100 py-1 text-center border-b border-slate-200 mb-2">
                     <span className="text-xs font-bold text-slate-600 uppercase">
                       {data.imageDescriptions?.[index] ? "EVIDENCIA" : `IMAGEN ${index + 1}`}
                     </span>
                   </div>
                   
                   {/* IMAGEN SIN RESTRICCIONES DE SEGURIDAD (CORS) */}
                   <div className="h-64 w-full flex items-center justify-center bg-white overflow-hidden">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img 
                        src={url} 
                        alt={`Evidencia ${index + 1}`} 
                        className="object-contain max-h-full max-w-full"
                        style={{ display: 'block', margin: '0 auto' }}
                     />
                   </div>

                   {/* Descripción al pie */}
                   {data.imageDescriptions?.[index] && (
                     <div className="pt-2 text-center border-t border-slate-100 mt-2">
                       <p className="text-sm font-bold text-slate-800 uppercase">{data.imageDescriptions[index]}</p>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            <p>Documento generado el {new Date().toLocaleDateString()}</p>
            <p>https://secocut-app.web.app</p>
        </div>

      </div>
    </div>
  );
}

// Componentes simples
const Row = ({ label, valA, valB, bold = false, isRed = false }: any) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-200 py-1 px-2 hover:bg-slate-50 text-center", bold && "font-bold bg-slate-50")}>
        <div className="col-span-4 font-medium text-slate-700 text-left">{label}</div>
        <div className={cn("col-span-3", isRed ? "text-red-600 font-bold" : "text-slate-600")}>{valA}</div>
        <div className={cn("col-span-3", isRed ? "text-blue-600 font-bold" : "text-slate-600")}>{valB}</div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600 uppercase border-y border-slate-300 text-left">{title}</div>
);

const FinancialRow = ({ label, valA, valB, save, pct }: any) => (
    <div className="grid grid-cols-12 border-b border-green-100 py-2 px-2 hover:bg-white text-center">
        <div className="col-span-3 font-medium text-slate-700 text-left">{label}</div>
        <div className="col-span-2 text-slate-600">{valA}</div>
        <div className="col-span-2 text-slate-600">{valB}</div>
        <div className="col-span-3 font-bold text-green-600">{save}</div>
        <div className="col-span-2 text-green-600 font-bold">{pct}</div>
    </div>
);
