
"use client";

import React, { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SimulatorSchema } from "@/lib/schemas";
import * as z from "zod";
import { useSimulatorCalc } from "@/hooks/use-simulator-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, TrendingUp, AlertCircle, Download, Share2, Loader2, Wifi, WifiOff } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useUser, useDoc, useFirestore, useMemoFirebase, doc } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

import { useRouter } from "next/navigation";

export default function NewSimulatorPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [companyLogoBase64, setCompanyLogoBase64] = useState<string | null>(null);
  const [secoLogoBase64, setSecoLogoBase64] = useState<string | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && user) {
        if (!user.email?.endsWith('@secocut.com')) {
            router.replace('/history');
        }
    }
  }, [user, userLoading, router]);

  if (userLoading || (user && !user.email?.endsWith('@secocut.com'))) return null;

  // --- Hooks para data y estado de conexión ---
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc<any>(settingsRef);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setCompanyLogoBase64(localStorage.getItem('offline_company_logo'));
    setSecoLogoBase64(localStorage.getItem('offline_seco_logo'));
  }, []);

  useEffect(() => {
    const cacheLogo = async (url: string, storageKey: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          localStorage.setItem(storageKey, base64data);
          if (storageKey === 'offline_company_logo') setCompanyLogoBase64(base64data);
          if (storageKey === 'offline_seco_logo') setSecoLogoBase64(base64data);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error(`Failed to cache logo from ${url}:`, error);
      }
    };
    if (settings?.companyLogoUrl) {
      cacheLogo(settings.companyLogoUrl, 'offline_company_logo');
    }
    if (settings?.secoLogoUrl) {
      cacheLogo(settings.secoLogoUrl, 'offline_seco_logo');
    }
  }, [settings]);


  const form = useForm<z.infer<typeof SimulatorSchema>>({
    resolver: zodResolver(SimulatorSchema),
    defaultValues: {
      clientName: "",
      machineUsdPerHour: "" as any,
      toolChangeMin: "" as any,
      scrapCostUsdPerPiece: "" as any,
      china: { priceUsd: "" as any, pcsPerEdge: "" as any, cycleMin: "" as any, cycleSec: "" as any, pcsBetweenChanges: "" as any, scrapRate: "" as any },
      premium: { priceUsd: "" as any, pcsPerEdge: "" as any, cycleMin: "" as any, cycleSec: "" as any, pcsBetweenChanges: "" as any, scrapRate: "" as any },
    },
  });

  const chinaVals = useWatch({ control: form.control, name: "china" });
  const premiumVals = useWatch({ control: form.control, name: "premium" });
  const machineUsdPerHour = useWatch({ control: form.control, name: "machineUsdPerHour" });
  const toolChangeMin = useWatch({ control: form.control, name: "toolChangeMin" });
  const scrapCostUsdPerPiece = useWatch({ control: form.control, name: "scrapCostUsdPerPiece" });

  const results = useSimulatorCalc(
    chinaVals,
    premiumVals,
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
            margin:       0,
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
    const { chinaCalc, premiumCalc } = results;
    const ahorroAbsoluto = chinaCalc.totalCostPerPiece - premiumCalc.totalCostPerPiece;
    const porcentajeVisual = results.competitivenessIndex > 0 ? ((1 - results.competitivenessIndex) * 100).toFixed(1) : "0.0";
    
    const message = `Hola, te comparto el análisis de competitividad para el proceso de mecanizado:

📊 *RESUMEN DE COSTO POR PIEZA*

🔴 *Competidor:* ${formatCurrency(results.chinaCalc.totalCostPerPiece)}
├ Herramienta: ${formatCurrency(results.chinaCalc.insertCostPerPiece)}
├ Máquina: ${formatCurrency(results.chinaCalc.machineCostPerPiece)}
├ Paradas: ${formatCurrency(results.chinaCalc.changeCostPerPiece)}
└ Scrap: ${formatCurrency(results.chinaCalc.scrapCostPerPiece)}

🟢 *Nuestro Inserto:* ${formatCurrency(results.premiumCalc.totalCostPerPiece)}
├ Herramienta: ${formatCurrency(results.premiumCalc.insertCostPerPiece)}
├ Máquina: ${formatCurrency(results.premiumCalc.machineCostPerPiece)}
├ Paradas: ${formatCurrency(results.premiumCalc.changeCostPerPiece)}
└ Scrap: ${formatCurrency(results.premiumCalc.scrapCostPerPiece)}

💡 *AHORRO NETO:* ${formatCurrency(ahorroAbsoluto)} por pieza (${porcentajeVisual}%)

${results.trafficLight === 'green' ? '✅ El inserto premium es indiscutiblemente superior y reduce el costo real del proceso.' : '⚠️ Revisemos juntos estos números.'}

Adjunto el informe PDF completo con el fundamento técnico.`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const onSubmit = async (data: z.infer<typeof SimulatorSchema>) => {
    if (!navigator.onLine) {
        setIsSaving(true);
        try {
            const offlineSims = JSON.parse(localStorage.getItem('offline_simulations') || '[]');
            const newSimulation = {
                formData: data,
                results: results,
                savedAt: new Date().toISOString(),
                clientName: form.getValues('clientName')
            };
            offlineSims.push(newSimulation);
            localStorage.setItem('offline_simulations', JSON.stringify(offlineSims));
            toast({
                title: "Modo Offline",
                description: "Simulación guardada localmente. Se sincronizará cuando vuelvas a tener conexión.",
            });
        } catch (error) {
            console.error("Error guardando simulación offline:", error);
            toast({ variant: 'destructive', title: "Error", description: "No se pudo guardar la simulación localmente." });
        } finally {
            setIsSaving(false);
        }
        return;
    }

    if (!user) {
        toast({ variant: 'destructive', title: "Error", description: "Debes iniciar sesión para guardar la simulación." });
        return;
    }

    setIsSaving(true);
    try {
      if (!firestore) throw new Error("Firestore no está disponible");
      
      const simulationData = {
        userId: user.uid,
        clientName: data.clientName || "Sin Cliente",
        date: serverTimestamp(),
        results: results,
        inputs: data,
      };

      await addDoc(collection(firestore, "simulations"), simulationData);

      toast({ title: "Simulación Guardada", description: "La simulación ha sido guardada en el historial." });
      form.reset();
    } catch (error: any) {
      console.error("Error guardando en Firebase:", error);
      toast({ variant: 'destructive', title: "Error al Guardar", description: error.message || "No se pudo guardar la simulación online." });
    } finally {
      setIsSaving(false);
    }
  };

  const trafficColors = {
    green: "bg-green-100 border-green-500 text-green-900",
    yellow: "bg-yellow-100 border-yellow-500 text-yellow-900",
    red: "bg-red-100 border-red-500 text-red-900",
  };
  
  const formValuesForPdf = form.getValues();
  const ahorroAbsoluto = results.chinaCalc.totalCostPerPiece - results.premiumCalc.totalCostPerPiece;
  const porcentajeVisual = results.competitivenessIndex > 0 ? ((1 - results.competitivenessIndex) * 100).toFixed(1) : "0.0";

  const companyLogoSrc = isOnline ? settings?.companyLogoUrl : companyLogoBase64;
  const secoLogoSrc = isOnline ? settings?.secoLogoUrl : secoLogoBase64;

  return (
    <div className="min-h-screen bg-slate-50">
      <div id="simulator-content" className="max-w-2xl mx-auto p-4">
        
        <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm py-4 border-b shadow-sm mb-6">
            <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
                {companyLogoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={companyLogoSrc} alt="Secocut Logo" className="h-8 w-auto mr-3" crossOrigin="anonymous" />
                ) : (
                    <div className="h-8 w-16 mr-3" />
                )}
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">SIMULADOR</h1>
                <div className="ml-4">
                    {isOnline ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold bg-green-100 px-2 py-1 rounded-full">
                            <Wifi className="h-4 w-4" /> Online
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                            <WifiOff className="h-4 w-4" /> Modo Offline
                        </span>
                    )}
                </div>
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

            <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3">
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
                    {results.argument || "Complete los campos para iniciar el cálculo."}
                </p>
                </div>
            </div>
        </div>

        <Form {...form}>
          <form className="space-y-6 mt-6 max-w-2xl mx-auto p-4 pt-0">
            
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 bg-slate-100 border-b border-slate-200">
                <CardTitle className="text-sm font-bold uppercase text-slate-600">Datos del Proceso</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Cliente</FormLabel><FormControl><Input placeholder="Ej: Metalúrgica Roma" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="machineUsdPerHour" render={({ field }) => (
                  <FormItem><FormLabel>Costo Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="toolChangeMin" render={({ field }) => (
                  <FormItem><FormLabel>Tiempo Cambio Herramienta (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="scrapCostUsdPerPiece" render={({ field }) => (
                  <FormItem><FormLabel>Costo por Pieza Scrap (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              
              <Card className="border-slate-300 shadow-sm overflow-hidden">
                <div className="bg-slate-200 p-2 text-center border-b border-slate-300">
                  <span className="text-xs font-black uppercase text-slate-600 tracking-wider">Competidor</span>
                </div>
                <CardContent className="p-3 space-y-3 bg-slate-50">
                  <FormField control={form.control} name="china.priceUsd" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Precio Inserto</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.pcsPerEdge" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Piezas / Filo</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                  )} />
                  
                  <FormItem>
                      <FormLabel className="text-[10px] uppercase">Ciclo (Min/Seg)</FormLabel>
                      <div className="flex items-center gap-2">
                          <FormField control={form.control} name="china.cycleMin" render={({ field }) => (
                              <FormItem className="flex-1">
                                  <FormControl><Input type="number" placeholder="Min" className="h-8 text-sm" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                          <FormField control={form.control} name="china.cycleSec" render={({ field }) => (
                              <FormItem className="flex-1">
                                  <FormControl><Input type="number" placeholder="Seg" className="h-8 text-sm" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>
                  </FormItem>
                  
                  <FormField control={form.control} name="china.pcsBetweenChanges" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Pzs entre Cambios</FormLabel><FormControl><Input type="number" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="china.scrapRate" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase">Tasa Scrap (0 a 1)</FormLabel><FormControl><Input type="number" className="h-8 text-sm" step="0.01" {...field} /></FormControl><p className="text-[9px] text-slate-400">Ej: 0.05 = 5%</p></FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card className="border-blue-300 shadow-sm overflow-hidden">
                <div className="bg-blue-600 p-2 text-center border-b border-blue-700">
                  <span className="text-xs font-black uppercase text-white tracking-wider">Nuestro Inserto</span>
                </div>
                <CardContent className="p-3 space-y-3 bg-blue-50/30">
                  <FormField control={form.control} name="premium.priceUsd" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Precio Inserto</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.pcsPerEdge" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Piezas / Filo</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} /></FormControl></FormItem>
                  )} />
                  
                  <FormItem>
                      <FormLabel className="text-[10px] uppercase text-blue-900">Ciclo (Min/Seg)</FormLabel>
                      <div className="flex items-center gap-2">
                          <FormField control={form.control} name="premium.cycleMin" render={({ field }) => (
                              <FormItem className="flex-1">
                                  <FormControl><Input type="number" placeholder="Min" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                          <FormField control={form.control} name="premium.cycleSec" render={({ field }) => (
                              <FormItem className="flex-1">
                                  <FormControl><Input type="number" placeholder="Seg" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>
                  </FormItem>
                  
                  <FormField control={form.control} name="premium.pcsBetweenChanges" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Pzs entre Cambios</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="premium.scrapRate" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase text-blue-900">Tasa Scrap (0 a 1)</FormLabel><FormControl><Input type="number" className="h-8 text-sm border-blue-300 focus-visible:ring-blue-500" step="0.01" {...field} /></FormControl><p className="text-[9px] text-blue-400">Ej: 0.01 = 1%</p></FormItem>
                  )} />
                </CardContent>
              </Card>

            </div>
          </form>
        </Form>
      </div>

      <div className="absolute top-0 left-0 opacity-0 pointer-events-none -z-50 overflow-hidden h-0 w-0">
        <div id="pdf-report-template" className="w-[210mm] h-[290mm] bg-white text-black p-8 font-sans box-border flex flex-col justify-between overflow-hidden">
          
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-4">
              {companyLogoSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogoSrc} alt="Secocut Logo" className="h-12 w-auto object-contain" crossOrigin="anonymous" />
              )}
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Informe de Competitividad</h1>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">Secocut SRL</p>
              </div>
            </div>
             <div className="flex justify-end">
                {secoLogoSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={secoLogoSrc} alt="Seco Logo" className="h-10 w-auto object-contain" crossOrigin="anonymous" />
                )}
            </div>
          </div>

          <div className="mb-2">
              <h2 className="text-lg font-bold text-blue-700 mb-2 uppercase tracking-wide">Datos del Proceso</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p><span className="font-semibold text-slate-600">Cliente:</span> {formValuesForPdf.clientName || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-600">Costo Hora-Máquina:</span> {formatCurrency(Number(formValuesForPdf.machineUsdPerHour))}</p>
                  <p><span className="font-semibold text-slate-600">Tiempo Cambio Herr.:</span> {formValuesForPdf.toolChangeMin} min</p>
                  <p><span className="font-semibold text-slate-600">Costo Pieza Scrap:</span> {formatCurrency(Number(formValuesForPdf.scrapCostUsdPerPiece))}</p>
              </div>
          </div>

          <div className="mb-2">
              <h2 className="text-lg font-bold text-blue-700 mb-2 uppercase tracking-wide">Tabla Comparativa</h2>
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
                          <td className="p-2 border-b border-slate-200 text-center">{formatCurrency(Number(formValuesForPdf.china.priceUsd))}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatCurrency(Number(formValuesForPdf.premium.priceUsd))}</td>
                      </tr>
                      <tr>
                          <td className="p-2 border-b border-slate-200 font-medium">Piezas / Filo</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.china.pcsPerEdge}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formValuesForPdf.premium.pcsPerEdge}</td>
                      </tr>
                      <tr className="bg-slate-100">
                          <td className="p-2 border-b border-slate-200 font-medium">Ciclo (min/pza)</td>
                          <td className="p-2 border-b border-slate-200 text-center">{`${formValuesForPdf.china.cycleMin || 0}m ${formValuesForPdf.china.cycleSec || 0}s`}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{`${formValuesForPdf.premium.cycleMin || 0}m ${formValuesForPdf.premium.cycleSec || 0}s`}</td>
                      </tr>
                      <tr>
                          <td className="p-2 border-b border-slate-200 font-medium">Tasa de Scrap</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatPercent(Number(formValuesForPdf.china.scrapRate) * 100)}</td>
                          <td className="p-2 border-b border-slate-200 text-center">{formatPercent(Number(formValuesForPdf.premium.scrapRate) * 100)}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="p-3 bg-red-50 rounded-lg border-2 border-red-200 shadow-sm flex flex-col justify-between">
                  <div className="text-center mb-2">
                      <h3 className="text-xs font-bold text-red-700 uppercase mb-1">Costo Total / Pieza (Competidor)</h3>
                      <p className="text-3xl font-black text-red-800">{formatCurrency(results.chinaCalc.totalCostPerPiece)}</p>
                  </div>
                  <div className="border-t border-red-200 pt-2 text-[10px] text-red-900 space-y-1 font-medium">
                      <div className="flex justify-between"><span>🛠️ Herramienta:</span> <span>{formatCurrency(results.chinaCalc.insertCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>⚙️ Máquina:</span> <span>{formatCurrency(results.chinaCalc.machineCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>⏱️ Parada (Cambio):</span> <span>{formatCurrency(results.chinaCalc.changeCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>🗑️ Scrap (Rechazo):</span> <span>{formatCurrency(results.chinaCalc.scrapCostPerPiece)}</span></div>
                  </div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200 shadow-sm flex flex-col justify-between">
                  <div className="text-center mb-2">
                      <h3 className="text-xs font-bold text-green-700 uppercase mb-1">Costo Total / Pieza (Nuestro)</h3>
                      <p className="text-3xl font-black text-green-800">{formatCurrency(results.premiumCalc.totalCostPerPiece)}</p>
                  </div>
                  <div className="border-t border-green-200 pt-2 text-[10px] text-green-900 space-y-1 font-medium">
                      <div className="flex justify-between"><span>🛠️ Herramienta:</span> <span>{formatCurrency(results.premiumCalc.insertCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>⚙️ Máquina:</span> <span>{formatCurrency(results.premiumCalc.machineCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>⏱️ Parada (Cambio):</span> <span>{formatCurrency(results.premiumCalc.changeCostPerPiece)}</span></div>
                      <div className="flex justify-between"><span>🗑️ Scrap (Rechazo):</span> <span>{formatCurrency(results.premiumCalc.scrapCostPerPiece)}</span></div>
                  </div>
              </div>
          </div>
          
          {results.trafficLight === 'green' && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-800">
                <h3 className="font-bold mb-2 uppercase tracking-wide text-blue-800 text-xs">Desglose del Ahorro</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="font-semibold text-blue-900 mb-1 text-xs">1. Ahorro neto por pieza:</p>
                        <p className="font-mono bg-white inline-block px-2 py-1 rounded border border-blue-100 text-[10px]">
                            {formatCurrency(results.chinaCalc.totalCostPerPiece)} - {formatCurrency(results.premiumCalc.totalCostPerPiece)} = <span className="font-bold text-green-700">{formatCurrency(ahorroAbsoluto)}</span>
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-blue-900 mb-1 text-xs">2. Impacto porcentual:</p>
                        <p className="font-mono bg-white inline-block px-2 py-1 rounded border border-blue-100 text-[10px]">
                            {formatCurrency(ahorroAbsoluto)} / {formatCurrency(results.chinaCalc.totalCostPerPiece)} = <span className="font-bold text-green-700">{porcentajeVisual}%</span>
                        </p>
                    </div>
                </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-300 mt-2">
               <h2 className="text-lg font-bold text-blue-700 mb-2 uppercase tracking-wide">Conclusión Técnica</h2>
               <div className={`p-3 rounded-lg border bg-slate-50 border-slate-300`}>
                  <p className="text-sm font-medium leading-normal text-slate-800 italic">
                    {results.argument || "Complete los campos para generar una conclusión."}
                  </p>
               </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-300 text-slate-600 text-[10px] leading-tight">
            <h4 className="font-bold text-slate-800 uppercase mb-1">Fundamento Técnico del Cálculo de Costos</h4>
            <p className="mb-1">En la industria del mecanizado, el precio de compra del inserto representa típicamente menos del <strong>5% del costo total</strong> de producción. El verdadero gasto (95%) radica en el tiempo de máquina, las paradas y el descarte de piezas.</p>
            <ul className="list-disc pl-4 space-y-1 mb-1">
                <li><strong>Optimización del Ciclo (Hora-Máquina):</strong> Herramientas de alto rendimiento permiten mayores parámetros de corte. Reducir segundos en el ciclo diluye el costo fijo de la máquina.</li>
                <li><strong>Reducción de Tiempos Muertos:</strong> Una mayor vida útil (Piezas/Filo) disminuye drásticamente las paradas de máquina para rotar o cambiar herramientas.</li>
                <li><strong>Seguridad del Proceso:</strong> La estabilidad del inserto premium minimiza la rotura imprevista (Scrap), salvando material costoso y tiempo de retrabajo.</li>
            </ul>
            <p className="font-semibold italic text-slate-700">Invertir en tecnología de corte premium es la forma más rápida de aumentar la capacidad productiva de la planta y reducir el costo unitario sin comprar máquinas nuevas.</p>
          </div>

          <div className="text-center pt-3 mt-auto">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Generado con Simulador de Competitividad • Secocut SRL</p>
          </div>

        </div>
      </div>

    </div>
  );
}

    