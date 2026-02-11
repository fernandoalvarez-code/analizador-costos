'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState, useCallback } from "react";
import { Download, Save, Printer, Loader2 } from "lucide-react";
import { serverTimestamp, setDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

// Formato Moneda
const formatCurrency = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

const formatCurrencyDisplay = (value?: number) => {
    if (typeof value !== 'number' || !isFinite(value)) return 'N/A';
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value);
}

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
  
  // Estados para Logos y PDF
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [secoLogo, setSecoLogo] = useState<string | null>(null);
  const [isGeneratingQuickPDF, setIsGeneratingQuickPDF] = useState(false);

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
    if (firestore) {
        const unsub = onSnapshot(doc(firestore, "settings", "general"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.companyLogoUrl) setCompanyLogo(data.companyLogoUrl);
                if (data.secoLogoUrl) setSecoLogo(data.secoLogoUrl);
            }
        });
        return () => unsub();
    }
  }, [firestore]);

  useEffect(() => {
    if (initialData) {
      detailedForm.reset(initialData);
      diagnosisForm.reset({ costoHoraMaquina: initialData.machineHourlyRate, piezasAlMes: initialData.piezasAlMes, precioA: initialData.precioA, filosA: initialData.filosA, pzsPorFiloA: initialData.piezasFiloA, cicloMinA: initialData.cicloMinA, cicloSegA: initialData.cicloSegA, vcA: initialData.vcA, precioB: initialData.precioB, });
      if (initialData.name) { saveCaseForm.reset({ caseName: initialData.name }); }
      if (initialData.imageUrls) setKeptImageUrls(initialData.imageUrls);
      if (initialData.imageDescriptions) setImageDescriptions(initialData.imageDescriptions);
    }
  }, [initialData, detailedForm, diagnosisForm, saveCaseForm]);

  const watchedDiagnosisValues = useWatch({ control: diagnosisForm.control });

  const calculateRealTime = useCallback(() => {
    const data = diagnosisForm.getValues();
    const validation = QuickDiagnosisSchema.safeParse(data);
    
    if (!validation.success) {
      setQuickResult(null);
      setNetSavingsResult(null);
      return;
    }
    
    const validData = validation.data;
    
    // --- 1. CÁLCULO DE PUNTO DE EQUILIBRIO ---
    const { precioA, precioB, filosA, pzsPorFiloA, costoHoraMaquina, cicloMinA, cicloSegA, vcA } = validData;
    const nA = filosA * pzsPorFiloA;
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const cm = costoHoraMaquina / 60;
    const deltaP = precioB - precioA;

    if (nA <= 0 || tcA <= 0) {
        setQuickResult(null);
        setNetSavingsResult(null);
        return;
    }

    let breakEvenSeconds = 0;
    let breakEvenPieces = 0;
    let vcBTarget = vcA || 0;
    let newCycleTimeTarget = tcA;

    if (deltaP > 0) {
      const nB_target = precioB * nA / precioA;
      breakEvenPieces = (nB_target / filosA) - pzsPorFiloA;
      const delta_t_min = deltaP / (nA * cm);
      breakEvenSeconds = delta_t_min * 60;
      newCycleTimeTarget = tcA - delta_t_min;
      if (vcA && vcA > 0 && newCycleTimeTarget > 0) {
        vcBTarget = vcA * (tcA / newCycleTimeTarget);
      }
    }
    setQuickResult({ breakEvenSeconds, breakEvenPieces, deltaP, tcA, vcBTarget, newCycleTimeTarget });

    // --- 2. CÁLCULO DE AHORRO NETO ---
    const { piezasAlMes, piezasMasReales, modoSimulacionTiempo, segundosMenosReales, vcBReal } = validData;
    
    if (!piezasMasReales && !segundosMenosReales && (!vcBReal || vcBReal === 0 || vcBReal === vcA)) {
      setNetSavingsResult(null);
      return; 
    }

    const costoHerrA = precioA / nA;
    const costoMaqA = tcA * cm;
    const cppA = costoHerrA + costoMaqA;
    
    let tcB_real_min = 0;
    let actualVcB = vcBReal || 0;

    if (modoSimulacionTiempo === 'segundos') {
      tcB_real_min = tcA - ((segundosMenosReales || 0) / 60);
      if ((vcA || 0) > 0 && tcB_real_min > 0) {
        actualVcB = (vcA || 0) * (tcA / tcB_real_min);
      }
    } else { // 'vc' mode
      if ((vcA || 0) <= 0 || (vcBReal || 0) <= 0 || vcBReal === vcA) {
        setNetSavingsResult(null);
        return;
      }
      tcB_real_min = tcA * ((vcA || 0) / (vcBReal || 1));
    }

    if (tcB_real_min <= 0) {
      setNetSavingsResult(null);
      return;
    }

    const nB_real = filosA * (pzsPorFiloA + (piezasMasReales || 0));
    if (nB_real <= 0) {
      setNetSavingsResult(null);
      return;
    }

    const costoHerrB = precioB / nB_real;
    const costoMaqB = tcB_real_min * cm;
    const cppB = costoHerrB + costoMaqB;
    const savingsPerPiece = cppA - cppB;
    const netAnnualSavings = savingsPerPiece * piezasAlMes * 12;
    const improvementPercentage = cppA > 0 ? (savingsPerPiece / cppA) * 100 : 0;

    setNetSavingsResult({
        netAnnualSavings: isFinite(netAnnualSavings) ? netAnnualSavings : 0,
        cppA,
        cppB,
        savingsPerPiece,
        improvementPercentage,
        newCycleTime: tcB_real_min,
        newToolLife: pzsPorFiloA + (piezasMasReales || 0),
    });

    // --- 3. SINCRONIZAR CON FORMULARIO DETALLADO ---
    const newCicloMin = Math.floor(tcB_real_min);
    const newCicloSeg = Math.round((tcB_real_min - newCicloMin) * 60);
    detailedForm.setValue("cicloMinB", newCicloMin);
    detailedForm.setValue("cicloSegB", newCicloSeg);
    detailedForm.setValue("piezasFiloB", pzsPorFiloA + (piezasMasReales || 0));
    detailedForm.setValue("vcB", parseFloat(actualVcB.toFixed(2)));
    detailedForm.setValue("filosB", filosA);
    detailedForm.setValue("modoVidaB", "piezas");
    // Sync common fields
    detailedForm.setValue("precioA", precioA);
    detailedForm.setValue("filosA", filosA);
    detailedForm.setValue("piezasFiloA", pzsPorFiloA);
    detailedForm.setValue("cicloMinA", cicloMinA);
    detailedForm.setValue("cicloSegA", cicloSegA);
    detailedForm.setValue("vcA", vcA);
    detailedForm.setValue("precioB", precioB);
    detailedForm.setValue("machineHourlyRate", costoHoraMaquina);
    detailedForm.setValue("piezasAlMes", piezasAlMes);

  }, [diagnosisForm, detailedForm]);

  useEffect(() => {
    calculateRealTime();
  }, [watchedDiagnosisValues, calculateRealTime]);

  const handlePrintQuickDiagnosis = async () => {
    if (!quickResult) {
        toast({ variant: "destructive", title: "Sin datos", description: "Primero calcula el punto de equilibrio." });
        return;
    }
    
    setIsGeneratingQuickPDF(true);

    try {
        const html2pdf = (await import('html2pdf.js')).default;
        
        const template = document.getElementById('quick-diagnosis-template');
        if (!template) return;

        const clone = template.cloneNode(true) as HTMLElement;
        
        clone.id = 'temp-pdf-clone';
        clone.style.display = 'block';
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '0px';
        clone.style.width = '210mm';
        clone.style.zIndex = '-1000';
        clone.style.backgroundColor = 'white';

        document.body.appendChild(clone);

        const opt = {
            margin: 0,
            filename: `Diagnostico_Rapido_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: true,
                windowWidth: 1200 
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        await html2pdf().set(opt).from(clone).save();
        
        document.body.removeChild(clone);
        
    } catch (error) {
        console.error("Error PDF:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
        setIsGeneratingQuickPDF(false);
    }
  };

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

  return (
    <>
      <Tabs defaultValue={initialData ? "detailed" : "quick"} className="w-full">
        <TabsList className="grid w-full grid-cols-2 no-print">
          <TabsTrigger value="quick" disabled={isReadOnly}>1. Diagnóstico</TabsTrigger>
          <TabsTrigger value="detailed">2. Informe</TabsTrigger>
        </TabsList>
        
        <TabsContent value="quick">
            <Card>
            <CardHeader className="flex flex-row justify-between items-start">
              <div>
                <CardTitle className="font-headline">Diagnóstico Rápido</CardTitle>
                <CardDescription>Los resultados se actualizan en tiempo real.</CardDescription>
              </div>
              {quickResult && (
                  <Button onClick={handlePrintQuickDiagnosis} disabled={isGeneratingQuickPDF} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                      {isGeneratingQuickPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {isGeneratingQuickPDF ? 'Generando...' : 'Descargar PDF'}
                  </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...diagnosisForm}>
                <form className="space-y-8">
                  <fieldset disabled={isReadOnly}>
                    <h3 className="text-lg font-semibold mb-4 font-headline text-blue-800">Datos de Partida</h3>
                    <div className="p-6 border border-blue-200 bg-blue-50/50 rounded-lg space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={diagnosisForm.control} name="costoHoraMaquina" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={diagnosisForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas al Mes (aprox.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <h4 className="font-medium text-primary mb-4">Datos Inserto A (Actual)</h4>
                              <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio Inserto (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                              <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio Inserto (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                      </div>
                    </div>
                  </fieldset>

                  <Separator className="my-8" />

                  <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="text-xl font-semibold font-headline mb-4">Resultados del Diagnóstico</h3>
                    {quickResult ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold text-blue-700 mb-2">Punto de Equilibrio</h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card className="text-center"><CardHeader className="pb-2"><CardTitle className="text-base">Mejora de Rendimiento</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">+{quickResult.breakEvenPieces.toFixed(1)} pzs/filo</p><p className="text-xs text-muted-foreground mt-1">Para igualar costo</p></CardContent></Card>
                                    <Card className="text-center"><CardHeader className="pb-2"><CardTitle className="text-base">Mejora de Velocidad</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">-{quickResult.breakEvenSeconds.toFixed(2)} seg/pza</p><p className="text-xs text-muted-foreground mt-1">Para igualar costo</p></CardContent></Card>
                                </div>
                            </div>
                            {netSavingsResult && (
                                <div className="border-t pt-6">
                                    <h4 className="font-bold text-green-700 mb-2">Simulación de Ahorro Neto Anual</h4>
                                    <div className="text-center"><div className={`text-4xl font-bold ${netSavingsResult.netAnnualSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrencyDisplay(netSavingsResult.netAnnualSavings)}</div></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Introduce los datos de partida para ver los resultados.</p>
                    )}
                  </div>
                  
                  <Separator className="my-8" />

                  <div className="space-y-4">
                      <h3 className="text-xl font-semibold font-headline">Simulación de Ahorro Real</h3>
                       <div className="p-6 border rounded-lg space-y-6">
                          <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                              <FormField control={diagnosisForm.control} name="piezasMasReales" render={({ field }) => (<FormItem><FormLabel>Piezas MÁS por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={diagnosisForm.control} name="modoSimulacionTiempo" render={({ field }) => ( <FormItem><FormLabel>Simular por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar modo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="segundos">Segundos MENOS</SelectItem><SelectItem value="vc">Nueva Vc (m/min)</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                              <div> {watchedSimTimeMode === 'segundos' ? ( <FormField control={diagnosisForm.control} name="segundosMenosReales" render={({ field }) => (<FormItem><FormLabel>Segundos MENOS</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /> ) : ( <FormField control={diagnosisForm.control} name="vcBReal" render={({ field }) => (<FormItem><FormLabel>Nueva Vc (B)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /> )} </div>
                          </fieldset>
                      </div>
                  </div>
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

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                          <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo de Hora-Máquina (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                          <FormField control={detailedForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas/Mes</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                          <FormField control={detailedForm.control} name="tiempoParada" render={({ field }) => (<FormItem><FormLabel>⏱️ Parada por Cambio (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="overflow-hidden">
                              <CardHeader className="bg-destructive/80 text-destructive-foreground p-4"><CardTitle>Inserto A (Actual)</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-4 pt-6">
                                  <FormField control={detailedForm.control} name="descA" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de 4 filos..." {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio de Compra (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="insertosPorHerramientaA" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="modoVidaA" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                  {watchedModoVidaA === 'piezas' ? ( <FormField control={detailedForm.control} name="piezasFiloA" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> ) : ( <FormField control={detailedForm.control} name="minutosFiloA" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> )}
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="notasA" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                              </CardContent>
                          </Card>
                          <Card className="overflow-hidden">
                              <CardHeader className="bg-primary/90 text-primary-foreground p-4"><CardTitle>Inserto B (Propuesta)</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-4 pt-6">
                                  <FormField control={detailedForm.control} name="descB" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de alta vel..." {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio de Compra (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="insertosPorHerramientaB" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="filosB" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="modoVidaB" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                  {watchedModoVidaB === 'piezas' ? ( <FormField control={detailedForm.control} name="piezasFiloB" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> ) : ( <FormField control={detailedForm.control} name="minutosFiloB" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> )}
                                  <div className="flex space-x-2">
                                      <FormField control={detailedForm.control} name="cicloMinB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                      <FormField control={detailedForm.control} name="cicloSegB" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  </div>
                                  <FormField control={detailedForm.control} name="vcB" render={({ field }) => (<FormItem><FormLabel>Vc Propuesta (m/min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                  <FormField control={detailedForm.control} name="notasB" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                              </CardContent>
                          </Card>
                      </div>

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

      <div id="quick-diagnosis-template" style={{ display: 'none' }}>
        <div className="flex justify-between items-center mb-8 h-20 border-b-2 border-slate-800 pb-4">
            <div className="w-1/3 flex justify-start">{companyLogo ? (<img src={companyLogo} alt="Logo" className="h-16 object-contain" />) : null}</div>
            <div className="w-1/3 text-center"><h1 className="text-2xl font-black text-slate-800 uppercase leading-none">DIAGNÓSTICO<br/>RÁPIDO</h1></div>
            <div className="w-1/3 flex justify-end">{secoLogo ? (<img src={secoLogo} alt="Seco" className="h-14 object-contain" />) : null}</div>
        </div>

        <div className="mb-8">
            <h3 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-200 mb-4 pb-1">Datos Generales</h3>
            <div className="grid grid-cols-2 gap-8 text-sm">
                <div className="bg-slate-50 p-4 rounded border border-slate-200"><span className="block text-xs font-bold text-slate-500 uppercase">Costo Hora-Máquina</span><span className="text-xl font-bold">{formatCurrency(watchedFormValues.costoHoraMaquina)}</span></div>
                <div className="bg-slate-50 p-4 rounded border border-slate-200"><span className="block text-xs font-bold text-slate-500 uppercase">Piezas / Mes</span><span className="text-xl font-bold">{watchedFormValues.piezasAlMes?.toLocaleString()}</span></div>
            </div>
        </div>

        <div className="mb-8">
            <h3 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-200 mb-4 pb-1">Comparativa Técnica</h3>
            <div className="border border-slate-300 rounded overflow-hidden text-sm">
                <div className="grid grid-cols-3 bg-slate-100 font-bold border-b border-slate-300 py-2 px-4 text-center"><div>Parámetro</div><div className="text-red-600">Actual (A)</div><div className="text-blue-600">Propuesta (B)</div></div>
                <div className="grid grid-cols-3 border-b border-slate-200 py-2 px-4 text-center"><div>Precio Inserto</div><div>{formatCurrency(watchedFormValues.precioA)}</div><div>{formatCurrency(watchedFormValues.precioB)}</div></div>
                <div className="grid grid-cols-3 border-b border-slate-200 py-2 px-4 text-center"><div>Filos</div><div>{watchedFormValues.filosA}</div><div>{watchedFormValues.filosA}</div></div>
                <div className="grid grid-cols-3 border-b border-slate-200 py-2 px-4 text-center"><div>Piezas/Filo</div><div>{watchedFormValues.pzsPorFiloA}</div><div className="font-bold text-blue-600">{netSavingsResult?.newToolLife || '-'}</div></div>
                <div className="grid grid-cols-3 py-2 px-4 text-center bg-slate-50 font-bold"><div>Ciclo (min)</div><div>{watchedFormValues.cicloMinA}m {watchedFormValues.cicloSegA}s</div><div className="text-blue-600">{netSavingsResult?.newCycleTime?.toFixed(2) || '-'} min</div></div>
            </div>
        </div>

        {quickResult && (
            <div className="mb-8">
                <h3 className="text-sm font-bold text-blue-800 uppercase border-b border-blue-200 mb-4 pb-1">Análisis de Punto de Equilibrio</h3>
                <div className="grid grid-cols-2 gap-6">
                    <div className="border border-yellow-200 bg-yellow-50/50 p-4 rounded text-center">
                        <p className="text-xs font-bold text-yellow-700 uppercase mb-2">Para igualar costo por Rendimiento</p>
                        <p className="text-3xl font-black text-slate-800">+{quickResult.breakEvenPieces.toFixed(1)} <span className="text-sm font-normal text-slate-500">pzs/filo</span></p>
                    </div>
                    <div className="border border-blue-200 bg-blue-50/50 p-4 rounded text-center">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-2">Para igualar costo por Tiempo</p>
                        <p className="text-3xl font-black text-slate-800">-{quickResult.breakEvenSeconds.toFixed(1)} <span className="text-sm font-normal text-slate-500">seg/ciclo</span></p>
                    </div>
                </div>
            </div>
        )}

        {netSavingsResult && (
            <div className="mb-10">
                <h3 className="text-sm font-bold text-green-700 uppercase border-b border-green-200 mb-4 pb-1">Proyección de Ahorro Real</h3>
                <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
                    <p className="text-sm font-bold text-green-800 uppercase mb-2">Ahorro Neto Anual Estimado</p>
                    <p className="text-5xl font-black text-green-600">{formatCurrencyDisplay(netSavingsResult.netAnnualSavings)}</p>
                    <p className="text-xs text-green-700 mt-2 font-medium">Considerando {watchedFormValues.piezasAlMes?.toLocaleString()} piezas/mes</p>
                </div>
            </div>
        )}

        <div className="text-center mt-auto pt-8 border-t border-slate-200">
            <p className="text-sm font-bold text-slate-400 italic font-serif">"Se pueden conseguir Resultados o Excusas, no las dos cosas."</p>
            <p className="text-[10px] text-slate-300 mt-2 uppercase">Generado el {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </>
  );
}