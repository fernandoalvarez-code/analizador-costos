
"use client";

import { useEffect, use } from "react";
import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Edit } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Función para formatear dinero
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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

  // Auto-imprimir si viene ?print=true
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      // Damos un poco más de tiempo (1.5s) para que las imágenes carguen antes de abrir el diálogo
      const timer = setTimeout(() => {
        window.print();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData]);

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData) return <div className="p-8 text-center text-red-500">Caso no encontrado.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8 max-w-[210mm] mx-auto font-sans printable-area">
      
      {/* --- BOTONES (NO IMPRIMIBLES) --- */}
      <div className="flex justify-between items-center mb-8 no-print">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </div>
      </div>

      {/* --- REPORTE ESTILO "ANALIZADOR" --- */}
      <div className="report-content space-y-6">
        
        {/* 1. ENCABEZADO (Estilo Azul) */}
        <div className="border-b-4 border-blue-600 pb-4 mb-6">
            <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Analizador de Costos de Corte</h2>
                  <h1 className="text-4xl font-extrabold text-blue-900">{data.name || 'Sin Título'}</h1>
                </div>
                <div className="text-right">
                    <Badge variant="outline" className="text-base px-3 py-1 mb-1 border-blue-200 text-blue-800 bg-blue-50">
                        {data.status || 'Pendiente'}
                    </Badge>
                    <p className="text-sm text-slate-400">SECOCUT SRL</p>
                </div>
            </div>
            
            {/* Grid de Datos del Cliente */}
            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="block font-bold text-slate-400 text-xs uppercase">Cliente</span><span className="font-semibold text-slate-800 text-lg">{data.cliente || '-'}</span></div>
                <div><span className="block font-bold text-slate-400 text-xs uppercase">Fecha</span><span className="font-semibold text-slate-800 text-lg">{data.fecha || '-'}</span></div>
                <div><span className="block font-bold text-slate-400 text-xs uppercase">Operación</span><span className="font-semibold text-slate-800 text-lg">{data.operacion || '-'}</span></div>
                <div><span className="block font-bold text-slate-400 text-xs uppercase">Material</span><span className="font-semibold text-slate-800 text-lg">{data.material || '-'}</span></div>
            </div>
        </div>

        {/* 2. RESUMEN DE IMPACTO (Tarjetas) */}
        <div className="grid grid-cols-2 gap-4 break-inside-avoid">
            <div className="bg-blue-600 text-white p-6 rounded-xl shadow-sm print:bg-blue-600 print:text-white">
                <h3 className="text-blue-100 text-sm font-bold uppercase mb-1">Ahorro Anual Proyectado</h3>
                <p className="text-4xl font-black">{formatCurrency(r.ahorroAnual)}</p>
                <p className="text-blue-200 text-sm mt-2">ROI: {r.roi?.toFixed(0)}%</p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-slate-400 uppercase">Costo Actual (Mes)</span>
                    <span className="text-xl font-bold text-slate-700">{formatCurrency(r.costoTotalMensualA)}</span>
                </div>
                <div className="w-full h-px bg-slate-100 mb-2"></div>
                <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-blue-600 uppercase">Costo Propuesto (Mes)</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(r.costoTotalMensualB)}</span>
                </div>
            </div>
        </div>

        {/* 3. TABLA DETALLADA (Estilo lista limpia) */}
        <div className="break-inside-avoid pt-4">
            <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-blue-500 pl-3">Datos Detallados del Proceso</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-bold text-slate-600">Parámetro</TableHead>
                            <TableHead className="text-center font-bold text-slate-600 w-1/3">Actual (A)</TableHead>
                            <TableHead className="text-center font-bold text-blue-700 w-1/3 bg-blue-50/50">Propuesta (B)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow><TableCell>Descripción</TableCell><TableCell className="text-center text-xs">{data.descA}</TableCell><TableCell className="text-center text-xs bg-blue-50/30 font-medium">{data.descB}</TableCell></TableRow>
                        <TableRow><TableCell>Precio Inserto</TableCell><TableCell className="text-center">{formatCurrency(data.precioA)}</TableCell><TableCell className="text-center bg-blue-50/30">{formatCurrency(data.precioB)}</TableCell></TableRow>
                        <TableRow><TableCell>Filos por Inserto</TableCell><TableCell className="text-center">{data.filosA}</TableCell><TableCell className="text-center bg-blue-50/30">{data.filosB}</TableCell></TableRow>
                        <TableRow><TableCell>Vida Útil (Piezas/Filo)</TableCell><TableCell className="text-center">{data.piezasFiloA}</TableCell><TableCell className="text-center bg-blue-50/30 font-bold">{data.piezasFiloB}</TableCell></TableRow>
                        <TableRow><TableCell>Tiempo de Ciclo</TableCell><TableCell className="text-center">{r.tiempoCicloA?.toFixed(2)} min</TableCell><TableCell className="text-center bg-blue-50/30 font-bold text-green-700">{r.tiempoCicloB?.toFixed(2)} min</TableCell></TableRow>
                        <TableRow className="bg-slate-100 border-t-2 border-slate-200"><TableCell className="font-black">COSTO TOTAL / PIEZA</TableCell><TableCell className="text-center font-black text-lg text-slate-700">{formatCurrency(r.cppA)}</TableCell><TableCell className="text-center font-black text-lg text-blue-700 bg-blue-100/50">{formatCurrency(r.cppB)}</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>

        {/* 4. TABLA FINANCIERA */}
        <div className="break-inside-avoid pt-2">
            <h3 className="text-lg font-bold text-slate-800 mb-3 pl-3 border-l-4 border-green-500">Análisis Financiero (Mensual)</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-bold text-slate-600">Concepto</TableHead>
                            <TableHead className="text-center">Actual</TableHead>
                            <TableHead className="text-center">Propuesta</TableHead>
                            <TableHead className="text-right font-bold text-green-700">Diferencia</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Gasto en Herramientas</TableCell>
                            <TableCell className="text-center text-slate-500">{formatCurrency((r.costoTotalMensualA || 0) - (r.tiempoMaquinaMensualValorA || 0))}</TableCell>
                            <TableCell className="text-center text-slate-500">{formatCurrency((r.costoTotalMensualB || 0) - (r.tiempoMaquinaMensualValorB || 0))}</TableCell>
                            <TableCell className="text-right text-xs text-slate-400 uppercase font-medium">Consumibles</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Costo Operativo Máquina</TableCell>
                            <TableCell className="text-center">{formatCurrency(r.tiempoMaquinaMensualValorA)}</TableCell>
                            <TableCell className="text-center">{formatCurrency(r.tiempoMaquinaMensualValorB)}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">{formatCurrency((r.tiempoMaquinaMensualValorA || 0) - (r.tiempoMaquinaMensualValorB || 0))}</TableCell>
                        </TableRow>
                        <TableRow className="bg-green-50/30 border-t border-green-200 font-bold">
                            <TableCell>TOTAL MENSUAL</TableCell>
                            <TableCell className="text-center">{formatCurrency(r.costoTotalMensualA)}</TableCell>
                            <TableCell className="text-center text-blue-700">{formatCurrency(r.costoTotalMensualB)}</TableCell>
                            <TableCell className="text-right text-green-700 text-xl">{formatCurrency(r.ahorroMensual)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>

        {/* 5. EVIDENCIA FOTOGRÁFICA (GRID 2 COLUMNAS) */}
        {data.imageUrls && data.imageUrls.length > 0 ? (
          <div className="mt-8 break-before-page">
            <h3 className="text-xl font-bold text-slate-800 mb-6 pl-3 border-l-4 border-indigo-500">
              Evidencia Fotográfica
            </h3>
            
            <div className="grid grid-cols-2 gap-8">
              {data.imageUrls.map((url: string, index: number) => (
                <div key={index} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm break-inside-avoid page-break-inside-avoid">
                   {/* Cabecera de la imagen */}
                   <div className="bg-slate-100 py-2 border-b border-slate-200 text-center">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                       {data.imageDescriptions?.[index] ? "Imagen Registrada" : `Evidencia ${index + 1}`}
                     </span>
                   </div>
                   
                   {/* Imagen con tamaño forzado para impresión */}
                   <div className="bg-white p-2 flex items-center justify-center h-64 print:h-64">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img 
                        src={url} 
                        alt={`Evidencia ${index + 1}`} 
                        className="max-h-full max-w-full object-contain"
                        crossOrigin="anonymous" 
                     />
                   </div>

                   {/* Descripción */}
                   {data.imageDescriptions?.[index] && (
                     <div className="py-3 px-4 bg-slate-50 border-t border-slate-100 text-center">
                       <p className="text-sm font-bold text-slate-800 uppercase">
                         {data.imageDescriptions[index]}
                       </p>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        ) : (
             <div className="mt-8 p-8 border-2 border-dashed border-slate-200 rounded-lg text-center text-slate-400 italic no-print">
                Sin evidencia fotográfica adjunta.
             </div>
        )}
        
        {/* PIE DE PÁGINA */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 flex justify-between">
            <span>Generado el {new Date().toLocaleDateString()}</span>
            <span>Documento Confidencial - SECOCUT SRL</span>
        </div>

      </div>
    </div>
  );
}

    