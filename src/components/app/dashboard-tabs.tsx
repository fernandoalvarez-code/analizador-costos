'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState, useCallback } from "react";
import { Download, Save, Printer, ChevronsRight, HelpCircle, TrendingUp, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { serverTimestamp, Timestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { QuickDiagnosisSchema, DetailedReportSchema, SaveCaseSchema } from "@/lib/schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "../ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useFirestore, useUser, collection, doc, storage } from "@/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useRouter } from "next/navigation";
import { ImageUploader } from "./image-uploader";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    return value === undefined ? null : value;
  }));
};

type QuickDiagnosisResult = { breakEvenSeconds: number; breakEvenPieces: number; deltaP: number; tcA: number; vcBTarget: number; newCycleTimeTarget: number; };
type NetSavingsResult = { netAnnualSavings: number; cppA: number; cppB: number; savingsPerPiece: number; improvementPercentage: number; newCycleTime: number; newToolLife: number; };
type DetailedReportResult = { cppA: number; cppB: number; costoHerramientaA: number; costoHerramientaB: number; costoMaquinaA: number; costoMaquinaB: number; ahorroAnual: number; ahorroMensual: number; ahorroPorPieza: number; roi: number; toolCostIncreasePercent: number; totalCostReductionPercent: number; timeReductionPercent: number; machineHoursFreedAnnual: number; machineHoursFreedValueAnnual: number; piezasAdicionalesAnual: number; diasLaboralesAhorradosAnual: number; semanasLaboralesAhorradasAnual: number; piezasTotalA: number; piezasTotalB: number; tiempoCicloA: number; tiempoCicloB: number; minutosFiloA: number; minutosFiloB: number; costoParadaA: number; costoParadaB: number; insertosNecesariosA: number; insertosNecesariosB: number; costoTotalInsertosA: number; costoTotalInsertosB: number; costoTotalMensualA: number; costoTotalMensualB: number; tiempoMaquinaMensualHorasA: number; tiempoMaquinaMensualHorasB: number; tiempoMaquinaMensualValorA: number; tiempoMaquinaMensualValorB: number; turnosMensualesA: number; turnosMensualesB: number; machineHoursFreedMonthly: number; };

type DashboardTabsProps = { initialData?: any; isReadOnly?: boolean; };

