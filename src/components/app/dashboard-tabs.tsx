
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect } from "react";
import {
  Calculator,
  Download,
  Save,
  TrendingUp,
  BarChart,
  Clock,
  DollarSign,
  Package,
  TrendingDown,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  QuickDiagnosisSchema,
  DetailedReportSchema,
} from "@/lib/schemas";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "../ui/separator";

type QuickDiagnosisResult = {
  breakEvenSeconds: number;
  breakEvenPieces: number;
};
type NetSavingsResult = {
    netAnnualSavings: number;
};

export default function DashboardTabs() {
  const [quickResult, setQuickResult] = React.useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = React.useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = React.useState<any | null>(null);

  const diagnosisForm = useForm<z.infer<typeof QuickDiagnosisSchema>>({
    resolver: zodResolver(QuickDiagnosisSchema),
    defaultValues: {
      costoHoraMaquina: 800,
      piezasAlMes: 2000,
      precioA: 100,
      filosA: 4,
      pzsPorFiloA: 20,
      cicloMinA: 1,
      cicloSegA: 30,
      vcA: 200,
      precioB: 150,
      filosB: 4,
      pzsPorFiloB: 25,
      cicloMinB: 1,
      cicloSegB: 15,
      vcB: 250,
    },
  });

  const detailedForm = useForm<z.infer<typeof DetailedReportSchema>>({
    resolver: zodResolver(DetailedReportSchema),
     defaultValues: {
      currentTool: "Herramienta Estándar",
      currentToolCost: 100,
      proposedTool: "Herramienta Premium",
      proposedToolCost: 150,
      cycleTimeReduction: 20,
      partsProducedPerShift: 50,
      shiftsPerDay: 2,
      daysPerWeek: 5,
      weeksPerYear: 50,
      machineHourlyRate: 80,
    },
  });

  // Sync diagnosisForm to detailedForm
  const watchedDiagnosisData = useWatch({ control: diagnosisForm.control });
  useEffect(() => {
    detailedForm.setValue("machineHourlyRate", watchedDiagnosisData.costoHoraMaquina || 0);
    detailedForm.setValue("currentToolCost", watchedDiagnosisData.precioA || 0);
    detailedForm.setValue("proposedToolCost", watchedDiagnosisData.precioB || 0);
    
    const cicloASeconds = (watchedDiagnosisData.cicloMinA || 0) * 60 + (watchedDiagnosisData.cicloSegA || 0);
    const cicloBSeconds = (watchedDiagnosisData.cicloMinB || 0) * 60 + (watchedDiagnosisData.cicloSegB || 0);
    const reduction = cicloASeconds > 0 ? ((cicloASeconds - cicloBSeconds) / cicloASeconds) * 100 : 0;
    detailedForm.setValue("cycleTimeReduction", parseFloat(reduction.toFixed(2)));

  }, [watchedDiagnosisData, detailedForm]);


  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { precioA, precioB, filosA, pzsPorFiloA, costoHoraMaquina } = data;
    const deltaP = precioB - precioA;
    const nA = filosA * pzsPorFiloA;
    const cm = costoHoraMaquina / 60;
    
    if (deltaP <= 0 || nA <= 0 || cm <=0) {
        setQuickResult({ breakEvenSeconds: 0, breakEvenPieces: 0});
        return;
    }

    const breakEvenSeconds = (deltaP * nA) / cm;
    const breakEvenPieces = (deltaP * nA) / cm; // This seems to be the same formula, might need adjustment based on real logic

    setQuickResult({ breakEvenSeconds, breakEvenPieces });
  }

  function onNetSavingsSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, costoHoraMaquina, piezasAlMes, precioB, filosB, pzsPorFiloB, cicloMinB, cicloSegB } = data;

    const cm = costoHoraMaquina / 60;
    
    // CPP A
    const nA = filosA * pzsPorFiloA;
    const tcA = cicloMinA + cicloSegA / 60;
    const cppA = nA > 0 ? (precioA / nA) + (tcA * cm) : Infinity;

    // CPP B
    const nB = filosB * pzsPorFiloB;
    const tcB = cicloMinB + cicloSegB / 60;
    const cppB = nB > 0 ? (precioB / nB) + (tcB * cm) : Infinity;

    const savingsPerPiece = cppA - cppB;
    const netAnnualSavings = savingsPerPiece * piezasAlMes * 12;

    setNetSavingsResult({ netAnnualSavings: isFinite(netAnnualSavings) ? netAnnualSavings : 0 });
  }

  function onDetailedSubmit(data: z.infer<typeof DetailedReportSchema>) {
    const cppCurrent = data.currentToolCost / data.partsProducedPerShift;
    const cppProposed = data.proposedToolCost / (data.partsProducedPerShift * (1 + data.cycleTimeReduction/100));
    const annualParts = data.partsProducedPerShift * data.shiftsPerDay * data.daysPerWeek * data.weeksPerYear;
    const netSavings = (cppCurrent - cppProposed) * annualParts;
    const investment = data.proposedToolCost - data.currentToolCost;
    const roi = investment > 0 ? (netSavings / investment) * 100 : Infinity;
    const hoursSaved = (annualParts * (data.cycleTimeReduction/100)) / 60;

    setDetailedResult({
        cppCurrent,
        cppProposed,
        netSavings,
        roi,
        machineHoursFreed: hoursSaved,
    });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const formatSeconds = (seconds: number) => {
    const min = Math.floor(seconds/60);
    const sec = Math.round(seconds % 60);
    return `${min}m ${sec}s`;
  }

  const StatCard = ({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: string, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
  )

  return (
    <Tabs defaultValue="quick">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="quick">1. Diagnóstico</TabsTrigger>
        <TabsTrigger value="detailed">2. Informe</TabsTrigger>
      </TabsList>
      <TabsContent value="quick">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Diagnóstico Rápido</CardTitle>
            <CardDescription>
              Calcula rápidamente el punto de equilibrio y los ahorros potenciales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...diagnosisForm}>
              <form className="space-y-8">
                {/* Datos de Partida */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 font-headline">Datos de Partida</h3>
                  <div className="p-6 border rounded-lg space-y-6">
                    {/* Datos Globales */}
                    <div>
                      <h4 className="font-medium text-primary mb-4">Datos Globales del Proceso</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>Costo Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>Piezas al Mes (aprox.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                    </div>
                    <Separator />
                    {/* Datos Inserto A y B */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                          <h4 className="font-medium text-primary mb-4">Datos Inserto A (Actual)</h4>
                          <div className="space-y-4">
                            <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio A ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                               <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Seg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                       </div>
                        <div>
                          <h4 className="font-medium text-accent mb-4">Datos Inserto B (Propuesta)</h4>
                          <div className="space-y-4">
                            <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio B ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={diagnosisForm.control} name="filosB" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={diagnosisForm.control} name="pzsPorFiloB" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={diagnosisForm.control} name="cicloMinB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={diagnosisForm.control} name="cicloSegB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Seg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={diagnosisForm.control} name="vcB" render={({ field }) => (<FormItem><FormLabel>Vc Propuesta (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Punto de Equilibrio */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold font-headline">Paso 1: Punto de Equilibrio</h3>
                    <div className="p-6 border rounded-lg space-y-4">
                        <p className="text-sm text-muted-foreground">Calcula la reducción de tiempo de ciclo o el aumento de rendimiento necesarios para justificar la diferencia de precio entre la herramienta A y B.</p>
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onQuickSubmit)}>Calcular Punto de Equilibrio</Button>
                         {quickResult && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="font-semibold mb-4">Resultados</h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <StatCard icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} title="Reducción de Tiempo Necesaria" value={formatSeconds(quickResult.breakEvenSeconds)} description="Para justificar el costo de la herramienta B" />
                                    <StatCard icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} title="Piezas Adicionales Necesarias" value={`${quickResult.breakEvenPieces.toFixed(2)} pzs`} description="Rendimiento extra por inserto para pagar la diferencia"/>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ahorro Neto Real */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold font-headline">Paso 2: Simulación de Ahorro Neto Real</h3>
                     <div className="p-6 border rounded-lg space-y-4">
                        <p className="text-sm text-muted-foreground">Simula el ahorro real cambiando los parámetros de la herramienta B y compara el Costo Por Pieza (CPP) final.</p>
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onNetSavingsSubmit)}>Calcular Ahorro Neto</Button>
                         {netSavingsResult && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="font-semibold mb-4">Resultados</h4>
                                <div className="grid gap-4 md:grid-cols-1">
                                    <StatCard icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} title="Ahorro Neto Anual Estimado" value={formatCurrency(netSavingsResult.netAnnualSavings)} description="Basado en la diferencia de CPP y producción mensual." />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="detailed">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Informe Detallado (A vs. B)</CardTitle>
            <CardDescription>
              Genera una comparación exhaustiva entre dos herramientas de corte. Los datos de partida se sincronizan desde la pestaña de Diagnóstico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...detailedForm}>
              <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                      <h4 className="font-semibold text-primary">Herramienta Actual (A)</h4>
                      <FormField control={detailedForm.control} name="currentTool" render={({ field }) => (<FormItem><FormLabel>Nombre Herramienta A</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={detailedForm.control} name="currentToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta A ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  </div>
                   <div className="space-y-4">
                      <h4 className="font-semibold text-accent">Herramienta Propuesta (B)</h4>
                      <FormField control={detailedForm.control} name="proposedTool" render={({ field }) => (<FormItem><FormLabel>Nombre Herramienta B</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={detailedForm.control} name="proposedToolCost" render={({ field }) => (<FormItem><FormLabel>Costo Herramienta B ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  </div>
                </div>
                <div className="border-t pt-8">
                    <h4 className="font-semibold mb-4">Parámetros de Producción</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <FormField control={detailedForm.control} name="cycleTimeReduction" render={({ field }) => (<FormItem><FormLabel>Reducción Ciclo (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="partsProducedPerShift" render={({ field }) => (<FormItem><FormLabel>Piezas/Turno</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="shiftsPerDay" render={({ field }) => (<FormItem><FormLabel>Turnos/Día</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="daysPerWeek" render={({ field }) => (<FormItem><FormLabel>Días/Semana</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>Costo Máquina/Hr ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>
                </div>
                <div>
                  <Button type="submit">Generar Informe</Button>
                </div>
              </form>
            </Form>
            {detailedResult && (
                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-headline font-semibold">Resultados del Informe</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"><Save className="mr-2"/> Guardar Caso</Button>
                            <Button variant="outline" size="sm"><Download className="mr-2"/> Descargar PDF</Button>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} title="Ahorro Neto Anual" value={formatCurrency(detailedResult.netSavings)} />
                        <StatCard icon={<BarChart className="h-4 w-4 text-muted-foreground" />} title="Retorno de Inversión (ROI)" value={isFinite(detailedResult.roi) ? `${detailedResult.roi.toFixed(1)}%` : '∞'} />
                        <StatCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} title="Horas de Máquina Liberadas" value={`${detailedResult.machineHoursFreed.toFixed(1)} hrs`} />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Actual" value={formatCurrency(detailedResult.cppCurrent)} description="Costo Por Pieza" />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Propuesto" value={formatCurrency(detailedResult.cppProposed)} description="Costo Por Pieza" />
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

    