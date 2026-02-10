'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState, useCallback } from "react";
import { Download, Save, Printer } from "lucide-react";
import { serverTimestamp, Timestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { QuickDiagnosisSchema, DetailedReportSchema, SaveCaseSchema } from "@/lib/schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "../ui/textarea";
import { useFirestore, useUser, collection, doc, storage } from "@/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useRouter } from "next/navigation";
import { ImageUploader } from "./image-uploader";

// Función de limpieza
const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    return value === undefined ? null : value;
  }));
};

// Tipos
type QuickDiagnosisResult = { breakEvenSeconds: number; breakEvenPieces: number; deltaP: number; tcA: number; vcBTarget: number; newCycleTimeTarget: number; };
type NetSavingsResult = { netAnnualSavings: number; cppA: number; cppB: number; savingsPerPiece: number; improvementPercentage: number; newCycleTime: number; newToolLife: number; };
type DetailedReportResult = { cppA: number; cppB: number; costoHerramientaA: number; costoHerramientaB: number; costoMaquinaA: number; costoMaquinaB: number; ahorroAnual: number; ahorroMensual: number; ahorroPorPieza: number; roi: number; toolCostIncreasePercent: number; totalCostReductionPercent: number; timeReductionPercent: number; machineHoursFreedAnnual: number; machineHoursFreedValueAnnual: number; piezasAdicionalesAnual: number; diasLaboralesAhorradosAnual: number; semanasLaboralesAhorradasAnual: number; piezasTotalA: number; piezasTotalB: number; tiempoCicloA: number; tiempoCicloB: number; minutosFiloA: number; minutosFiloB: number; costoParadaA: number; costoParadaB: number; insertosNecesariosA: number; insertosNecesariosB: number; costoTotalInsertosA: number; costoTotalInsertosB: number; costoTotalMensualA: number; costoTotalMensualB: number; tiempoMaquinaMensualHorasA: number; tiempoMaquinaMensualHorasB: number; tiempoMaquinaMensualValorA: number; tiempoMaquinaMensualValorB: number; turnosMensualesA: number; turnosMensualesB: number; machineHoursFreedMonthly: number; };

type DashboardTabsProps = { initialData?: any; isReadOnly?: boolean; };

