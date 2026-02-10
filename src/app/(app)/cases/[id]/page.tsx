"use client";

import { useEffect, use } from "react";
import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Edit } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

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

      <div className="report-content space-y-8">
        
        {/* 1. ENCABEZADO CORREGIDO (Solo "ANALIZADOR DE COSTOS") */}
        <div className="border-b-2 border-slate-300 pb-4">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-slate-500 mb-1">{new Date().toLocaleDateString()}</p>
                    {/* TÍTULO ENORME Y LIMPIO */}
                    <h1 className="text-4xl font-black text-slate-700 tracking-tight uppercase leading-none">
                        ANALIZADOR DE COSTOS
                    </h1>
                    <h2 className="text-2xl font-bold text-blue-900 mt-1">{data.name || 'Sin Título'}</h2>
                </div>
                <div className="text-right">
                    <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">SECOCUT SRL</h3>
                    <p className="text-xs text-slate-500">Análisis de Productividad</p>
                </div>
            </div>
            
            {/* Grid de Datos del Cliente */}
            <div className="grid grid-cols-4 gap-4 text-sm pt-2">
                <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Cliente</span><span className="font-semibold text-slate-800">{data.cliente || 'N/A'}</span></div>
                <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Fecha</span><span className="font-semibold text-slate-800">{data.fecha || '-'}</span></div>
                <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Operación</span><span className="font-semibold text-slate-800">{data.operacion || '-'}</span></div>
                <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Material</span><span className="font-semibold text-slate-800">{data.material || '-'}</span></div>
            </div>
        </div>

        {/* 2. COMPARATIVA VISUAL (Barras Roja y Azul - Estilo Captura 10.20.19) */}
        <div className="break-inside-avoid">
            <h3 className="text-center text-xl font-bold text-slate-800 mb-6">Comparativa de Costo Total por Pieza</h3>
            <div className="grid grid-cols-2 gap-12 max-w-2xl mx-auto">
                {/* BARRA ACTUAL (ROJA) */}
                <div className="flex flex-col items-center">
                    <div className="text-3xl font-bold text-red-500 mb-1">{formatCurrency(r.cppA)}</div>
                    <div className="text-sm font-bold text-slate-500 mb-2 uppercase">Actual</div>
                    <div className="w-full rounded-lg overflow-hidden border border-red-200 shadow-sm">
                        <div className="bg-red-600 text-white text-center py-2 text-xs font-bold">
                            Máquina <br/><span className="text-sm">{formatCurrency(r.costoMaquinaA)}</span>
                        </div>
                        <div className="bg-red-300 text-red-900 text-center py-2 text-xs font-bold">
                            Herram. <br/><span className="text-sm">{formatCurrency(r.costoHerramientaA)}</span>
                        </div>
                    </div>
                </div>

                {/* BARRA PROPUESTA (AZUL) */}
                <div className="flex flex-col items-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{formatCurrency(r.cppB)}</div>
                    <div className="text-sm font-bold text-slate-500 mb-2 uppercase">Propuesta</div>
                    <div className="w-full rounded-lg overflow-hidden border border-blue-200 shadow-sm">
                        <div className="bg-blue-600 text-white text-center py-2 text-xs font-bold">
                            Máquina <br/><span className="text-sm">{formatCurrency(r.costoMaquinaB)}</span>
                        </div>
                        <div className="bg-blue-300 text-blue-900 text-center py-2 text-xs font-bold">
                            Herram. <br/><span className="text-sm">{formatCurrency(r.costoHerramientaB)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 3. TABLA DE DATOS DETALLADOS */}
        <div className="break-inside-avoid mt-8">
            <div className="border border-slate-300 text-sm shadow-sm">
                <div className="grid grid-cols-10 bg-slate-100 font-bold border-b border-slate-300 py-2 px-3">
                    <div className="col-span-4">Parámetro</div>
                    <div className="col-span-3 text-center text-red-600">Inserto A (Actual)</div>
                    <div className="col-span-3 text-center text-blue-600">Inserto B (Propuesta)</div>
                </div>

                <SectionTitle title="DATOS DEL INSERTO" />
                <Row label="Descripción" valA={data.descA} valB={data.descB} />
                <Row label="Precio del Inserto" valA={formatCurrency(data.precioA)} valB={formatCurrency(data.precioB)} />
                <Row label="Filos por Inserto" valA={data.filosA} valB={data.filosB} />
                <Row label="Vida por Filo (minutos)" valA={`${r.minutosFiloA?.toFixed(1)} min`} valB={`${r.minutosFiloB?.toFixed(1)} min`} />
                <Row label="Piezas por Filo" valA={data.piezasFiloA} valB={data.piezasFiloB} bold />
                <Row label="Piezas Totales / Inserto" valA={(data.filosA * data.piezasFiloA)} valB={(data.filosB * data.piezasFiloB)} />
                <div className="grid grid-cols-10 border-b border-slate-200 py-1 px-3">
                    <div className="col-span-4 font-medium text-slate-700">Insertos Req. / Mes</div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesA.toFixed(2)} <span className="text-[10px]">({formatCurrency(costoInsertosMesA)})</span></div>
                    <div className="col-span-3 text-center text-slate-600">{insertosMesB.toFixed(2)} <span className="text-[10px]">({formatCurrency(costoInsertosMesB)})</span></div>
                </div>
                <Row label="Costo Herramienta / Pieza" valA={formatCurrency(r.costoHerramientaA)} valB={formatCurrency(r.costoHerramientaB)} isRed />

                <SectionTitle title="DATOS DEL PROCESO" />
                <Row label="Tiempo de Ciclo (min)" valA={`${r.tiempoCicloA?.toFixed(3)} min`} valB={`${r.tiempoCicloB?.toFixed(3)} min`} />
                <Row label="Velocidad de Corte (Vc)" valA={`${data.vcA || 0} m/min`} valB={`${data.vcB || 0} m/min`} />
                
                <div className="grid grid-cols-10 border-b border-slate-200 py-1 px-3">
                    <div className="col-span-4 font-medium text-slate-700">Costo Hora-Máquina</div>
                    <div className="col-span-6 text-center text-slate-600">{formatCurrency(data.machineHourlyRate)} <span className="text-[10px]">({formatCurrency(costoMinuto)}/min)</span></div>
                </div>

                <Row label="Parada por Cambio (costo/pza)" valA={formatCurrency(r.costoParadaA)} valB={formatCurrency(r.costoParadaB)} />
                <Row label="Costo Máquina / Pieza" valA={formatCurrency(r.costoMaquinaA)} valB={formatCurrency(r.costoMaquinaB)} isRed />
                
                <div className="grid grid-cols-10 bg-slate-200 py-2 px-3 font-black border-t border-slate-300 text-base">
                    <div className="col-span-4 uppercase text-slate-800">COSTO TOTAL / PIEZA</div>
                    <div className="col-span-3 text-center text-red-600">{formatCurrency(r.cppA)}</div>
                    <div className="col-span-3 text-center text-blue-600">{formatCurrency(r.cppB)}</div>
                </div>
            </div>
        </div>

        {/* 4. RESUMEN FINANCIERO */}
        <div className="break-inside-avoid mt-8">
            <h3 className="text-xl font-bold text-center mb-4">Resumen Financiero (para {data.piezasAlMes?.toLocaleString()} piezas/mes)</h3>
            <div className="border border-green-200 rounded text-sm overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 bg-green-50 py-2 px-3 font-bold text-green-900 border-b border-green-200">
                    <div className="col-span-3">Métrica</div>
                    <div className="col-span-2 text-center">Actual</div>
                    <div className="col-span-2 text-center">Propuesta</div>
                    <div className="col-span-3 text-right">Ahorro</div>
                    <div className="col-span-2 text-right">% Mejora</div>
                </div>

                <FinancialRow label="Costo Total por Pieza" valA={formatCurrency(r.cppA)} valB={formatCurrency(r.cppB)} save={formatCurrency(r.ahorroPorPieza)} pct={formatPercent(r.totalCostReductionPercent)} />
                <FinancialRow label="Costo Total (Mensual)" valA={formatCurrency(r.costoTotalMensualA)} valB={formatCurrency(r.costoTotalMensualB)} save={formatCurrency(r.ahorroMensual)} pct={formatPercent(r.totalCostReductionPercent)} />
                
                <div className="grid grid-cols-12 border-b border-green-100 py-2 px-3 bg-white items-center">
                    <div className="col-span-3 font-medium text-slate-700">Tiempo Máquina (Mensual)</div>
                    <div className="col-span-2 text-center text-slate-600">{formatCurrency(r.tiempoMaquinaMensualValorA)}<div className="text-[10px]">{r.tiempoMaquinaMensualHorasA?.toFixed(2)} hs</div></div>
                    <div className="col-span-2 text-center text-slate-600">{formatCurrency(r.tiempoMaquinaMensualValorB)}<div className="text-[10px]">{r.tiempoMaquinaMensualHorasB?.toFixed(2)} hs</div></div>
                    <div className="col-span-3 text-right font-bold text-green-600">- {r.machineHoursFreedMonthly?.toFixed(2)} hs liberadas</div>
                    <div className="col-span-2 text-right text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>

                <div className="grid grid-cols-12 border-b border-green-100 py-2 px-3 bg-white items-center">
                    <div className="col-span-3 font-medium text-slate-700">Turnos de 8hs (Mensual)</div>
                    <div className="col-span-2 text-center text-slate-600">{turnosA.toFixed(2)} turnos</div>
                    <div className="col-span-2 text-center text-slate-600">{turnosB.toFixed(2)} turnos</div>
                    <div className="col-span-3 text-right font-bold text-green-600">{turnosAhorrados.toFixed(2)} turnos liberados</div>
                    <div className="col-span-2 text-right text-green-600 font-bold">{formatPercent(r.timeReductionPercent)}</div>
                </div>

                <div className="grid grid-cols-12 bg-green-100 py-3 px-3 font-black border-t border-green-300 text-base">
                    <div className="col-span-3 text-slate-800">COSTO TOTAL (ANUAL)</div>
                    <div className="col-span-2 text-center text-slate-800">{formatCurrency((r.costoTotalMensualA || 0) * 12)}</div>
                    <div className="col-span-2 text-center text-blue-700">{formatCurrency((r.costoTotalMensualB || 0) * 12)}</div>
                    <div className="col-span-3 text-right text-green-700">{formatCurrency(r.ahorroAnual)}</div>
                    <div className="col-span-2 text-right text-green-700">{formatPercent(r.totalCostReductionPercent)}</div>
                </div>
            </div>
        </div>

        {/* 5. EVIDENCIA FOTOGRÁFICA (SIN ERRORES) */}
        {data.imageUrls && data.imageUrls.length > 0 && (
          <div className="mt-8 break-inside-avoid page-break-before-always">
            <h3 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-slate-800 pl-3">
              Evidencia Fotográfica
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {data.imageUrls.map((url: string, index: number) => {
                if (!url || url.trim() === "") return null; // Filtro de seguridad
                return (
                <div key={index} className="border border-slate-300 bg-white p-1 shadow-sm break-inside-avoid">
                   <div className="bg-slate-100 py-1 text-center border-b border-slate-200 mb-2">
                     <span className="text-xs font-bold text-slate-600 uppercase">
                       {data.imageDescriptions?.[index] ? "EVIDENCIA" : `IMAGEN ${index + 1}`}
                     </span>
                   </div>
                   <div className="h-64 w-full flex items-center justify-center bg-white overflow-hidden">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={url} alt={`Evidencia ${index + 1}`} className="object-contain max-h-full max-w-full" style={{ display: 'block', margin: '0 auto' }} />
                   </div>
                   {data.imageDescriptions?.[index] && (
                     <div className="pt-2 text-center border-t border-slate-100 mt-2">
                       <p className="text-sm font-bold text-slate-800 uppercase">{data.imageDescriptions[index]}</p>
                     </div>
                   )}
                </div>
              )})}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            <p>Generado con Analizador de Costos de Corte | {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

// Componentes simples
const Row = ({ label, valA, valB, bold = false, isRed = false }: any) => (
    <div className={cn("grid grid-cols-10 border-b border-slate-200 py-1 px-3 bg-white text-center items-center", bold && "font-bold bg-slate-50")}>
        <div className="col-span-4 font-medium text-slate-700 text-left">{label}</div>
        <div className={cn("col-span-3", isRed ? "text-red-600 font-bold" : "text-slate-600")}>{valA}</div>
        <div className={cn("col-span-3", isRed ? "text-blue-600 font-bold" : "text-slate-600")}>{valB}</div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="bg-yellow-50 px-3 py-1 text-xs font-bold text-slate-500 uppercase border-y border-slate-300 text-left">{title}</div>
);

const FinancialRow = ({ label, valA, valB, save, pct }: any) => (
    <div className="grid grid-cols-12 border-b border-green-100 py-2 px-3 bg-white items-center text-center">
        <div className="col-span-3 font-medium text-slate-700 text-left">{label}</div>
        <div className="col-span-2 text-slate-600">{valA}</div>
        <div className="col-span-2 text-slate-600">{valB}</div>
        <div className="col-span-3 font-bold text-green-600">{save}</div>
        <div className="col-span-2 text-green-600 font-bold">{pct}</div>
    </div>
);

