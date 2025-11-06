
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState } from "react";
import {
  Download,
  Save,
  TrendingUp,
  BarChart,
  Clock,
  DollarSign,
  Package,
  TrendingDown,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";

type QuickDiagnosisResult = {
  breakEvenSeconds: number;
  breakEvenPieces: number;
  deltaP: number;
  tcA: number;
  vcBTarget: number;
  newCycleTimeTarget: number;
};
type NetSavingsResult = {
    netAnnualSavings: number;
    cppA: number;
    cppB: number;
    savingsPerPiece: number;
    improvementPercentage: number;
    newCycleTime: number;
    newToolLife: number;
};

export default function DashboardTabs() {
  const { toast } = useToast();
  const [quickResult, setQuickResult] = useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = useState<any | null>(null);

  const diagnosisForm = useForm<z.infer<typeof QuickDiagnosisSchema>>({
    resolver: zodResolver(QuickDiagnosisSchema),
    defaultValues: {
      costoHoraMaquina: 35,
      piezasAlMes: 2000,
      precioA: 100,
      filosA: 4,
      pzsPorFiloA: 20,
      cicloMinA: 1,
      cicloSegA: 30,
      vcA: 180,
      precioB: 150,
      piezasMasReales: 0,
      modoSimulacionTiempo: 'segundos',
      segundosMenosReales: 0,
      vcBReal: 0,
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
      machineHourlyRate: 35,
    },
  });

  const watchedDiagnosisData = useWatch({ control: diagnosisForm.control });

  // Sync diagnosisForm to detailedForm and other related fields
  useEffect(() => {
    // Sync to Detailed Report
    detailedForm.setValue("machineHourlyRate", watchedDiagnosisData.costoHoraMaquina || 0);
    detailedForm.setValue("currentToolCost", watchedDiagnosisData.precioA || 0);
    detailedForm.setValue("proposedToolCost", watchedDiagnosisData.precioB || 0);
    
    // Auto-fill Vc B Real if simulating by Vc and Vc A changes
    if (watchedDiagnosisData.modoSimulacionTiempo === 'vc' && watchedDiagnosisData.vcA) {
        diagnosisForm.setValue("vcBReal", watchedDiagnosisData.vcA);
    }

    const cicloASeconds = (watchedDiagnosisData.cicloMinA || 0) * 60 + (watchedDiagnosisData.cicloSegA || 0);
    
    let cicloBSeconds = 0;
    if (watchedDiagnosisData.modoSimulacionTiempo === 'segundos') {
        cicloBSeconds = cicloASeconds - (watchedDiagnosisData.segundosMenosReales || 0);
    } else if (watchedDiagnosisData.vcA && watchedDiagnosisData.vcBReal) {
        cicloBSeconds = cicloASeconds * (watchedDiagnosisData.vcA / watchedDiagnosisData.vcBReal);
    }
    
    const reduction = cicloASeconds > 0 ? ((cicloASeconds - cicloBSeconds) / cicloASeconds) * 100 : 0;
    detailedForm.setValue("cycleTimeReduction", parseFloat(reduction.toFixed(2)));

  }, [watchedDiagnosisData, detailedForm, diagnosisForm]);

  const parseTimeToMinutes = (min: number, sec: number) => {
    const minVal = min || 0;
    const secVal = sec || 0;
    return minVal + (secVal / 60);
  }

  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { precioA, precioB, filosA, pzsPorFiloA, costoHoraMaquina, cicloMinA, cicloSegA, vcA } = data;
    
    const nA = (filosA || 1) * (pzsPorFiloA || 1);
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const cm = (costoHoraMaquina || 0) / 60;
    const deltaP = (precioB || 0) - (precioA || 0);

    if (costoHoraMaquina <= 0 || precioA <= 0 || precioB <= 0 || nA <= 0 || tcA <= 0) {
        toast({ variant: "destructive", title: "Datos incompletos", description: "Por favor, complete todos los 'Datos de Partida' para el Paso 1." });
        return;
    }

    if (deltaP <= 0) {
      toast({ variant: "destructive", title: "Precio inválido", description: "El Precio B debe ser mayor que el Precio A para este cálculo." });
      return;
    }

    const nB_target = precioB * nA / precioA;
    const delta_N_filo = (nB_target / filosA) - pzsPorFiloA;
    
    const delta_t_min = deltaP / (nA * cm);
    const breakEvenSeconds = delta_t_min * 60;
    const tcB_target = tcA - delta_t_min;

    let vcBTarget = 0;
    if (vcA > 0 && tcB_target > 0) {
        vcBTarget = vcA * (tcA / tcB_target);
    }
    
    setQuickResult({
      breakEvenSeconds: breakEvenSeconds,
      breakEvenPieces: delta_N_filo,
      deltaP: deltaP,
      tcA: tcA,
      vcBTarget: vcBTarget,
      newCycleTimeTarget: tcB_target,
    });

    diagnosisForm.setValue('segundosMenosReales', breakEvenSeconds);
  }

  function onNetSavingsSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { costoHoraMaquina, piezasAlMes, precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, precioB, piezasMasReales, modoSimulacionTiempo, segundosMenosReales, vcA, vcBReal } = data;

    if (!costoHoraMaquina || !piezasAlMes || !precioA || !filosA || !pzsPorFiloA || (cicloMinA === undefined && cicloSegA === undefined) || !precioB ) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Por favor, complete todos los 'Datos de Partida'." });
      return;
    }
     if (piezasMasReales === 0 && segundosMenosReales === 0 && (modoSimulacionTiempo === 'vc' && vcBReal === 0)) {
      toast({ variant: "destructive", title: "Sin mejoras", description: "Ingrese una mejora (piezas o tiempo) para simular el ahorro." });
      return;
    }

    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const nA = filosA * pzsPorFiloA;
    const cm = costoHoraMaquina / 60;
    
    const costoHerrA = precioA / nA;
    const costoMaqA = tcA * cm;
    const cppA = costoHerrA + costoMaqA;

    let tcB_real_min = 0;
    if (modoSimulacionTiempo === 'segundos') {
        tcB_real_min = tcA - (segundosMenosReales / 60);
    } else { // modo 'vc'
        if (vcA <= 0 || vcBReal <= 0 || vcBReal === vcA) {
            toast({ variant: "destructive", title: "Vc inválida", description: "Ingrese una Vc Actual y una Nueva Vc (distinta) para simular." });
            return;
        }
        tcB_real_min = tcA * (vcA / vcBReal);
        diagnosisForm.setValue('segundosMenosReales', (tcA - tcB_real_min) * 60);
    }
     if (tcB_real_min <= 0) {
        toast({ variant: "destructive", title: "Tiempo de ciclo inválido", description: "El ahorro de segundos es mayor o igual al tiempo de ciclo actual." });
        return;
    }

    const nB_real = filosA * (pzsPorFiloA + piezasMasReales);
    const costoHerrB = precioB / nB_real;
    const costoMaqB = tcB_real_min * cm;
    const cppB = costoHerrB + costoMaqB;
    
    const savingsPerPiece = cppA - cppB;
    const netAnnualSavings = savingsPerPiece * piezasAlMes * 12;
    const improvementPercentage = (savingsPerPiece / cppA) * 100;
    
    setNetSavingsResult({
        netAnnualSavings: isFinite(netAnnualSavings) ? netAnnualSavings : 0,
        cppA,
        cppB,
        savingsPerPiece,
        improvementPercentage,
        newCycleTime: tcB_real_min,
        newToolLife: pzsPorFiloA + piezasMasReales,
    });

    // Sync to detailed report
    const newCicloMin = Math.floor(tcB_real_min);
    const newCicloSeg = Math.round((tcB_real_min - newCicloMin) * 60);
    detailedForm.setValue("proposedToolCost", precioB);
    
    diagnosisForm.setValue("cicloMinB", newCicloMin);
    diagnosisForm.setValue("cicloSegB", newCicloSeg);
    diagnosisForm.setValue("filosB", filosA); // Assume same number of edges
    diagnosisForm.setValue("pzsPorFiloB", pzsPorFiloA + piezasMasReales);
     if (modoSimulacionTiempo === 'vc') {
        diagnosisForm.setValue("vcB", vcBReal);
    }
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
   const formatMinutes = (timeInMinutes: number) => {
    const minutes = Math.floor(timeInMinutes);
    const seconds = Math.round((timeInMinutes - minutes) * 60);
    return `${minutes} min ${seconds} seg`;
  };

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

  const watchedSimTimeMode = useWatch({ control: diagnosisForm.control, name: 'modoSimulacionTiempo' });

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
                  <h3 className="text-lg font-semibold mb-4 font-headline text-blue-800">Datos de Partida</h3>
                  <div className="p-6 border border-blue-200 bg-blue-50/50 rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas al Mes (aprox.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="space-y-3">
                          <h4 className="font-medium text-primary mb-4">Datos Inserto A (Actual)</h4>
                            <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio A ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex space-x-2">
                               <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                             <div className="flex space-x-2">
                                <FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>Seg</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                        <div className="space-y-3">
                          <h4 className="font-medium text-accent mb-4">Datos Inserto B (Propuesta)</h4>
                            <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio B ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-8" />

                {/* Punto de Equilibrio */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold font-headline">Paso 1: ¿Cuánto <span className="text-primary">necesitamos</span> para justificar el costo?</h3>
                    <div className="p-6 border rounded-lg space-y-4">
                        <p className="text-sm text-muted-foreground">Calcula los objetivos mínimos (más piezas o menos tiempo) para compensar la diferencia de precio entre A y B.</p>
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onQuickSubmit)}>Calcular Punto de Equilibrio</Button>
                         {quickResult && (
                            <div className="mt-6 pt-6 border-t">
                                <h4 className="text-lg font-semibold text-gray-800 mb-4 text-center">🎯 Objetivos de Punto de Equilibrio</h4>
                                <p className="text-center text-gray-600 mb-6">Para justificar un costo extra de {formatCurrency(quickResult.deltaP)} por inserto, necesita lograr <strong>UNA</strong> de estas dos metas:</p>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <Card className="text-center">
                                      <CardHeader>
                                        <CardTitle>Opción 1: Mejorar Rendimiento</CardTitle>
                                        <CardDescription>(Mismo Tiempo de Ciclo: {formatMinutes(quickResult.tcA)})</CardDescription>
                                      </CardHeader>
                                      <CardContent>
                                        <p className="text-3xl font-bold text-primary">+{quickResult.breakEvenPieces.toFixed(1)} pzs/filo</p>
                                      </CardContent>
                                    </Card>
                                    <Card className="text-center">
                                      <CardHeader>
                                        <CardTitle>Opción 2: Mejorar Velocidad</CardTitle>
                                        <CardDescription>(Mismo Rendimiento)</CardDescription>
                                      </CardHeader>
                                      <CardContent>
                                        <p className="text-3xl font-bold text-primary">-{quickResult.breakEvenSeconds.toFixed(2)} seg/pieza</p>
                                        {quickResult.vcBTarget > 0 && (
                                            <p className="text-muted-foreground mt-1">
                                                (Nueva Vc: {quickResult.vcBTarget.toFixed(0)} m/min)
                                            </p>
                                        )}
                                      </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <Separator className="my-8" />
                
                {/* Ahorro Neto Real */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold font-headline">Paso 2: ¿Cuánto <span className="text-green-600">vamos a ahorrar</span> realmente?</h3>
                     <div className="p-6 border rounded-lg space-y-6">
                        <p className="text-sm text-muted-foreground">Simula el ahorro neto total basado en tu propuesta real de mejora (puedes mejorar rendimiento, tiempo, o ambos).</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <FormField control={diagnosisForm.control} name="piezasMasReales" render={({ field }) => (<FormItem><FormLabel>Piezas MÁS Reales por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField
                                control={diagnosisForm.control}
                                name="modoSimulacionTiempo"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Simular Ahorro de Tiempo Por:</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar modo" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="segundos">Segundos MENOS</SelectItem>
                                        <SelectItem value="vc">Nueva Vc (m/min)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div>
                                {watchedSimTimeMode === 'segundos' ? (
                                    <FormField control={diagnosisForm.control} name="segundosMenosReales" render={({ field }) => (<FormItem><FormLabel>Segundos MENOS Reales por Pieza</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                ) : (
                                    <FormField control={diagnosisForm.control} name="vcBReal" render={({ field }) => (<FormItem><FormLabel>Nueva Vc (B) (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                )}
                            </div>
                        </div>
                        
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onNetSavingsSubmit)} variant="default" className="bg-green-600 hover:bg-green-700">Calcular Ahorro Neto Real</Button>
                         
                         {netSavingsResult && (
                            <div className="mt-6 pt-6 border-t">
                                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">💸 Resultado de la Simulación Real</h3>
                                <div className="text-center mb-6">
                                    <span className="text-lg font-medium text-gray-700">AHORRO NETO ANUAL:</span>
                                    <div className={`text-5xl font-bold ${netSavingsResult.netAnnualSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netSavingsResult.netAnnualSavings)}</div>
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3 text-center">Desglose del Ahorro</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                    <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="Costo/Pieza Actual (A)" value={formatCurrency(netSavingsResult.cppA)} />
                                    <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="Nuevo Costo/Pieza (B)" value={formatCurrency(netSavingsResult.cppB)} />
                                    <StatCard icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} title="Ahorro Neto / Pieza" value={formatCurrency(netSavingsResult.savingsPerPiece)} />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3 text-center">Impacto en Producción</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                                    <StatCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} title="Nuevo Tiempo de Ciclo" value={formatMinutes(netSavingsResult.newCycleTime)} />
                                    <StatCard icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} title="Nuevo Rendimiento" value={`${netSavingsResult.newToolLife.toFixed(0)} pzs/filo`} />
                                </div>
                                 <div className="mt-4 p-4 bg-white border-2 border-green-600 rounded-lg text-center">
                                    <span className="block text-sm font-bold text-gray-700">MEJORA TOTAL DE PRODUCTIVIDAD</span>
                                    <span className={`text-3xl font-bold ${netSavingsResult.improvementPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {netSavingsResult.improvementPercentage.toFixed(1)}%
                                    </span>
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