export default function DashboardTabs({ initialData, isReadOnly = false }: DashboardTabsProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  
  // Estados
  const [quickResult, setQuickResult] = useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedReportResult | null>(initialData?.results || null);
  const [isSaveAlertOpen, setSaveAlertOpen] = useState(false);
  
  // Imágenes
  const [imagesToUpload, setImagesToUpload] = useState<File[]>([]);
  const [keptImageUrls, setKeptImageUrls] = useState<string[]>([]); 
  const [imageDescriptions, setImageDescriptions] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Formularios
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

  // --- LÓGICA DE CÁLCULO ---
  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { precioA, precioB, filosA, pzsPorFiloA, costoHoraMaquina, cicloMinA, cicloSegA, vcA } = data;
    if (!precioA || !precioB || !filosA || !pzsPorFiloA || !costoHoraMaquina || cicloMinA === undefined) { toast({ variant: "destructive", title: "Datos incompletos", description: "Complete 'Datos de Partida'." }); return; }
    const nA = (filosA || 1) * (pzsPorFiloA || 1); const tcA = parseTimeToMinutes(cicloMinA, cicloSegA); const cm = (costoHoraMaquina || 0) / 60; const deltaP = (precioB || 0) - (precioA || 0);
    if (costoHoraMaquina <= 0 || precioA < 0 || precioB < 0 || nA <= 0 || tcA <= 0) { toast({ variant: "destructive", title: "Datos inválidos", description: "Valores deben ser positivos." }); return; }
    if (deltaP <= 0) { setQuickResult({ breakEvenSeconds: 0, breakEvenPieces: 0, deltaP: deltaP, tcA: tcA, vcBTarget: vcA || 0, newCycleTimeTarget: tcA, }); if (deltaP < 0) { toast({ variant: "default", title: "Precio B es menor", description: "No hay sobrecosto que justificar." }); } else { toast({ variant: "default", title: "Mismo Precio", description: "Cualquier mejora es ahorro directo." }); } return; }
    const nB_target = precioB * nA / precioA; const delta_N_filo = (nB_target / (filosA || 1)) - (pzsPorFiloA || 1); const delta_t_min = deltaP / (nA * cm); const breakEvenSeconds = delta_t_min * 60; const tcB_target = tcA - delta_t_min;
    let vcBTarget = 0; if (vcA && vcA > 0 && tcB_target > 0) { vcBTarget = vcA * (tcA / tcB_target); }
    setQuickResult({ breakEvenSeconds: breakEvenSeconds, breakEvenPieces: delta_N_filo, deltaP: deltaP, tcA: tcA, vcBTarget: vcBTarget, newCycleTimeTarget: tcB_target, });
    diagnosisForm.setValue('segundosMenosReales', parseFloat(breakEvenSeconds.toFixed(2)));
  }

  function onNetSavingsSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { costoHoraMaquina, piezasAlMes, precioA, filosA, pzsPorFiloA, cicloMinA, cicloSegA, precioB, piezasMasReales, modoSimulacionTiempo, segundosMenosReales, vcA, vcBReal } = data;
    if (!costoHoraMaquina || !piezasAlMes || !precioA || !filosA || !pzsPorFiloA || (cicloMinA === undefined && cicloSegA === undefined) || !precioB ) { toast({ variant: "destructive", title: "Datos incompletos", description: "Complete 'Datos de Partida'." }); return; }
    if (piezasMasReales === 0 && segundosMenosReales === 0 && (modoSimulacionTiempo === 'vc' && vcBReal === 0)) { toast({ variant: "destructive", title: "Sin mejoras", description: "Ingrese mejora (piezas o tiempo)." }); return; }
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA); const nA = filosA * pzsPorFiloA; const cm = costoHoraMaquina / 60; const costoHerrA = precioA / nA; const costoMaqA = tcA * cm; const cppA = costoHerrA + costoMaqA;
    let tcB_real_min = 0; let actualVcB = vcBReal || 0;
    if (modoSimulacionTiempo === 'segundos') { tcB_real_min = tcA - ((segundosMenosReales || 0) / 60); if ((vcA || 0) > 0 && tcB_real_min > 0) { actualVcB = (vcA || 0) * (tcA / tcB_real_min); diagnosisForm.setValue('vcBReal', parseFloat(actualVcB.toFixed(2))); } } 
    else { if ((vcA || 0) <= 0 || (vcBReal || 0) <= 0 || vcBReal === vcA) { toast({ variant: "destructive", title: "Vc inválida", description: "Ingrese Vc distinta." }); return; } tcB_real_min = tcA * ((vcA || 0) / (vcBReal || 1)); diagnosisForm.setValue('segundosMenosReales', parseFloat(((tcA - tcB_real_min) * 60).toFixed(2))); }
    if (tcB_real_min <= 0) { toast({ variant: "destructive", title: "Error", description: "Tiempo inválido." }); return; }
    const nB_real = (filosA || 1) * ((pzsPorFiloA || 0) + (piezasMasReales || 0)); if (nB_real <= 0) { toast({ variant: "destructive", title: "Error", description: "Rendimiento inválido." }); return; }
    const costoHerrB = (precioB || 0) / nB_real; const costoMaqB = tcB_real_min * cm; const cppB = costoHerrB + costoMaqB; const savingsPerPiece = cppA - cppB; const netAnnualSavings = savingsPerPiece * (piezasAlMes || 0) * 12; const improvementPercentage = cppA > 0 ? (savingsPerPiece / cppA) * 100 : 0;
    setNetSavingsResult({ netAnnualSavings: isFinite(netAnnualSavings) ? netAnnualSavings : 0, cppA, cppB, savingsPerPiece, improvementPercentage, newCycleTime: tcB_real_min, newToolLife: (pzsPorFiloA || 0) + (piezasMasReales || 0), });
    const newCicloMin = Math.floor(tcB_real_min); const newCicloSeg = Math.round((tcB_real_min - newCicloMin) * 60);
    detailedForm.setValue("cicloMinB", newCicloMin); detailedForm.setValue("cicloSegB", newCicloSeg); detailedForm.setValue("piezasFiloB", (pzsPorFiloA || 0) + (piezasMasReales || 0)); detailedForm.setValue("vcB", parseFloat(actualVcB.toFixed(2))); detailedForm.setValue("filosB", filosA || 0); detailedForm.setValue("modoVidaB", "piezas");
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
    if (initialData?.id) { window.open(`/cases/${initialData.id}?print=true`, '_blank'); } 
    else { 
       if (detailedResult) { window.print(); } 
       else { toast({ variant: "destructive", title: "Informe no generado", description: "Primero genera el informe." }); }
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

      // Lógica de imágenes combinadas
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
  
  // Helpers
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

  // Helpers visuales
  const formatCurrencyDisplay = (value?: number) => {
    if (typeof value !== 'number' || !isFinite(value)) return 'N/A';
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  return (
    <>
      <Tabs defaultValue={initialData ? "detailed" : "quick"} className="w-full">
        <TabsList className="grid w-full grid-cols-2 no-print">
          <TabsTrigger value="quick" disabled={isReadOnly}>1. Diagnóstico</TabsTrigger>
          <TabsTrigger value="detailed">2. Informe</TabsTrigger>
        </TabsList>
        
        {/* --- PESTAÑA 1: DIAGNÓSTICO RÁPIDO (RESTAURADA) --- */}
        <TabsContent value="quick">
            <Card>
            <CardHeader>
              <CardTitle className="font-headline">Diagnóstico Rápido</CardTitle>
              <CardDescription>Calcula rápidamente el punto de equilibrio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...diagnosisForm}>
                <form className="space-y-8">
                  <fieldset disabled={isReadOnly}>
                    <h3 className="text-lg font-semibold mb-4 font-headline text-blue-800">Datos de Partida</h3>
                    <div className="p-6 border border-blue-200 bg-blue-50/50 rounded-lg space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} onChange={e => { const val = parseFloat(e.target.value) || 0; field.onChange(val); syncDiagToDetail('machineHourlyRate', val); }} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas al Mes (aprox.)</FormLabel><FormControl><Input type="number" {...field} onChange={e => { const val = parseFloat(e.target.value) || 0; field.onChange(val); syncDiagToDetail('piezasAlMes', val); }} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <h4 className="font-medium text-destructive mb-2">Inserto A (Actual)</h4>
                              <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio Inserto (USD)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('precioA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                              <div className="flex space-x-2">
                                  <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('filosA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                                  <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('piezasFiloA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                              </div>
                                <div className="flex space-x-2">
                                  <FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('cicloMinA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                                  <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>Seg</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('cicloSegA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                              </div>
                              <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('vcA', val); }} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                          <div className="space-y-3">
                            <h4 className="font-medium text-primary mb-2">Inserto B (Propuesta)</h4>
                              <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio Inserto (USD)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('precioB', val); }} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                      </div>
                    </div>
                  </fieldset>

                  <Separator className="my-8" />
                  <div className="space-y-4">
                      <h3 className="text-xl font-semibold font-headline">Paso 1: Punto de Equilibrio</h3>
                      <div className="p-6 border rounded-lg space-y-4">
                          <Button type="button" onClick={diagnosisForm.handleSubmit(onQuickSubmit)} disabled={isReadOnly}>Calcular Punto de Equilibrio</Button>
                           {quickResult && (
                              <div className="mt-6 pt-6 border-t">
                                  <div className="grid gap-6 md:grid-cols-2">
                                      <Card className="text-center"><CardHeader><CardTitle>Opción 1: Mejorar Rendimiento</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-primary">+{quickResult.breakEvenPieces.toFixed(1)} pzs/filo</p></CardContent></Card>
                                      <Card className="text-center"><CardHeader><CardTitle>Opción 2: Mejorar Velocidad</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-primary">-{quickResult.breakEvenSeconds.toFixed(2)} seg/pieza</p></CardContent></Card>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <Separator className="my-8" />
                  <div className="space-y-4">
                      <h3 className="text-xl font-semibold font-headline">Paso 2: Simulación Real</h3>
                       <div className="p-6 border rounded-lg space-y-6">
                          <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                              <FormField control={diagnosisForm.control} name="piezasMasReales" render={({ field }) => (<FormItem><FormLabel>Piezas MÁS Reales por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={diagnosisForm.control} name="modoSimulacionTiempo" render={({ field }) => ( <FormItem><FormLabel>Simular Ahorro de Tiempo Por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar modo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="segundos">Segundos MENOS</SelectItem><SelectItem value="vc">Nueva Vc (m/min)</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                              <div> {watchedSimTimeMode === 'segundos' ? ( <FormField control={diagnosisForm.control} name="segundosMenosReales" render={({ field }) => (<FormItem><FormLabel>Segundos MENOS</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} /> ) : ( <FormField control={diagnosisForm.control} name="vcBReal" render={({ field }) => (<FormItem><FormLabel>Nueva Vc (B)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} /> )} </div>
                          </fieldset>
                          <div className="flex gap-4 items-center">
                            <Button type="button" onClick={diagnosisForm.handleSubmit(onNetSavingsSubmit)} variant="default" className="bg-green-600 hover:bg-green-700" disabled={isReadOnly}>Calcular Ahorro Neto Real</Button>
                          </div>
                           {netSavingsResult && (
                              <div className="mt-6 pt-6 border-t">
                                  <div className="text-center mb-6"><span className="text-lg font-medium text-gray-700">AHORRO NETO ANUAL:</span><div className={`text-5xl font-bold ${netSavingsResult.netAnnualSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrencyDisplay(netSavingsResult.netAnnualSavings)}</div></div>
                              </div>
                          )}
                      </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PESTAÑA 2: INFORME DETALLADO --- */}
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
                      {/* Datos del Informe */}
                      <div className="p-6 bg-white rounded-lg shadow-md border mb-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">Datos del Informe</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <FormField control={detailedForm.control} name="cliente" render={({ field }) => (<FormItem><FormLabel>Cliente</FormLabel><FormControl><Input placeholder="Nombre del Cliente" {...field} /></FormControl></FormItem>)}/>
                              <FormField control={detailedForm.control} name="fecha" render={({ field }) => (<FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
                              <FormField control={detailedForm.control} name="contacto" render={({ field }) => (<FormItem><FormLabel>Contacto</FormLabel><FormControl><Input placeholder="Persona de Contacto" {...field} /></FormControl></FormItem>)}/>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField control={detailedForm.control} name="operacion" render={({ field }) => (<FormItem><FormLabel>Operación</FormLabel><FormControl><Input placeholder="Ej: Fresado Frontal" {...field} /></FormControl></FormItem>)}/>
                              <FormField control={detailedForm.control} name="pieza" render={({ field }) => (<FormItem><FormLabel>Nombre de la Pieza</FormLabel><FormControl><Input placeholder="Ej: Soporte Motor" {...field} /></FormControl></FormItem>)}/>
                              <FormField control={detailedForm.control} name="material" render={({ field }) => (<FormItem><FormLabel>Tipo de Material</FormLabel><FormControl><Input placeholder="Ej: Acero Inoxidable 304" {...field} /></FormControl></FormItem>)}/>
                          </div>
                      </div>

                      {/* Datos Generales */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                          <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo de Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} onChange={e => { const val = parseFloat(e.target.value) || 0; field.onChange(val); syncDetailToDiag('machineHourlyRate', val); }} /></FormControl></FormItem>)}/>
                          <FormField control={detailedForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas/Mes</FormLabel><FormControl><Input type="number" {...field} onChange={e => { const val = parseFloat(e.target.value) || 0; field.onChange(val); syncDetailToDiag('piezasAlMes', val); }} /></FormControl></FormItem>)}/>
                          <FormField control={detailedForm.control} name="tiempoParada" render={({ field }) => (<FormItem><FormLabel>⏱️ Parada por Cambio (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                      </div>

                      {/* Comparativa A vs B */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="overflow-hidden">
                              <CardHeader className="bg-destructive/80 text-destructive-foreground p-4"><CardTitle>Inserto A (Actual)</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-4 pt-6">
                                  <FormField control={detailedForm.control} name="descA" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de 4 filos..." {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio de Compra (USD)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('precioA', val); }}/></FormControl></FormItem>)}/>
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="insertosPorHerramientaA" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)}/></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('filosA', val); }}/></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="modoVidaA" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                  {watchedModoVidaA === 'piezas' ? ( <FormField control={detailedForm.control} name="piezasFiloA" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('piezasFiloA', val); }}/></FormControl></FormItem>)}/> ) : ( <FormField control={detailedForm.control} name="minutosFiloA" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/> )}
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('cicloMinA', val); }}/></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('cicloSegA', val); }}/></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('vcA', val); }}/></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="notasA" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                              </CardContent>
                          </Card>
                          <Card className="overflow-hidden">
                              <CardHeader className="bg-primary/90 text-primary-foreground p-4"><CardTitle>Inserto B (Propuesta)</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-4 pt-6">
                                  <FormField control={detailedForm.control} name="descB" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de alta vel..." {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio de Compra (USD)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => { const val = e.target.value === '' ? '' : parseFloat(e.target.value); field.onChange(val); syncDetailToDiag('precioB', val); }}/></FormControl></FormItem>)}/>
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="insertosPorHerramientaB" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)}/></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="filosB" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="modoVidaB" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                  {watchedModoVidaB === 'piezas' ? ( <FormField control={detailedForm.control} name="piezasFiloB" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/> ) : ( <FormField control={detailedForm.control} name="minutosFiloB" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/> )}
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="cicloMinB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="cicloSegB" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="vcB" render={({ field }) => (<FormItem><FormLabel>Vc Propuesta (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="notasB" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                              </CardContent>
                          </Card>
                      </div>

                      {/* UPLOADER MEJORADO */}
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
                      {/* BOTÓN IMPRIMIR */}
                      <Button type="button" onClick={handlePrintReport} disabled={!detailedResult}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</Button>
                    </div>
                  }
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}