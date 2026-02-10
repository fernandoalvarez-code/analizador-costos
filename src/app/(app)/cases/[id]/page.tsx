
"use client";

import { useEffect, use } from "react";
import { doc } from "firebase/firestore";
// Asegúrate de que esta importación coincida con tu estructura
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Edit } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Función auxiliar para formatear moneda
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || isFinite(val) === false) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

export default function CaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  
  // Desempaquetamos el ID (Next.js 16)
  const { id } = use(params);

  // Conexión a Firestore
  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);

  // Obtenemos los datos
  const { data: rawData, isLoading } = useDoc<any>(docRef);
  
  const data = rawData || {};
  const r = data.results || {}; 

  // Auto-impresión si la URL tiene ?print=true
  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "true";
    if (shouldPrint && !isLoading && rawData) {
      // Pequeña demora para asegurar que las imágenes carguen
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, rawData]);

  if (isLoading) return <div className="p-8 space-y-4 container mx-auto"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
  if (!rawData) return <div className="p-8 text-center text-red-500">Caso no encontrado o no tienes permisos.</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 md:p-10 max-w-5xl mx-auto font-sans printable-area">
      
      {/* --- BARRA DE BOTONES (NO SALE EN EL PDF) --- */}
      <div className="flex justify-between items-center mb-8 no-print">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/cases/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar Caso
            </Button>
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
            </Button>
        </div>
      </div>

      {/* --- INICIO DEL REPORTE --- */}
      <div className="report-content space-y-8">
        
        {/* 1. ENCABEZADO / PORTADA */}
        <div className="border-b-2 border-blue-600 pb-6 mb-8">
            <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-400 uppercase tracking-wider">SECOCUT SRL</h2>
                  <h1 className="text-4xl font-extrabold text-blue-900 mt-2">{data.name || 'Informe Técnico'}</h1>
                </div>
                <div className="text-right">
                    <p className="text-lg text-slate-500 font-medium">Análisis de Productividad</p>
                    <div className="mt-2 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      {data.status || 'Completado'}
                    </div>
                </div>
            </div>
            
            <div className="mt-8 grid grid-cols-2 gap-x-12 gap-y-4">
                <div><span className="text-xs text-slate-400 uppercase font-bold">Cliente</span><p className="text-xl font-semibold text-slate-800">{data.cliente || '-'}</p></div>
                <div><span className="text-xs text-slate-400 uppercase font-bold">Fecha</span><p className="text-xl font-semibold text-slate-800">{data.fecha || '-'}</p></div>
                <div><span className="text-xs text-slate-400 uppercase font-bold">Operación</span><p className="text-lg text-slate-700">{data.operacion || '-'}</p></div>
                <div><span className="text-xs text-slate-400 uppercase font-bold">Material</span><p className="text-lg text-slate-700">{data.material || '-'}</p></div>
            </div>
        </div>

        {/* 2. RESUMEN EJECUTIVO (TARJETAS GRANDES) */}
        <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 break-inside-avoid shadow-sm">
            <h3 className="text-xl font-bold text-blue-900 mb-4 text-center">Resumen de Impacto Económico</h3>
            <div className="grid grid-cols-3 gap-6 text-center divide-x divide-blue-200">
                <div>
                    <p className="text-sm text-slate-500 uppercase font-semibold">Costo Actual (Mensual)</p>
                    <p className="text-2xl font-bold text-slate-700">{formatCurrency(r.costoTotalMensualA)}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500 uppercase font-semibold">Costo Propuesto (Mensual)</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(r.costoTotalMensualB)}</p>
                </div>
                <div>
                    <p className="text-sm text-green-600 uppercase font-bold">Ahorro Anual Proyectado</p>
                    <p className="text-3xl font-black text-green-600">{formatCurrency(r.ahorroAnual)}</p>
                </div>
            </div>
        </div>

        {/* 3. TABLA DETALLADA TÉCNICA */}
        <section className="break-inside-avoid mt-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 pl-3 border-l-4 border-blue-500">Datos Detallados del Proceso</h3>
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-100">
                        <TableRow>
                            <TableHead className="font-bold text-slate-700 w-1/3">Parámetro</TableHead>
                            <TableHead className="text-center font-bold text-slate-700 w-1/3">Actual (A)</TableHead>
                            <TableHead className="text-center font-bold text-blue-700 w-1/3 bg-blue-50">Propuesta (B)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow><TableCell className="font-medium">Herramienta / Inserto</TableCell><TableCell className="text-center text-sm">{data.descA}</TableCell><TableCell className="text-center text-sm bg-blue-50/30 font-semibold">{data.descB}</TableCell></TableRow>
                        <TableRow><TableCell className="font-medium">Precio Inserto</TableCell><TableCell className="text-center">{formatCurrency(data.precioA)}</TableCell><TableCell className="text-center bg-blue-50/30">{formatCurrency(data.precioB)}</TableCell></TableRow>
                        <TableRow><TableCell className="font-medium">Vida Útil (Piezas/Filo)</TableCell><TableCell className="text-center">{data.piezasFiloA}</TableCell><TableCell className="text-center bg-blue-50/30 font-bold">{data.piezasFiloB}</TableCell></TableRow>
                        <TableRow><TableCell className="font-medium">Tiempo de Ciclo</TableCell><TableCell className="text-center">{r.tiempoCicloA?.toFixed(2)} min</TableCell><TableCell className="text-center bg-blue-50/30 font-bold text-green-600">{r.tiempoCicloB?.toFixed(2)} min</TableCell></TableRow>
                        <TableRow className="bg-slate-50 border-t-2 border-slate-200"><TableCell className="font-black">COSTO TOTAL / PIEZA</TableCell><TableCell className="text-center font-black text-lg text-slate-700">{formatCurrency(r.cppA)}</TableCell><TableCell className="text-center font-black text-lg text-blue-600 bg-blue-50">{formatCurrency(r.cppB)}</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
        </section>

        {/* 4. TABLA FINANCIERA */}
        <section className="break-inside-avoid mt-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 pl-3 border-l-4 border-green-500">Análisis Financiero (Mensual)</h3>
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-100">
                        <TableRow>
                            <TableHead className="font-bold text-slate-700">Concepto</TableHead>
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
                            <TableCell className="text-right text-sm text-slate-400">Varía según consumo</TableCell>
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
                            <TableCell className="text-right text-green-700 text-lg">{formatCurrency(r.ahorroMensual)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </section>

        {/* 5. EVIDENCIA FOTOGRÁFICA (AQUÍ ESTÁ LA MAGIA) */}
        {data.imageUrls && data.imageUrls.length > 0 && (
          <div className="mt-10 break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-800 mb-6 pl-3 border-l-4 border-indigo-500">
              Evidencia Fotográfica
            </h3>
            
            {/* GRID DE 2 COLUMNAS FUERTE */}
            <div className="grid grid-cols-2 gap-8">
              {data.imageUrls.map((url: string, index: number) => (
                <div key={index} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white break-inside-avoid">
                   {/* Título de la imagen */}
                   <div className="bg-blue-50 py-2 border-b border-blue-100">
                     <p className="text-center text-xs font-bold text-blue-600 uppercase tracking-widest">
                       {data.imageDescriptions?.[index] ? "Evidencia Registrada" : `Evidencia ${index + 1}`}
                     </p>
                   </div>
                   
                   {/* Contenedor de Imagen */}
                   <div className="h-64 bg-white p-4 flex items-center justify-center">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img 
                        src={url} 
                        alt={`Evidencia ${index + 1}`} 
                        className="max-h-full max-w-full object-contain"
                        // Importante para impresión: crossOrigin para evitar problemas de CORS al renderizar en PDF
                        crossOrigin="anonymous" 
                     />
                   </div>

                   {/* Descripción al pie */}
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
        )}
        
        {/* PIE DE PÁGINA */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>Generado automáticamente el {new Date().toLocaleDateString()} | Confidencial</p>
            <p className="mt-1">https://secocut-app.web.app</p>
        </div>

      </div>
    </div>
  );
}
