

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

import { cn } from "@/lib/utils";
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
  // Costos por pieza
  cppA: number;
  cppB: number;
  costoHerramientaA: number;
  costoHerramientaB: number;
  costoMaquinaA: number;
  costoMaquinaB: number;

  // Ahorros
  ahorroAnual: number;
  ahorroMensual: number;

  // ROI y Performance
  roi: number;
  toolCostIncreasePercent: number;
  totalCostReductionPercent: number;

  // Horas liberadas
  machineHoursFreedAnnual: number;
  machineHoursFreedValueAnnual: number;
  diasLaboralesAhorradosAnual: number;
  semanasLaboralesAhorradasAnual: number;
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

  const syncForms = useCallback(() => {
    const diagValues = diagnosisForm.getValues();
    const detailValues = detailedForm.getValues();

    const newDetailValues: Partial<z.infer<typeof DetailedReportSchema>> = {};

    if (diagValues.costoHoraMaquina !== detailValues.machineHourlyRate) newDetailValues.machineHourlyRate = diagValues.costoHoraMaquina;
    if (diagValues.piezasAlMes !== detailValues.piezasAlMes) newDetailValues.piezasAlMes = diagValues.piezasAlMes;
    if (diagValues.precioA !== detailValues.precioA) newDetailValues.precioA = diagValues.precioA;
    if (diagValues.filosA !== detailValues.filosA) newDetailValues.filosA = diagValues.filosA;
    if (diagValues.pzsPorFiloA !== detailValues.piezasFiloA) newDetailValues.piezasFiloA = diagValues.pzsPorFiloA;
    if (diagValues.cicloMinA !== detailValues.cicloMinA) newDetailValues.cicloMinA = diagValues.cicloMinA;
    if (diagValues.cicloSegA !== detailValues.cicloSegA) newDetailValues.cicloSegA = diagValues.cicloSegA;
    if (diagValues.vcA !== detailValues.vcA) newDetailValues.vcA = diagValues.vcA;
    if (diagValues.precioB !== detailValues.precioB) newDetailValues.precioB = diagValues.precioB;

    if (Object.keys(newDetailValues).length > 0) {
        let changed = false;
        for (const key in newDetailValues) {
            if (newDetailValues[key as keyof typeof newDetailValues] !== detailValues[key as keyof typeof detailValues]) {
                changed = true;
                break;
            }
        }
        if (changed) {
            detailedForm.reset({ ...detailValues, ...newDetailValues }, { keepValues: true });
        }
    }

  }, [diagnosisForm, detailedForm]);

  useEffect(() => {
    const subscription = diagnosisForm.watch((value, { name, type }) => {
        if (type === 'change') syncForms();
    });
    return () => subscription.unsubscribe();
  }, [diagnosisForm, syncForms]);

  useEffect(() => {
    const subscription = detailedForm.watch((value, { name, type }) => {
      if (type !== 'change') return;

      const diagValues = diagnosisForm.getValues();
      const newDiagValues: Partial<z.infer<typeof QuickDiagnosisSchema>> = {};

      if (value.machineHourlyRate !== undefined && value.machineHourlyRate !== diagValues.costoHoraMaquina) newDiagValues.costoHoraMaquina = value.machineHourlyRate;
      if (value.piezasAlMes !== undefined && value.piezasAlMes !== diagValues.piezasAlMes) newDiagValues.piezasAlMes = value.piezasAlMes;
      if (value.precioA !== undefined && value.precioA !== diagValues.precioA) newDiagValues.precioA = value.precioA;
      if (value.filosA !== undefined && value.filosA !== diagValues.filosA) newDiagValues.filosA = value.filosA;
      if (value.piezasFiloA !== undefined && value.piezasFiloA !== diagValues.pzsPorFiloA) newDiagValues.pzsPorFiloA = value.piezasFiloA;
      if (value.cicloMinA !== undefined && value.cicloMinA !== diagValues.cicloMinA) newDiagValues.cicloMinA = value.cicloMinA;
      if (value.cicloSegA !== undefined && value.cicloSegA !== diagValues.cicloSegA) newDiagValues.cicloSegA = value.cicloSegA;
      if (value.vcA !== undefined && value.vcA !== diagValues.vcA) newDiagValues.vcA = value.vcA;
      if (value.precioB !== undefined && value.precioB !== diagValues.precioB) newDiagValues.precioB = value.precioB;

       if (Object.keys(newDiagValues).length > 0) {
            let changed = false;
            for (const key in newDiagValues) {
                if (newDiagValues[key as keyof typeof newDiagValues] !== diagValues[key as keyof typeof diagValues]) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                diagnosisForm.reset({ ...diagValues, ...newDiagValues }, { keepValues: true });
            }
        }
    });
    return () => subscription.unsubscribe();
  }, [detailedForm, diagnosisForm]);


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
    const ahorroMensual = ahorroPorPieza * (piezasAlMes || 0);
    const ahorroAnual = ahorroMensual * 12;
    
    // Investment analysis
    const toolCostIncreasePercent = costoHerramientaA > 0 ? ((costoHerramientaB - costoHerramientaA) / costoHerramientaA) * 100 : (costoHerramientaB > 0 ? Infinity : 0);
    const totalCostReductionPercent = cppA > 0 ? (ahorroPorPieza / cppA) * 100 : 0;
    const investment = (data.precioB || 0) - (data.precioA || 0);
    const roi = investment > 0 ? (ahorroAnual / investment) * 100 : Infinity;
    
    // Time savings
    const annualParts = (piezasAlMes || 0) * 12;
    const tiempoAhorradoPorPiezaMin = tcA - tcB;
    const machineHoursFreedAnnual = (annualParts * tiempoAhorradoPorPiezaMin) / 60;
    const machineHoursFreedValueAnnual = machineHoursFreedAnnual * machineHourlyRate;
    const diasLaboralesAhorradosAnual = machineHoursFreedAnnual / 8; // 8-hour shifts
    const semanasLaboralesAhorradasAnual = diasLaboralesAhorradosAnual / 5; // 5-day weeks

    setDetailedResult({
        cppA,
        cppB,
        costoHerramientaA,
        costoHerramientaB,
        costoMaquinaA,
        costoMaquinaB,
        ahorroAnual,
        ahorroMensual,
        roi,
        toolCostIncreasePercent,
        totalCostReductionPercent,
        machineHoursFreedAnnual,
        machineHoursFreedValueAnnual,
        diasLaboralesAhorradosAnual,
        semanasLaboralesAhorradasAnual,
    });
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const formatMinutes = (timeInMinutes: number) => {
    const minutes = Math.floor(timeInMinutes);
    const seconds = Math.round((timeInMinutes - minutes) * 60);
    return `${minutes} min ${seconds} seg`;
  };

  const StatCard = ({ icon, title, value, description, valueClassName, isCompact = false }: { icon?: React.ReactNode, title: string, value: string, description?: string, valueClassName?: string, isCompact?: boolean }) => (
    <Card>
        <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isCompact ? "p-3" : "pb-2")}>
            <CardTitle className={cn("font-medium", isCompact ? "text-sm" : "text-base")}>{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent className={isCompact ? "p-3 pt-0" : ""}>
            <div className={cn("font-bold", isCompact ? "text-2xl" : "text-3xl", valueClassName)}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
  )

  const watchedSimTimeMode = useWatch({ control: diagnosisForm.control, name: 'modoSimulacionTiempo' });
  const watchedModoVidaA = useWatch({ control: detailedForm.control, name: 'modoVidaA' });
  const watchedModoVidaB = useWatch({ control: detailedForm.control, name: 'modoVidaB' });
  
  const getBarHeights = (result: DetailedReportResult | null) => {
    if (!result || result.cppA <= 0) return { hMaquinaA: 0, hHerramientaA: 0, hMaquinaB: 0, hHerramientaB: 0, alturaBarraA: 0, alturaBarraB: 0 };
    const maxCosto = Math.max(result.cppA, result.cppB, 0.01);
    const alturaBarraA = (result.cppA / maxCosto) * 100;
    const alturaBarraB = (result.cppB / maxCosto) * 100;
    
    const hMaquinaA = (result.cppA > 0) ? (result.costoMaquinaA / result.cppA) * 100 : 0;
    const hHerramientaA = (result.cppA > 0) ? (result.costoHerramientaA / result.cppA) * 100 : 0;
    const hMaquinaB = (result.cppB > 0) ? (result.costoMaquinaB / result.cppB) * 100 : 0;
    const hHerramientaB = (result.cppB > 0) ? (result.costoHerramientaB / result.cppB) * 100 : 0;

    return { hMaquinaA, hHerramientaA, hMaquinaB, hHerramientaB, alturaBarraA, alturaBarraB };
  };

  const barHeights = getBarHeights(detailedResult);


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
                  <Button type="button" variant="secondary"><Save className="mr-2 h-4 w-4" />Guardar Caso</Button>
                  <Button type="button" variant="secondary"><Download className="mr-2 h-4 w-4" />Imprimir / Guardar PDF</Button>
                </div>
              </form>
            </Form>

            {detailedResult && (
                <div className="mt-8 pt-6 border-t space-y-12">
                    <div className="text-center">
                        <h3 className="text-3xl font-bold tracking-tight">Análisis de Costo por Pieza (CPP)</h3>
                        <p className="text-lg text-muted-foreground">Basado en {detailedForm.getValues("piezasAlMes")} pzs/mes y un costo de {formatCurrency(detailedForm.getValues("machineHourlyRate"))}/hr</p>
                        <div className="mt-4">
                            <p className="text-xl font-medium text-foreground">{detailedResult.ahorroAnual > 0 ? 'AHORRO ANUAL PROYECTADO' : 'PÉRDIDA ANUAL PROYECTADA'}</p>
                            <p className={`text-6xl font-bold ${detailedResult.ahorroAnual > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(detailedResult.ahorroAnual)}</p>
                            <p className="text-xl text-muted-foreground mt-1">({formatCurrency(detailedResult.ahorroMensual)} / Mes)</p>
                        </div>
                    </div>
                    
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-center mb-6">Comparativa de Costo Total por Pieza</h3>
                        <div className="flex justify-around items-end h-80 px-4">
                            {/* Barra A */}
                            <div className="w-1/3 flex flex-col items-center">
                                <div className="text-3xl font-bold text-destructive">{formatCurrency(detailedResult.cppA)}</div>
                                <div className="text-lg font-semibold text-muted-foreground mb-2">Actual</div>
                                <div className="w-full md:w-3/4 bg-muted rounded-t-lg" style={{ height: `${barHeights.alturaBarraA}%` }}>
                                    <div className="flex flex-col-reverse rounded-t-lg overflow-hidden h-full">
                                        <div style={{ height: `${barHeights.hHerramientaA}%` }} className="bg-destructive/40 flex items-center justify-center text-xs font-medium text-destructive-foreground p-1 text-center leading-tight overflow-hidden" title={`Herramienta ${formatCurrency(detailedResult.costoHerramientaA)}`}>
                                            Herram.<br/>{formatCurrency(detailedResult.costoHerramientaA)}
                                        </div>
                                        <div style={{ height: `${barHeights.hMaquinaA}%` }} className="bg-destructive flex items-center justify-center text-sm font-semibold text-destructive-foreground p-1 text-center leading-tight overflow-hidden" title={`Máquina ${formatCurrency(detailedResult.costoMaquinaA)}`}>
                                            Máquina<br/>{formatCurrency(detailedResult.costoMaquinaA)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Barra B */}
                            <div className="w-1/3 flex flex-col items-center">
                                <div className="text-3xl font-bold text-primary">{formatCurrency(detailedResult.cppB)}</div>
                                <div className="text-lg font-semibold text-muted-foreground mb-2">Propuesta</div>
                                <div className="w-full md:w-3/4 bg-muted rounded-t-lg" style={{ height: `${barHeights.alturaBarraB}%` }}>
                                    <div className="flex flex-col-reverse rounded-t-lg overflow-hidden h-full">
                                        <div style={{ height: `${barHeights.hHerramientaB}%` }} className="bg-primary/40 flex items-center justify-center text-xs font-medium text-primary-foreground p-1 text-center leading-tight overflow-hidden" title={`Herramienta ${formatCurrency(detailedResult.costoHerramientaB)}`}>
                                            Herram.<br/>{formatCurrency(detailedResult.costoHerramientaB)}
                                        </div>
                                        <div style={{ height: `${barHeights.hMaquinaB}%` }} className="bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground p-1 text-center leading-tight overflow-hidden" title={`Máquina ${formatCurrency(detailedResult.costoMaquinaB)}`}>
                                            Máquina<br/>{formatCurrency(detailedResult.costoMaquinaB)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="p-6 bg-muted rounded-lg">
                        <h3 className="text-2xl font-bold text-center mb-6">Análisis de Inversión vs. Ahorro</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <StatCard 
                                title="Inversión en Herramienta" 
                                description="Variación en costo de herramienta por pieza"
                                value={`${detailedResult.toolCostIncreasePercent > 0 ? '+' : ''}${detailedResult.toolCostIncreasePercent.toFixed(1)}%`}
                                valueClassName={detailedResult.toolCostIncreasePercent > 0 ? 'text-red-600' : 'text-green-600'}
                                isCompact
                            />
                             <StatCard 
                                title="Mejora en Costo Total" 
                                description="Reducción de costo total por pieza"
                                value={`${detailedResult.totalCostReductionPercent.toFixed(1)}%`}
                                valueClassName={detailedResult.totalCostReductionPercent > 0 ? 'text-green-600' : 'text-red-600'}
                                isCompact
                            />
                        </div>
                        <p className="text-center mt-4 text-muted-foreground text-sm">
                          {detailedResult.toolCostIncreasePercent > 0 
                                ? `Una inversión del ${detailedResult.toolCostIncreasePercent.toFixed(1)}% en la herramienta ` 
                                : `Un ahorro del ${(detailedResult.toolCostIncreasePercent * -1).toFixed(1)}% en la herramienta `
                            }
                            genera una mejora total del <strong className="text-foreground">{detailedResult.totalCostReductionPercent.toFixed(1)}%</strong> en el costo por pieza.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-center mb-6">Análisis de Horas de Máquina Liberadas</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <StatCard 
                                title="Tiempo de Máquina Liberado (Anual)"
                                value={`${detailedResult.machineHoursFreedAnnual.toFixed(2)} horas`}
                                valueClassName="text-primary"
                                isCompact
                            />
                            <StatCard 
                                title="Valor de Producción Adicional"
                                description={`Tiempo liberado valorizado a ${formatCurrency(detailedForm.getValues("machineHourlyRate"))}/hr`}
                                value={formatCurrency(detailedResult.machineHoursFreedValueAnnual)}
                                valueClassName="text-green-600"
                                isCompact
                            />
                        </div>
                    </div>

                     <div>
                        <h3 className="text-2xl font-bold text-center mb-6">Impacto en Planificación</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <StatCard 
                                title="Días de Trabajo Liberados"
                                description="Basado en turnos de 8 horas"
                                value={detailedResult.diasLaboralesAhorradosAnual.toFixed(2)}
                                valueClassName="text-primary"
                                isCompact
                            />
                            <StatCard 
                                title="Semanas de Trabajo Liberadas"
                                description="Basado en semanas de 5 días"
                                value={detailedResult.semanasLaboralesAhorradasAnual.toFixed(2)}
                                valueClassName="text-primary"
                                isCompact
                            />
                        </div>
                    </div>

                </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
