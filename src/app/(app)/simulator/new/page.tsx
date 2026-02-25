"use client";

import React, { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SimulatorSchema } from "@/lib/schemas";
import { useSimulatorCalc } from "@/hooks/use-simulator-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, TrendingUp, AlertCircle, Download, Share2, Loader2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";

export default function NewSimulatorPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Inicializamos el formulario con valores por defecto para que no explote
  const form = useForm({
    resolver: zodResolver(SimulatorSchema),
    defaultValues: {
      clientName: "",
      machineUsdPerHour: 35,
      toolChangeMin: 2,
      scrapCostUsdPerPiece: 10,
      china: { priceUsd: 4, pcsPerEdge: 15, cycleMinPerPiece: 1.5, pcsBetweenChanges: 15, scrapRate: 0.05 },
      premium: { priceUsd: 11, pcsPerEdge: 45, cycleMinPerPiece: 1.2, pcsBetweenChanges: 45, scrapRate: 0.01 },
    },
  });

  // Observamos los valores en tiempo real para pasárselos al hook matemático
  const chinaVals = useWatch({ control: form.control, name: "china" }) as any;
  const premiumVals = useWatch({ control: form.control, name: "premium" }) as any;
  const machineUsdPerHour = useWatch({ control: form.control, name: "machineUsdPerHour" }) || 0;
  const toolChangeMin = useWatch({ control: form.control, name: "toolChangeMin" }) || 0;
  const scrapCostUsdPerPiece = useWatch({ control: form.control, name: "scrapCostUsdPerPiece" }) || 0;

  // El motor matemático trabajando en vivo
  const results = useSimulatorCalc(
    chinaVals || { priceUsd: 0, pcsPerEdge: 1, cycleMinPerPiece: 0, pcsBetweenChanges: 1, scrapRate: 0 },
    premiumVals || { priceUsd: 0, pcsPerEdge: 1, cycleMinPerPiece: 0, pcsBetweenChanges: 1, scrapRate: 0 },
    { machineUsdPerHour, toolChangeMin, scrapCostUsdPerPiece }
  );
  
  const handleDownloadPDF = async () => {
    setIsPrinting(true);
    const element = document.getElementById('pdf-report-template');
    if (!element) {
        setIsPrinting(false);
        alert("No se pudo encontrar la plantilla del informe.");
        return;
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const html2pdf = (await import('html2pdf.js')).default;
        const clientName = form.getValues('clientName');
        const fileName = `Informe_Simulador_${clientName ? clientName.replace(/ /g, '_') : 'Competitividad'}.pdf`;
        
        const opt = {
            margin:       0, // LO PONEMOS EN 0 PARA CONTROLAR TODO DESDE EL HTML
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1000 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Hubo un error al generar el PDF.");
    } finally {
        setIsPrinting(false);
    }
  };

  const handleWhatsAppShare = () => {
    const values = form.getValues();
    const { clientName, china, premium } = values;
    const { chinaCalc, premiumCalc, argument } = results;

    const savingsPct = chinaCalc.totalCostPerPiece > 0 ? (1 - (premiumCalc.totalCostPerPiece / chinaCalc.totalCostPerPiece)) * 100 : 0;
    
    const message = `Estimado/a *${clientName || "Cliente"}*,
Le comparto el resumen de nuestra simulación técnica de mecanizado:

📊 *COMPARATIVA DE COSTO TOTAL POR PIEZA*
• Inserto Actual: *${formatCurrency(chinaCalc.totalCostPerPiece)}*
• Inserto Premium: *${formatCurrency(premiumCalc.totalCostPerPiece)}*
📉 *Ahorro Directo:* *${savingsPct.toFixed(1)}%*

⚙️ *PARÁMETROS CLAVE (Actual vs Premium)*
• Vida útil (Pzs/Filo): ${china.pcsPerEdge} vs ${premium.pcsPerEdge}
• Tiempo de ciclo: ${china.cycleMinPerPiece} min vs ${premium.cycleMinPerPiece} min
• Tasa de rechazo (Scrap): ${formatPercent(china.scrapRate * 100)} vs ${formatPercent(premium.scrapRate * 100)}

💡 *CONCLUSIÓN TÉCNICA:*
${argument}

Quedo a su entera disposición para cualquier consulta.`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      // AQUÍ IRÁ LA CONEXIÓN A FIREBASE EN EL PRÓXIMO PASO
      console.log("Data lista para Firebase:", data);
      console.log("Resultados a guardar:", results);
      alert("¡Simulación lista! Abre la consola para ver los datos.");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Colores dinámicos para el semáforo
  const trafficColors = {
    green: "bg-green-100 border-green-500 text-green-900",
    yellow: "bg-yellow-100 border-yellow-500 text-yellow-900",
    red: "bg-red-100 border-red-500 text-red-900",
  };
  
  const formValuesForPdf = form.getValues();

  return (
    <div className="min-h-screen bg-slate-50">
      <div id="simulator-content" className="max-w-2xl mx-auto p-4">
        
        <div className="flex justify-between items-center mb-6" id="header-actions">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Secocut Logo" className="h-8 w-auto mr-3" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SIMULADOR</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleDownloadPDF} disabled={isPrinting} variant="outline">
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                PDF
            </Button>
             <Button onClick={handleWhatsAppShare} variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                WhatsApp
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                <Save className="mr-2 h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 rounded-lg shadow-md z-10 p-3 my-6">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="text-center">
                <span className="block text-[9px] uppercase font-bold text-slate-500">Costo Pza (Competidor)</span>
                <span className="block text-lg font-bold text-slate-700">{formatCurrency(results.chinaCalc.totalCostPerPiece)}</span>
              </div>
              <div className="text-center border-l border-slate-200">
                <span className="block text-[9px] uppercase font-bold text-blue-600">Costo Pza (Nuestro)</span>
                <span className="block text-lg font-bold text-blue-700">{formatCurrency(results.premiumCalc.totalCostPerPiece)}</span>
              </div>
            </div>
            <div className={`p-2 rounded-md border flex items-center gap-2 ${trafficColors[results.trafficLight]}`}>
              {results.trafficLight === 'green' ? <TrendingUp className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <p className="text-[11px] font-medium leading-snug">
                {results.argument || "Cargando datos..."}
              </p>
            </div>
        </div>

        <Form {...form}>
          <form className="space-y-6">
            
            {/* SECCIÓN 1: DATOS GENERALES */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 bg-slate-100 border-b border-slate-200">
                <CardTitle className="text-sm font-bold uppercase text-slate-600">Datos del Proceso</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Cliente</FormLabel><FormControl><Input placeholder="Ej: Metalúrgica Roma" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="machineUsdPerHour" render={({ field }) => (
                  <FormItem><FormLabel>Costo Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="toolChangeMin" render={({ field }) => (
                  <FormItem><FormLabel>Tiempo Cambio Herramienta (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="scrapCostUsdPerPiece" render={({ field }) => (
                  <FormItem><FormLabel>Costo por Pieza Scrap (USD)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* SECCIÓN 2: COMPARADOR SIDE-BY-SIDE */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              
              {/* COLUMNA COMPETIDOR */}
              <Card className="border-slate-300 shadow-sm overflow-hidden">
                <div className="bg-slate-200 p-2 text-center border-b border-slate-300">
                  <span className="text-xs font-black uppercase text-slate-600 tracking-wider">Competidor</span>
                </div>
                <CardContent className="p-3 space-y-3 bg-slate-50">
                  <FormField control={form.control} name="china.priceUsd" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Precio Inserto</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.pcsPerEdge" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Piezas / Filo</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.cycleMinPerPiece" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Ciclo (min/pza)</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.pcsBetweenChanges" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Pzs entre Cambios</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.scrapRate" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Tasa Scrap (0 a 1)</FormLabel><FormControl><Input type="number" className="h-8 text-sm" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><p className="text-[9px] text-slate-400">Ej: 0.05 = 5%</p></FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* COLUMNA NUESTRO INSERTO */}
              <Card className="border-blue-300 shadow-sm overflow-hidden">
                <div className="bg-blue-600 p-2 text-center border-b border-blue-700">
                  <span className="text-xs font-black uppercase text-white tracking-wider">Nuestro Inserto</span>
                </div>
                <CardContent className="p-3 space-y-3 bg-blue-50/30">
                  <FormField control={form.control} name="premium.priceUsd" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Precio Inserto</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.pcsPerEdge" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Piezas / Filo</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.cycleMinPerPiece" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Ciclo (min/pza)</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.pcsBetweenChanges" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Pzs entre Cambios</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.scrapRate" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Tasa Scrap (0 a 1)</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><p className="text-[9px] text-blue-400">Ej: 0.01 = 1%</p></FormItem>
                  )} />
                </CardContent>
              </Card>

            </div>
          </form>
        </Form>
      </div>

      {/* PDF REPORT TEMPLATE (HIDDEN CORRECTAMENTE - UNA SOLA HOJA A4) */}
      <div className="absolute top-0 left-0 opacity-0 pointer-events-none -z-50 overflow-hidden h-0 w-0">
        <div id="pdf-report-template" className="w-[210mm] h-[290mm] bg-white text-black p-10 font-sans box-border flex flex-col justify-between overflow-hidden">
          
          {/* HEADER CON LOGO */}
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-4">
              {/* Asumiendo que el logo se llama logo.png y está en la carpeta public */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Secocut Logo" className="h-12 w-auto object-contain" />
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Informe de Competitividad</h1>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">Secocut SRL</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-500 uppercase">FECHA</p>
              <p className="text-base font-semibold text-slate-800">{new Date().toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          {/* DATOS DEL PROCESO */}
          <div>
              <h2 className="text-lg font-bold text-blue-700 mb-3 uppercase tracking-wide">Datos del Proceso</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p><span className="font-semibold text-slate-600">Cliente:</span> {formValuesForPdf.clientName || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-600">Costo Hora-Máquina:</span> {formatCurrency(formValuesForPdf.machineUsdPerHour)}</p>
                  <p><span className="font-semibold text-slate-600">Tiempo Cambio Herr.:</span> {formValuesForPdf.toolChangeMin} min</p>
                  <p><span className="font-semibold text-slate-600">Costo Pieza Scrap:</span> {formatCurrency(formValuesForPdf.scrapCostUsdPerPiece)}</p>
              </div>
          </div>

          {/* TABLA COMPARATIVA */}
          <div>
              <h2 className="text-lg font-bold text-blue-700 mb-3 uppercase tracking-wide">Tabla Comparativa</h2>
              <table className="w-full text-left border-collapse text-sm">
                  <thead>
                      <tr className="bg-slate-800 text-white">
                          <th className="p-2 font-semibold border-b border-slate-300">Parámetro</th>
                          <th className="p-2 font-semibold text-center border-b border-slate-300">Competidor</th>
                          <th className="p-2 font-semibold text-center border-b border-slate-300">Nuestro Inserto</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr className="bg-slate-100">
                          <td className="p-2 border-b border-slate-200 font-medium">Precio Inserto</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatCurrency(formValuesForPdf.china.priceUsd)}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatCurrency(formValuesForPdf.premium.priceUsd)}</td>
                      </tr>
                      <tr>
                          <td className="p-2 border-b border-slate-200 font-medium">Piezas / Filo</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.china.pcsPerEdge}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.premium.pcsPerEdge}</td>
                      </tr>
                      <tr className="bg-slate-100">
                          <td className="p-2 border-b border-slate-200 font-medium">Ciclo (min/pza)</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.china.cycleMinPerPiece}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.premium.cycleMinPerPiece}</td>
                      </tr>
                      <tr>
                          <td className="p-2 border-b border-slate-200 font-medium">Tasa de Scrap</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatPercent(formValuesForPdf.china.scrapRate * 100)}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatPercent(formValuesForPdf.premium.scrapRate * 100)}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
          
          {/* COSTOS TOTALES (EL GOLPE VISUAL) */}
          <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 text-center shadow-sm">
                  <h3 className="text-xs font-bold text-red-700 uppercase mb-1">Costo Total / Pieza (Competidor)</h3>
                  <p className="text-3xl font-black text-red-800">{formatCurrency(results.chinaCalc.totalCostPerPiece)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 text-center shadow-sm">
                  <h3 className="text-xs font-bold text-green-700 uppercase mb-1">Costo Total / Pieza (Nuestro)</h3>
                  <p className="text-3xl font-black text-green-800">{formatCurrency(results.premiumCalc.totalCostPerPiece)}</p>
              </div>
          </div>

          {/* CONCLUSIÓN TÉCNICA */}
          <div className="pt-4 border-t border-slate-300">
               <h2 className="text-lg font-bold text-blue-700 mb-3 uppercase tracking-wide">Conclusión Técnica</h2>
               <div className={`p-4 rounded-lg border-2 bg-slate-50 border-slate-300`}>
                  <p className="text-sm font-medium leading-relaxed text-slate-800 italic">
                    {results.argument}
                  </p>
               </div>
          </div>

          {/* FOOTER PEQUEÑO */}
          <div className="text-center pt-2 mt-auto">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Generado con Simulador de Competitividad • Secocut SRL</p>
          </div>

        </div>
      </div>

    </div>
  );
}
