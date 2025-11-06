
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState, useCallback } from "react";
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
import { Textarea } from "../ui/textarea";

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
type DetailedReportResult = {
    cppA: number;
    cppB: number;
    netSavings: number;
    roi: number;
    machineHoursFreed: number;
};

export default function DashboardTabs() {
  const { toast } = useToast();
  const [quickResult, setQuickResult] = useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedReportResult | null>(null);

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
      cliente: "",
      fecha: new Date().toISOString().split('T')[0],
      contacto: "",
      operacion: "",
      pieza: "",
      machineHourlyRate: 35,
      piezasAlMes: 2000,
      tiempoParada: 2,
      descA: "Herramienta Actual",
      precioA: 100,
      filosA: 4,
      cicloMinA: 1,
      cicloSegA: 30,
      vcA: 180,
      modoVidaA: 'piezas',
      piezasFiloA: 20,
      minutosFiloA: 0,
      notasA: "",
      descB: "Herramienta Propuesta",
      precioB: 150,
      filosB: 4,
      cicloMinB: 1,
      cicloSegB: 30,
      vcB: 180,
      modoVidaB: 'piezas',
      piezasFiloB: 20,
      minutosFiloB: 0,
      notasB: "",
    },
  });

  const watchedDiagnosisData = useWatch({ control: diagnosisForm.control });
  const watchedDetailedData = useWatch({ control: detailedForm.control });

  const parseTimeToMinutes = (min: number | undefined, sec: number | undefined) => {
    const minVal = min || 0;
    const secVal = sec || 0;
    return minVal + (secVal / 60);
  }

  // Sync Diagnosis -> Detailed
  useEffect(() => {
    const { costoHoraMaquina, piezasAlMes, precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, vcA, precioB } = watchedDiagnosisData;
    const detailedValues = detailedForm.getValues();

    if (detailedValues.machineHourlyRate !== costoHoraMaquina) detailedForm.setValue("machineHourlyRate", costoHoraMaquina || 0);
    if (detailedValues.piezasAlMes !== piezasAlMes) detailedForm.setValue("piezasAlMes", piezasAlMes || 0);
    if (detailedValues.precioA !== precioA) detailedForm.setValue("precioA", precioA || 0);
    if (detailedValues.filosA !== filosA) detailedForm.setValue("filosA", filosA || 0);
    if (detailedValues.piezasFiloA !== pzsPorFiloA) detailedForm.setValue("piezasFiloA", pzsPorFiloA || 0);
    if (detailedValues.cicloMinA !== cicloMinA) detailedForm.setValue("cicloMinA", cicloMinA || 0);
    if (detailedValues.cicloSegA !== cicloSegA) detailedForm.setValue("cicloSegA", cicloSegA || 0);
    if (detailedValues.vcA !== vcA) detailedForm.setValue("vcA", vcA || 0);
    if (detailedValues.precioB !== precioB) detailedForm.setValue("precioB", precioB || 0);
  }, [watchedDiagnosisData, detailedForm]);

  // Sync Detailed -> Diagnosis
  useEffect(() => {
    const { machineHourlyRate, piezasAlMes, precioA, filosA, piezasFiloA, cicloMinA, cicloSegA, vcA, precioB } = watchedDetailedData;
    const diagnosisValues = diagnosisForm.getValues();

    if (diagnosisValues.costoHoraMaquina !== machineHourlyRate) diagnosisForm.setValue("costoHoraMaquina", machineHourlyRate || 0);
    if (diagnosisValues.piezasAlMes !== piezasAlMes) diagnosisForm.setValue("piezasAlMes", piezasAlMes || 0);
    if (diagnosisValues.precioA !== precioA) diagnosisForm.setValue("precioA", precioA || 0);
    if (diagnosisValues.filosA !== filosA) diagnosisForm.setValue("filosA", filosA || 0);
    if (diagnosisValues.pzsPorFiloA !== piezasFiloA) diagnosisForm.setValue("pzsPorFiloA", piezasFiloA || 0);
    if (diagnosisValues.cicloMinA !== cicloMinA) diagnosisForm.setValue("cicloMinA", cicloMinA || 0);
    if (diagnosisValues.cicloSegA !== cicloSegA) diagnosisForm.setValue("cicloSegA", cicloSegA || 0);
    if (diagnosisValues.vcA !== vcA) diagnosisForm.setValue("vcA", vcA || 0);
    if (diagnosisValues.precioB !== precioB) diagnosisForm.setValue("precioB", precioB || 0);
  }, [watchedDetailedData, diagnosisForm]);


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
    let actualVcB = vcBReal || 0;

    if (modoSimulacionTiempo === 'segundos') {
        tcB_real_min = tcA - ((segundosMenosReales || 0) / 60);
         if ((vcA || 0) > 0 && tcB_real_min > 0) {
            actualVcB = (vcA || 0) * (tcA / tcB_real_min);
            diagnosisForm.setValue('vcBReal', actualVcB);
        }
    } else { // modo 'vc'
        if ((vcA || 0) <= 0 || (vcBReal || 0) <= 0 || vcBReal === vcA) {
            toast({ variant: "destructive", title: "Vc inválida", description: "Ingrese una Vc Actual y una Nueva Vc (distinta) para simular." });
            return;
        }
        tcB_real_min = tcA * ((vcA || 0) / (vcBReal || 1));
        diagnosisForm.setValue('segundosMenosReales', (tcA - tcB_real_min) * 60);
    }
     if (tcB_real_min <= 0) {
        toast({ variant: "destructive", title: "Tiempo de ciclo inválido", description: "El ahorro de segundos es mayor o igual al tiempo de ciclo actual." });
        return;
    }

    const nB_real = (filosA || 1) * ((pzsPorFiloA || 0) + (piezasMasReales || 0));
    const costoHerrB = (precioB || 0) / nB_real;
    const costoMaqB = tcB_real_min * cm;
    const cppB = costoHerrB + costoMaqB;
    
    const savingsPerPiece = cppA - cppB;
    const netAnnualSavings = savingsPerPiece * (piezasAlMes || 0) * 12;
    const improvementPercentage = cppA > 0 ? (savingsPerPiece / cppA) * 100 : 0;
    
    setNetSavingsResult({
        netAnnualSavings: isFinite(netAnnualSavings) ? netAnnualSavings : 0,
        cppA,
        cppB,
        savingsPerPiece,
        improvementPercentage,
        newCycleTime: tcB_real_min,
        newToolLife: (pzsPorFiloA || 0) + (piezasMasReales || 0),
    });

    const newCicloMin = Math.floor(tcB_real_min);
    const newCicloSeg = Math.round((tcB_real_min - newCicloMin) * 60);

    detailedForm.setValue("cicloMinB", newCicloMin);
    detailedForm.setValue("cicloSegB", newCicloSeg);
    detailedForm.setValue("piezasFiloB", (pzsPorFiloA || 0) + (piezasMasReales || 0));
    detailedForm.setValue("vcB", actualVcB);
    detailedForm.setValue("filosB", filosA || 4);
    detailedForm.setValue("modoVidaB", "piezas");
  }

  function onDetailedSubmit(data: z.infer<typeof DetailedReportSchema>) {
    const { machineHourlyRate, piezasAlMes, tiempoParada } = data;
    const costoMin = machineHourlyRate / 60;

    // Tool A calculations
    const tcA = parseTimeToMinutes(data.cicloMinA, data.cicloSegA);
    let piezasFiloA = data.piezasFiloA || 0;
    if (data.modoVidaA === 'minutos' && tcA > 0) {
        piezasFiloA = (data.minutosFiloA || 0) / tcA;
    }
    const piezasTotalA = (data.filosA || 1) * piezasFiloA;
    const costoHerramientaA = piezasTotalA > 0 ? (data.precioA || 0) / piezasTotalA : 0;
    const costoParadaA = piezasFiloA > 0 ? ((tiempoParada || 0) * costoMin) / piezasFiloA : 0;
    const costoMaquinaA = (tcA * costoMin) + costoParadaA;
    const cppA = costoHerramientaA + costoMaquinaA;

    // Tool B calculations
    const tcB = parseTimeToMinutes(data.cicloMinB, data.cicloSegB);
    let piezasFiloB = data.piezasFiloB || 0;
    if (data.modoVidaB === 'minutos' && tcB > 0) {
        piezasFiloB = (data.minutosFiloB || 0) / tcB;
    }
    const piezasTotalB = (data.filosB || 1) * piezasFiloB;
    const costoHerramientaB = piezasTotalB > 0 ? (data.precioB || 0) / piezasTotalB : 0;
    const costoParadaB = piezasFiloB > 0 ? ((tiempoParada || 0) * costoMin) / piezasFiloB : 0;
    const costoMaquinaB = (tcB * costoMin) + costoParadaB;
    const cppB = costoHerramientaB + costoMaquinaB;
    
    // Final calculations
    const ahorroPorPieza = cppA - cppB;
    const netSavings = ahorroPorPieza * (piezasAlMes || 0) * 12;
    
    const investment = (data.precioB || 0) - (data.precioA || 0);
    const roi = investment > 0 ? (netSavings / investment) * 100 : Infinity;
    
    const tiempoAhorradoPorPiezaMin = tcA - tcB;
    const annualParts = (piezasAlMes || 0) * 12;
    const hoursSaved = (annualParts * tiempoAhorradoPorPiezaMin) / 60;

    setDetailedResult({
        cppA,
        cppB,
        netSavings,
        roi,
        machineHoursFreed: hoursSaved,
    });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
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
  const watchedModoVidaA = useWatch({ control: detailedForm.control, name: 'modoVidaA' });
  const watchedModoVidaB = useWatch({ control: detailedForm.control, name: 'modoVidaB' });

  return (
    <Tabs defaultValue="quick" className="w-full">
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
                <div>
                  <h3 className="text-lg font-semibold mb-4 font-headline text-blue-800">Datos de Partida</h3>
                  <div className="p-6 border border-blue-200 bg-blue-50/50 rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas al Mes (aprox.)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="space-y-3">
                          <h4 className="font-medium text-primary mb-4">Datos Inserto A (Actual)</h4>
                            <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio A ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex space-x-2">
                               <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                             <div className="flex space-x-2">
                                <FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>Seg</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                        <div className="space-y-3">
                          <h4 className="font-medium text-accent mb-4">Datos Inserto B (Propuesta)</h4>
                            <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio B ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-8" />

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
                
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold font-headline">Paso 2: ¿Cuánto <span className="text-green-600">vamos a ahorrar</span> realmente?</h3>
                     <div className="p-6 border rounded-lg space-y-6">
                        <p className="text-sm text-muted-foreground">Simula el ahorro neto total basado en tu propuesta real de mejora (puedes mejorar rendimiento, tiempo, o ambos).</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <FormField control={diagnosisForm.control} name="piezasMasReales" render={({ field }) => (<FormItem><FormLabel>Piezas MÁS Reales por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
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
                                    <FormField control={diagnosisForm.control} name="segundosMenosReales" render={({ field }) => (<FormItem><FormLabel>Segundos MENOS Reales por Pieza</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                                ) : (
                                    <FormField control={diagnosisForm.control} name="vcBReal" render={({ field }) => (<FormItem><FormLabel>Nueva Vc (B) (m/min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
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
              Genera una comparación exhaustiva entre dos herramientas de corte. Los datos se sincronizan desde la pestaña de Diagnóstico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...detailedForm}>
              <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-8">
                
                {/* Datos del Informe */}
                <div className="p-6 bg-white rounded-lg shadow-md border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Datos del Informe</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <FormField control={detailedForm.control} name="cliente" render={({ field }) => (<FormItem><FormLabel>Cliente</FormLabel><FormControl><Input placeholder="Nombre del Cliente" {...field} /></FormControl></FormItem>)}/>
                        <FormField control={detailedForm.control} name="fecha" render={({ field }) => (<FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
                        <FormField control={detailedForm.control} name="contacto" render={({ field }) => (<FormItem><FormLabel>Contacto</FormLabel><FormControl><Input placeholder="Persona de Contacto" {...field} /></FormControl></FormItem>)}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={detailedForm.control} name="operacion" render={({ field }) => (<FormItem><FormLabel>Operación</FormLabel><FormControl><Input placeholder="Ej: Fresado Frontal" {...field} /></FormControl></FormItem>)}/>
                        <FormField control={detailedForm.control} name="pieza" render={({ field }) => (<FormItem><FormLabel>Nombre de la Pieza</FormLabel><FormControl><Input placeholder="Ej: Soporte Motor" {...field} /></FormControl></FormItem>)}/>
                    </div>
                </div>

                {/* Datos Generales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo de Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                    <FormField control={detailedForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas/Mes</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                    <FormField control={detailedForm.control} name="tiempoParada" render={({ field }) => (<FormItem><FormLabel>⏱️ Parada por Cambio (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                </div>

                {/* Comparativa A vs B */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Herramienta A */}
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-destructive text-destructive-foreground p-4">
                            <CardTitle>Inserto A (Actual)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 pt-6">
                            <FormField control={detailedForm.control} name="descA" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de 4 filos..." {...field} /></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio de Compra ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Cant. de Filos</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="modoVidaA" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                            {watchedModoVidaA === 'piezas' ? (
                                <FormField control={detailedForm.control} name="piezasFiloA" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            ) : (
                                <FormField control={detailedForm.control} name="minutosFiloA" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            )}
                            <div className="flex space-x-2">
                                <FormField control={detailedForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            </div>
                            <FormField control={detailedForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="notasA" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                        </CardContent>
                    </Card>
                    {/* Herramienta B */}
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-green-600 text-white p-4">
                            <CardTitle>Inserto B (Propuesta)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 pt-6">
                            <FormField control={detailedForm.control} name="descB" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de alta vel..." {...field} /></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio de Compra ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="filosB" render={({ field }) => (<FormItem><FormLabel>Cant. de Filos</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="modoVidaB" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                            {watchedModoVidaB === 'piezas' ? (
                                <FormField control={detailedForm.control} name="piezasFiloB" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            ) : (
                                <FormField control={detailedForm.control} name="minutosFiloB" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            )}
                            <div className="flex space-x-2">
                                <FormField control={detailedForm.control} name="cicloMinB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="cicloSegB" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            </div>
                            <FormField control={detailedForm.control} name="vcB" render={({ field }) => (<FormItem><FormLabel>Vc Propuesta (m/min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                            <FormField control={detailedForm.control} name="notasB" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button type="submit">Generar Informe</Button>
                  <Button type="button" variant="secondary"><Download className="mr-2 h-4 w-4" />Imprimir / Guardar PDF</Button>
                </div>
              </form>
            </Form>

            {detailedResult && (
                <div className="mt-8 pt-6 border-t">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-headline font-semibold">Resultados del Informe</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"><Save className="mr-2 h-4 w-4"/> Guardar Caso</Button>
                            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/> Descargar PDF</Button>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} title="Ahorro Neto Anual" value={formatCurrency(detailedResult.netSavings)} />
                        <StatCard icon={<BarChart className="h-4 w-4 text-muted-foreground" />} title="Retorno de Inversión (ROI)" value={isFinite(detailedResult.roi) ? `${detailedResult.roi.toFixed(1)}%` : '∞'} />
                        <StatCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} title="Horas de Máquina Liberadas (Anual)" value={`${detailedResult.machineHoursFreed.toFixed(1)} hrs`} />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Actual (A)" value={formatCurrency(detailedResult.cppA)} description="Costo Por Pieza" />
                        <StatCard icon={<Package className="h-4 w-4 text-muted-foreground" />} title="CPP Propuesto (B)" value={formatCurrency(detailedResult.cppB)} description="Costo Por Pieza" />
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

    