export default function DashboardTabs({ initialData, isReadOnly = false }: DashboardTabsProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  
  const [quickResult, setQuickResult] = useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedReportResult | null>(initialData?.results || null);
  const [isSaveAlertOpen, setSaveAlertOpen] = useState(false);
  
  const [imagesToUpload, setImagesToUpload] = useState<File[]>([]);
  const [keptImageUrls, setKeptImageUrls] = useState<string[]>([]); 
  const [imageDescriptions, setImageDescriptions] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const diagnosisForm = useForm<z.infer<typeof QuickDiagnosisSchema>>({ resolver: zodResolver(QuickDiagnosisSchema), defaultValues: { costoHoraMaquina: 35, piezasAlMes: 2000, precioA: '' as any, filosA: '' as any, pzsPorFiloA: '' as any, cicloMinA: '' as any, cicloSegA: '' as any, vcA: '' as any, precioB: '' as any, piezasMasReales: 0, modoSimulacionTiempo: 'segundos', segundosMenosReales: 0, vcBReal: 0, }, });
  const detailedForm = useForm<z.infer<typeof DetailedReportSchema>>({ resolver: zodResolver(DetailedReportSchema), defaultValues: initialData || { cliente: "", fecha: new Date().toISOString().split('T')[0], contacto: "", operacion: "", pieza: "", material: "", status: "Pendiente", machineHourlyRate: 35, piezasAlMes: 2000, tiempoParada: 2, descA: "Herramienta Actual", precioA: '' as any, insertosPorHerramientaA: 1, filosA: '' as any, cicloMinA: '' as any, cicloSegA: '' as any, vcA: '' as any, modoVidaA: 'piezas', piezasFiloA: '' as any, minutosFiloA: 0, notasA: "", descB: "Herramienta Propuesta", precioB: '' as any, insertosPorHerramientaB: 1, filosB: '' as any, cicloMinB: '' as any, cicloSegB: '' as any, vcB: '' as any, modoVidaB: 'piezas', piezasFiloB: '' as any, minutosFiloB: 0, notasB: "", }, });
  const saveCaseForm = useForm<z.infer<typeof SaveCaseSchema>>({ resolver: zodResolver(SaveCaseSchema), defaultValues: { caseName: initialData?.name || "", }, });

  const parseTimeToMinutes = (min: number | undefined, sec: number | undefined) => { const minVal = min || 0; const secVal = sec || 0; return minVal + (secVal / 60); }

  useEffect(() => {
    if (initialData) {
      detailedForm.reset(initialData);
      diagnosisForm.reset({ costoHoraMaquina: initialData.machineHourlyRate, piezasAlMes: initialData.piezasAlMes, precioA: initialData.precioA, filosA: initialData.filosA, pzsPorFiloA: initialData.piezasFiloA, cicloMinA: initialData.cicloMinA, cicloSegA: initialData.cicloSegA, vcA: initialData.vcA, precioB: initialData.precioB, });
      if (initialData.name) { saveCaseForm.reset({ caseName: initialData.name }); }
      if (initialData.imageUrls) setKeptImageUrls(initialData.imageUrls);
      if (initialData.imageDescriptions) setImageDescriptions(initialData.imageDescriptions);
    }
  }, [initialData, detailedForm, diagnosisForm, saveCaseForm]);

  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { costoHoraMaquina, precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, vcA, precioB } = data;
    if (precioA === undefined || pzsPorFiloA === undefined || filosA === undefined || precioB === undefined || costoHoraMaquina === undefined) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Por favor, complete los campos de precio, filos y piezas por filo." });
      return;
    }
    const deltaP = precioB - precioA;
    if (deltaP <= 0) {
      setQuickResult(null);
      setNetSavingsResult(null);
      toast({ title: "¡Excelente!", description: "La herramienta propuesta ya es más barata o igual. ¡El cambio es beneficioso sin necesidad de mejoras!", duration: 5000 });
      return;
    }
    const costoMin = costoHoraMaquina / 60;
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const breakEvenSeconds = (deltaP / costoMin);
    const piezasTotalesA = (filosA || 1) * (pzsPorFiloA || 1);
    const costoHerramientaPorPiezaA = piezasTotalesA > 0 ? (precioA / piezasTotalesA) : 0;
    const breakEvenPieces = costoHerramientaPorPiezaA > 0 ? (deltaP / costoHerramientaPorPiezaA) : Infinity;
    const vcBTarget = vcA && tcA > 0 ? vcA * (tcA / (tcA - (breakEvenSeconds / 60))) : 0;
    const newCycleTimeTarget = tcA > 0 ? tcA - (breakEvenSeconds / 60) : 0;
    setQuickResult({ breakEvenSeconds, breakEvenPieces, deltaP, tcA, vcBTarget, newCycleTimeTarget });
    setNetSavingsResult(null);
  }

  function onNetSavingsSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { costoHoraMaquina, piezasAlMes, precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, vcA, precioB, piezasMasReales, modoSimulacionTiempo, segundosMenosReales, vcBReal } = data;
    if (precioA === undefined || pzsPorFiloA === undefined || filosA === undefined || precioB === undefined || costoHoraMaquina === undefined || piezasAlMes === undefined) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Faltan campos del Paso 1 para calcular el ahorro." });
      return;
    }
    const costoMin = costoHoraMaquina / 60;
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const piezasTotalesA = (filosA || 1) * (pzsPorFiloA || 1);
    const costoHerramientaA = piezasTotalesA > 0 ? (precioA / piezasTotalesA) : 0;
    const costoMaquinaA = tcA * costoMin;
    const cppA = costoHerramientaA + costoMaquinaA;
    let tcB = tcA;
    if (modoSimulacionTiempo === 'segundos' && segundosMenosReales > 0) {
      tcB = tcA - (segundosMenosReales / 60);
    } else if (modoSimulacionTiempo === 'vc' && vcBReal > (vcA || 0) && (vcA || 0) > 0) {
      tcB = tcA * (vcA! / vcBReal);
    }
    const pzsPorFiloB = (pzsPorFiloA || 0) + (piezasMasReales || 0);
    const piezasTotalesB = (filosA || 1) * pzsPorFiloB;
    const costoHerramientaB = piezasTotalesB > 0 ? (precioB / piezasTotalesB) : 0;
    const costoMaquinaB = tcB * costoMin;
    const cppB = costoHerramientaB + costoMaquinaB;
    const savingsPerPiece = cppA - cppB;
    const netMonthlySavings = savingsPerPiece * piezasAlMes;
    const netAnnualSavings = netMonthlySavings * 12;
    const improvementPercentage = cppA > 0 ? (savingsPerPiece / cppA) * 100 : 0;
    setNetSavingsResult({ netAnnualSavings, cppA, cppB, savingsPerPiece, improvementPercentage, newCycleTime: tcB * 60, newToolLife: pzsPorFiloB, });
  }

  function onDetailedSubmit(data: z.infer<typeof DetailedReportSchema>) {
    const { machineHourlyRate, piezasAlMes, tiempoParada } = data;
    if (!machineHourlyRate || !piezasAlMes) { toast({ variant: "destructive", title: "Datos incompletos", description: "Complete 'Datos Generales'."}); return; }
    const costoMin = machineHourlyRate / 60;
    const tcA = parseTimeToMinutes(data.cicloMinA, data.cicloSegA); let pzA = data.piezasFiloA || 0; let minA = data.minutosFiloA || 0; if (data.modoVidaA === 'minutos' && tcA > 0) { pzA = (data.minutosFiloA || 0) / tcA; } else if (tcA > 0) { minA = (data.piezasFiloA || 0) * tcA; }
    const piezasTotalA = (data.filosA || 1) * pzA; const costoHerramientaA = piezasTotalA > 0 ? ((data.precioA || 0) * (data.insertosPorHerramientaA || 1)) / piezasTotalA : 0; const costoParadaA = pzA > 0 ? ((tiempoParada || 0) * costoMin) / pzA : 0; const costoMaquinaA = (tcA * costoMin) + costoParadaA; const cppA = costoHerramientaA + costoMaquinaA;
    const tcB = parseTimeToMinutes(data.cicloMinB, data.cicloSegB); let pzB = data.piezasFiloB || 0; let minB = data.minutosFiloB || 0; if (data.modoVidaB === 'minutos' && tcB > 0) { pzB = (data.minutosFiloB || 0) / tcB; } else if (tcB > 0) { minB = (data.piezasFiloB || 0) * tcB; }
    const piezasTotalB = (data.filosB || 1) * pzB; const costoHerramientaB = piezasTotalB > 0 ? ((data.precioB || 0) * (data.insertosPorHerramientaB || 1)) / piezasTotalB : 0; const costoParadaB = pzB > 0 ? ((tiempoParada || 0) * costoMin) / pzB : 0; const costoMaquinaB = (tcB * costoMin) + costoParadaB; const cppB = costoHerramientaB + costoMaquinaB;
    const ahorroPorPieza = cppA - cppB; const ahorroMensual = ahorroPorPieza * (piezasAlMes || 0); const ahorroAnual = ahorroMensual * 12;
    const toolCostIncreasePercent = costoHerramientaA > 0 ? ((costoHerramientaB - costoHerramientaA) / costoHerramientaA) * 100 : (costoHerramientaB > 0 ? Infinity : 0); const totalCostReductionPercent = cppA > 0 ? (ahorroPorPieza / cppA) * 100 : 0; const investment = (data.precioB || 0) - (data.precioA || 0); const roi = investment > 0 && ahorroAnual > 0 ? (ahorroAnual / investment) * 100 : (ahorroAnual > 0 ? Infinity : 0);
    const annualParts = (piezasAlMes || 0) * 12; const tiempoAhorradoPorPiezaMin = tcA - tcB; const machineHoursFreedAnnual = (annualParts * tiempoAhorradoPorPiezaMin) / 60; const machineHoursFreedValueAnnual = machineHoursFreedAnnual * machineHourlyRate; const piezasAdicionalesAnual = tcB > 0 ? (machineHoursFreedAnnual * 60) / tcB : 0; const diasLaboralesAhorradosAnual = machineHoursFreedAnnual / 8; const semanasLaboralesAhorradasAnual = diasLaboralesAhorradosAnual / 5;
    const insertosNecesariosA = piezasTotalA > 0 ? (piezasAlMes || 0) / piezasTotalA : 0; const insertosNecesariosB = piezasTotalB > 0 ? (piezasAlMes || 0) / piezasTotalB : 0; const costoTotalInsertosA = insertosNecesariosA * (data.precioA || 0); const costoTotalInsertosB = insertosNecesariosB * (data.precioB || 0);
    const costoTotalMensualA = cppA * (piezasAlMes || 0); const costoTotalMensualB = cppB * (piezasAlMes || 0); const tiempoMaquinaMensualHorasA = (tcA * (piezasAlMes || 0)) / 60; const tiempoMaquinaMensualHorasB = (tcB * (piezasAlMes || 0)) / 60; const machineHoursFreedMonthly = tiempoMaquinaMensualHorasA - tiempoMaquinaMensualHorasB; const tiempoMaquinaMensualValorA = tiempoMaquinaMensualHorasA * machineHourlyRate; const tiempoMaquinaMensualValorB = tiempoMaquinaMensualHorasB * machineHourlyRate; const turnosMensualesA = tiempoMaquinaMensualHorasA / 8; const turnosMensualesB = tiempoMaquinaMensualHorasB / 8; const timeReductionPercent = tcA > 0 ? ((tcA - tcB) / tcA) * 100 : 0;
    setDetailedResult({ cppA, cppB, costoHerramientaA, costoHerramientaB, costoMaquinaA, costoMaquinaB, ahorroAnual, ahorroMensual, ahorroPorPieza, roi, toolCostIncreasePercent, totalCostReductionPercent, machineHoursFreedAnnual, machineHoursFreedValueAnnual, piezasAdicionalesAnual, diasLaboralesAhorradosAnual, semanasLaboralesAhorradasAnual, piezasTotalA: piezasTotalA, piezasTotalB: piezasTotalB, tiempoCicloA: tcA, tiempoCicloB: tcB, minutosFiloA: minA, minutosFiloB: minB, costoParadaA, costoParadaB, insertosNecesariosA, insertosNecesariosB, costoTotalInsertosA, costoTotalInsertosB, costoTotalMensualA, costoTotalMensualB, tiempoMaquinaMensualHorasA, tiempoMaquinaMensualHorasB, tiempoMaquinaMensualValorA, tiempoMaquinaMensualValorB, turnosMensualesA, turnosMensualesB, machineHoursFreedMonthly, timeReductionPercent, });
  }

  const handlePrintReport = async () => {
    if (initialData?.id) {
       window.open(`/cases/${initialData.id}?print=true`, '_blank');
    } else {
       if (detailedResult) {
         window.print();
       } else {
         toast({ variant: "destructive", title: "Informe no generado", description: "Primero genera el informe." });
       }
    }
  };

  const handleSaveCase = async (caseName: string) => {
    if (!detailedResult) { toast({ variant: "destructive", title: "No hay informe", description: "Primero genera el informe." }); return; }
    if (!user || !firestore) { toast({ variant: "destructive", title: "Error de sesión", description: "Debes iniciar sesión." }); return; }

    setIsUploading(true);

    try {
      const formValues = detailedForm.getValues();
      const isExistingCase = !!initialData?.id;
      const caseId = isExistingCase ? initialData.id : doc(collection(firestore, "cuttingToolAnalyses")).id;
      const caseDocRef = doc(firestore, "cuttingToolAnalyses", caseId);

      let finalImageUrls = [...keptImageUrls];

      if (imagesToUpload.length > 0) {
        if (!storage) throw new Error("Firebase Storage no está inicializado.");
        const promises = imagesToUpload.map(async (file, index) => {
          const storageRef = ref(storage, `cases/${caseId}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          return await getDownloadURL(snapshot.ref);
        });
        const newUrls = await Promise.all(promises);
        finalImageUrls = [...finalImageUrls, ...newUrls];
      }

      const historyEntry = { modifiedBy: user.uid, lastModifiedByEmail: user.email, modifiedAt: new Date(), snapshot: formValues };
      
      const rawData = {
        ...formValues,
        results: detailedResult,
        imageUrls: finalImageUrls,
        imageDescriptions: imageDescriptions,
        userId: isExistingCase ? initialData.userId : user.uid,
        name: caseName,
        annualSavings: detailedResult.ahorroAnual || 0,
        roi: detailedResult.roi || 0,
        status: formValues.status || "Pendiente",
        ...(isExistingCase 
          ? { dateModified: serverTimestamp(), modifiedBy: user.uid, lastModifiedByEmail: user.email, history: [...(initialData.history || []), historyEntry] } 
          : { dateCreated: serverTimestamp(), modifiedBy: user.uid, lastModifiedByEmail: user.email, history: [historyEntry] }),
      };

      await setDoc(caseDocRef, sanitizeData(rawData), { merge: true });
      
      toast({ title: "Éxito", description: `Caso "${caseName}" guardado.` });
      setSaveAlertOpen(false);

      if (!isExistingCase) { router.push(`/cases/${caseId}`); } else { window.location.reload(); }

    } catch (error: any) {
      console.error("❌ Error:", error);
      toast({ variant: "destructive", title: "Error al guardar", description: error.message || "Error desconocido." });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleNewCase = () => { router.push('/dashboard'); }
  const syncDiagToDetail = useCallback((fieldName: any, value: any) => { 
      detailedForm.setValue(fieldName, value, { shouldValidate: true });
   }, [detailedForm]);
  const syncDetailToDiag = useCallback((fieldName: any, value: any) => { 
      diagnosisForm.setValue(fieldName, value, { shouldValidate: true });
   }, [diagnosisForm]);
  const watchedModoVidaA = useWatch({ control: detailedForm.control, name: 'modoVidaA' });
  const watchedModoVidaB = useWatch({ control: detailedForm.control, name: 'modoVidaB' });
  const watchedSimTimeMode = useWatch({ control: diagnosisForm.control, name: 'modoSimulacionTiempo' });

  return (
    <>
      <TooltipProvider>
      <Tabs defaultValue={initialData ? "detailed" : "quick"} className="w-full">
        <TabsList className="grid w-full grid-cols-2 no-print">
          <TabsTrigger value="quick" disabled={isReadOnly}>1. Diagnóstico Rápido</TabsTrigger>
          <TabsTrigger value="detailed">2. Informe Detallado</TabsTrigger>
        </TabsList>
        <TabsContent value="quick">
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico Rápido</CardTitle>
              <CardDescription>Calcula rápidamente el punto de equilibrio para justificar la diferencia de precio entre dos herramientas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...diagnosisForm}>
                <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                  <fieldset disabled={isReadOnly} className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-primary">Datos Generales</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>Costo Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => { field.onChange(parseFloat(e.target.value)); syncDiagToDetail('machineHourlyRate', parseFloat(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>Piezas a Producir / Mes</FormLabel><FormControl><Input type="number" {...field} onChange={e => { field.onChange(parseFloat(e.target.value)); syncDiagToDetail('piezasAlMes', parseFloat(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                      </div>
                    </div>
                    
                    <Separator />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                      <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-center text-red-600">Herramienta Actual (A)</h3>
                        <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio del Inserto ($)</FormLabel><FormControl><Input type="number" placeholder="Ej: 25.50" {...field} onChange={e => { field.onChange(parseFloat(e.target.value)); syncDiagToDetail('precioA', parseFloat(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos / Inserto</FormLabel><FormControl><Input type="number" placeholder="Ej: 4" {...field} onChange={e => { field.onChange(parseInt(e.target.value)); syncDiagToDetail('filosA', parseInt(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                          <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Piezas / Filo</FormLabel><FormControl><Input type="number" placeholder="Ej: 150" {...field} onChange={e => { field.onChange(parseInt(e.target.value)); syncDiagToDetail('piezasFiloA', parseInt(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <FormItem><FormLabel>Tiempo de Ciclo (Tc)</FormLabel><div className="flex gap-2"><FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<Input type="number" placeholder="Min" {...field} onChange={e => { field.onChange(parseInt(e.target.value)); syncDiagToDetail('cicloMinA', parseInt(e.target.value)); }}/>)}/> <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<Input type="number" placeholder="Seg" {...field} onChange={e => { field.onChange(parseInt(e.target.value)); syncDiagToDetail('cicloSegA', parseInt(e.target.value)); }}/>)}/></div></FormItem>
                            <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vel. de Corte (Vc)</FormLabel><FormControl><Input type="number" placeholder="m/min" {...field} onChange={e => { field.onChange(parseInt(e.target.value)); syncDiagToDetail('vcA', parseInt(e.target.value)); }}/></FormControl></FormItem>)}/>
                        </div>
                      </div>
                      
                      <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
                        <h3 className="font-medium text-center text-blue-600">Herramienta Propuesta (B)</h3>
                        <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio del Inserto ($)</FormLabel><FormControl><Input type="number" placeholder="Ej: 35.00" {...field} onChange={e => { field.onChange(parseFloat(e.target.value)); syncDiagToDetail('precioB', parseFloat(e.target.value)); }}/></FormControl><FormMessage /></FormItem>)}/>
                         <div className="pt-8 text-center text-muted-foreground italic">
                            <HelpCircle className="mx-auto h-8 w-8 mb-2"/>
                            <p>Los demás datos de la Herramienta B se simularán en los pasos siguientes.</p>
                         </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <Button type="button" onClick={diagnosisForm.handleSubmit(onQuickSubmit)}>
                        <ChevronsRight className="mr-2 h-4 w-4" />
                        Paso 1: Calcular Punto de Equilibrio
                      </Button>
                    </div>
                  </fieldset>

                  {quickResult && (
                    <div className="space-y-6 pt-6 border-t">
                      <h3 className="text-center text-xl font-semibold">Punto de Equilibrio</h3>
                      <Card className="bg-green-50/50 border-green-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-green-800">¡Objetivo Encontrado!</CardTitle>
                          <CardDescription>Para justificar una diferencia de precio de <strong>{formatCurrency(quickResult.deltaP)}</strong>, la herramienta B debe lograr UNO de los siguientes objetivos:</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white rounded-lg border">
                                <h4 className="font-bold text-lg flex items-center">Reducción de Tiempo de Ciclo</h4>
                                <p className="text-3xl font-black text-green-600">{quickResult.breakEvenSeconds.toFixed(2)}s</p>
                                <p className="text-sm text-muted-foreground">Nuevo tiempo de ciclo objetivo: <strong>{(quickResult.newCycleTimeTarget * 60).toFixed(2)}s</strong> (vs {quickResult.tcA.toFixed(2)} min actuales)</p>
                                <p className="text-sm text-muted-foreground mt-2">Para lograrlo, la Vc debería aumentar a: <strong>{quickResult.vcBTarget.toFixed(0)} m/min</strong></p>
                            </div>
                            <div className="p-4 bg-white rounded-lg border">
                               <h4 className="font-bold text-lg flex items-center">Aumento de Vida Útil</h4>
                                <p className="text-3xl font-black text-green-600">+{Math.ceil(quickResult.breakEvenPieces)} pzs</p>
                                <p className="text-sm text-muted-foreground">La herramienta debe rendir <strong>{Math.ceil(quickResult.breakEvenPieces)} piezas más</strong> por filo que la herramienta actual para compensar el costo.</p>
                            </div>
                        </CardContent>
                      </Card>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Sparkles /> Simulación de Ahorro Neto Real</h3>
                        <div className="p-4 border rounded-lg grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <FormField control={diagnosisForm.control} name="piezasMasReales" render={({ field }) => (<FormItem><FormLabel>¿Cuántas piezas <strong>MÁS</strong> por filo crees que rendirá la Herramienta B?</FormLabel><FormControl><Input type="number" placeholder="Ej: 50" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl></FormItem>)}/>
                            <div className="space-y-3">
                                <Label>¿Cómo se reducirá el Tiempo de Ciclo?</Label>
                                <FormField control={diagnosisForm.control} name="modoSimulacionTiempo" render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="segundos" id="segundos"/><Label htmlFor="segundos">Reducción Directa (s)</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="vc" id="vc"/><Label htmlFor="vc">Aumento de Vc (m/min)</Label></div>
                                    </RadioGroup>
                                )}/>
                                {watchedSimTimeMode === 'segundos' ? (
                                    <FormField control={diagnosisForm.control} name="segundosMenosReales" render={({ field }) => (<FormItem><FormLabel>¿Cuántos segundos <strong>MENOS</strong> durará el ciclo?</FormLabel><FormControl><Input type="number" placeholder="Ej: 15" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl></FormItem>)}/>
                                ) : (
                                    <FormField control={diagnosisForm.control} name="vcBReal" render={({ field }) => (<FormItem><FormLabel>¿Cuál será la <strong>NUEVA</strong> Velocidad de Corte?</FormLabel><FormControl><Input type="number" placeholder="Ej: 250" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl></FormItem>)}/>
                                )}
                            </div>
                        </div>
                         <div className="text-center">
                            <Button type="button" onClick={diagnosisForm.handleSubmit(onNetSavingsSubmit)}>
                                <TrendingUp className="mr-2 h-4 w-4" />
                                Paso 2: Calcular Ahorro Neto
                            </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {netSavingsResult && (
                     <div className="space-y-6 pt-6 border-t">
                      <h3 className="text-center text-xl font-semibold">Resultados de la Simulación</h3>
                       <Card className={cn("border-2", netSavingsResult.netAnnualSavings > 0 ? "border-green-500 bg-green-50/30" : "border-red-500 bg-red-50/30")}>
                        <CardContent className="p-6">
                            <div className="text-center">
                               {netSavingsResult.netAnnualSavings > 0 ? (
                                   <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2"/>
                               ) : (
                                   <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-2"/>
                               )}
                               <p className="text-sm font-bold uppercase tracking-wider">{netSavingsResult.netAnnualSavings > 0 ? "Propuesta Beneficiosa" : "Propuesta No Recomendada"}</p>
                               <p className="text-4xl font-black">{formatCurrency(netSavingsResult.netAnnualSavings)}</p>
                               <p className="font-semibold text-muted-foreground">Ahorro Neto Anual Proyectado</p>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-white rounded-md border">
                                    <p className="text-xs text-muted-foreground">CPP Actual</p>
                                    <p className="font-bold text-lg">{formatCurrency(netSavingsResult.cppA)}</p>
                                </div>
                                <div className="p-3 bg-white rounded-md border">
                                    <p className="text-xs text-muted-foreground">CPP Propuesto</p>
                                    <p className="font-bold text-lg">{formatCurrency(netSavingsResult.cppB)}</p>
                                </div>
                                <div className="p-3 bg-white rounded-md border">
                                    <p className="text-xs text-muted-foreground">Ahorro / Pieza</p>
                                    <p className="font-bold text-lg">{formatCurrency(netSavingsResult.savingsPerPiece)}</p>
                                </div>
                                 <div className="p-3 bg-white rounded-md border">
                                    <p className="text-xs text-muted-foreground">% Mejora Global</p>
                                    <p className="font-bold text-lg text-green-600">{netSavingsResult.improvementPercentage.toFixed(1)}%</p>
                                </div>
                                <div className="p-3 bg-white rounded-md border col-span-2">
                                    <p className="text-xs text-muted-foreground">Condiciones simuladas para Herramienta B</p>
                                    <p className="font-semibold">Nuevo Tiempo de Ciclo: <span className="font-bold">{netSavingsResult.newCycleTime.toFixed(2)}s</span></p>
                                    <p className="font-semibold">Nueva Vida Útil: <span className="font-bold">{netSavingsResult.newToolLife} pzs/filo</span></p>
                                </div>
                            </div>
                        </CardContent>
                       </Card>
                     </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="detailed">
          <Card>
            <CardHeader className="no-print flex-row justify-between items-center">
              <div><CardTitle>Informe Detallado</CardTitle><CardDescription>Genera una comparación exhaustiva.</CardDescription></div>
              {!isReadOnly && <Button onClick={handleNewCase} variant="outline" size="sm">Nuevo Informe</Button>}
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...detailedForm}>
                <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-8 no-print">
                  <fieldset disabled={isReadOnly}>
                      <div className="grid grid-cols-3 gap-4 mb-4"><FormField control={detailedForm.control} name="cliente" render={({ field }) => (<FormItem><FormLabel>Cliente</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/> </div>
                      
                      <div className="mt-8 space-y-3 page-break-inside-avoid">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Evidencia Fotográfica</h3>
                        <ImageUploader 
                            initialImages={initialData?.imageUrls}
                            initialDescriptions={initialData?.imageDescriptions}
                            onImagesChange={(files, keptUrls, allDescs) => {
                                setImagesToUpload(files);
                                setKeptImageUrls(keptUrls);
                                setImageDescriptions(allDescs);
                            }} 
                        />
                      </div>
                  </fieldset>
                  
                  {!isReadOnly && 
                    <div className="flex flex-wrap gap-4 justify-center">
                      <Button type="submit">Generar Informe</Button>
                        <AlertDialog open={isSaveAlertOpen} onOpenChange={setSaveAlertOpen}>
                            <AlertDialogTrigger asChild><Button type="button" disabled={!detailedResult || isUploading}>{isUploading ? 'Guardando...' : <><Save className="mr-2 h-4 w-4" />Guardar Caso</>}</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Guardar Caso</AlertDialogTitle><AlertDialogDescription>Nombre del caso:</AlertDialogDescription></AlertDialogHeader>
                                <Form {...saveCaseForm}><form id="save-case-form" onSubmit={saveCaseForm.handleSubmit((data) => handleSaveCase(data.caseName))}><FormField control={saveCaseForm.control} name="caseName" render={({ field }) => (<FormItem><FormControl><Input {...field} /></FormControl></FormItem>)}/></form></Form>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><Button onClick={saveCaseForm.handleSubmit((data) => handleSaveCase(data.caseName))} disabled={isUploading}>{isUploading ? 'Guardando...' : 'Guardar'}</Button></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      <Button type="button" onClick={handlePrintReport} disabled={!detailedResult}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</Button>
                    </div>
                  }
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </TooltipProvider>
    </>
  );
}
