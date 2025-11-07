

'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import React, { useEffect, useState, useCallback } from "react";
import { Download, Save } from "lucide-react";
import { collection, serverTimestamp, doc, Timestamp, addDoc } from "firebase/firestore";


import { addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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
  SaveCaseSchema,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useFirestore, useUser } from "@/firebase/provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useRouter } from "next/navigation";

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
  ahorroPorPieza: number;

  // ROI y Performance
  roi: number;
  toolCostIncreasePercent: number;
  totalCostReductionPercent: number;
  timeReductionPercent: number;

  // Horas liberadas
  machineHoursFreedAnnual: number;
  machineHoursFreedValueAnnual: number;
  piezasAdicionalesAnual: number;
  diasLaboralesAhorradosAnual: number;
  semanasLaboralesAhorradasAnual: number;

  // Para tabla detallada
  piezasTotalA: number;
  piezasTotalB: number;
  tiempoCicloA: number;
  tiempoCicloB: number;
  minutosFiloA: number;
  minutosFiloB: number;
  costoParadaA: number;
  costoParadaB: number;
  insertosNecesariosA: number;
  insertosNecesariosB: number;
  costoTotalInsertosA: number;
  costoTotalInsertosB: number;
  
  // Para resumen financiero
  costoTotalMensualA: number;
  costoTotalMensualB: number;
  tiempoMaquinaMensualHorasA: number;
  tiempoMaquinaMensualHorasB: number;
  tiempoMaquinaMensualValorA: number;
  tiempoMaquinaMensualValorB: number;
  turnosMensualesA: number;
  turnosMensualesB: number;
  machineHoursFreedMonthly: number;
};

type DashboardTabsProps = {
  initialData?: any;
  isReadOnly?: boolean;
};

export default function DashboardTabs({ initialData, isReadOnly = false }: DashboardTabsProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [quickResult, setQuickResult] = useState<QuickDiagnosisResult | null>(null);
  const [netSavingsResult, setNetSavingsResult] = useState<NetSavingsResult | null>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedReportResult | null>(initialData?.results || null);
  const [isSaveAlertOpen, setSaveAlertOpen] = useState(false);

  const diagnosisForm = useForm<z.infer<typeof QuickDiagnosisSchema>>({
    resolver: zodResolver(QuickDiagnosisSchema),
    defaultValues: {
      costoHoraMaquina: 35,
      piezasAlMes: 2000,
      precioA: '' as any,
      filosA: '' as any,
      pzsPorFiloA: '' as any,
      cicloMinA: '' as any,
      cicloSegA: '' as any,
      vcA: '' as any,
      precioB: '' as any,
      piezasMasReales: 0,
      modoSimulacionTiempo: 'segundos',
      segundosMenosReales: 0,
      vcBReal: 0,
    },
  });

  const detailedForm = useForm<z.infer<typeof DetailedReportSchema>>({
    resolver: zodResolver(DetailedReportSchema),
     defaultValues: initialData || {
      cliente: "",
      fecha: new Date().toISOString().split('T')[0],
      contacto: "",
      operacion: "",
      pieza: "",
      material: "",
      status: "Pendiente",
      machineHourlyRate: 35,
      piezasAlMes: 2000,
      tiempoParada: 2,
      descA: "Herramienta Actual",
      precioA: '' as any,
      insertosPorHerramientaA: 1,
      filosA: '' as any,
      cicloMinA: '' as any,
      cicloSegA: '' as any,
      vcA: '' as any,
      modoVidaA: 'piezas',
      piezasFiloA: '' as any,
      minutosFiloA: 0,
      notasA: "",
      descB: "Herramienta Propuesta",
      precioB: '' as any,
      insertosPorHerramientaB: 1,
      filosB: '' as any,
      cicloMinB: '' as any,
      cicloSegB: '' as any,
      vcB: '' as any,
      modoVidaB: 'piezas',
      piezasFiloB: '' as any,
      minutosFiloB: 0,
      notasB: "",
    },
  });
  
  const saveCaseForm = useForm<z.infer<typeof SaveCaseSchema>>({
    resolver: zodResolver(SaveCaseSchema),
    defaultValues: {
      caseName: initialData?.name || "",
    },
  });


  const watchedDiagnosisData = useWatch({ control: diagnosisForm.control });
  const watchedDetailedData = useWatch({ control: detailedForm.control });

  const parseTimeToMinutes = (min: number | undefined, sec: number | undefined) => {
    const minVal = min || 0;
    const secVal = sec || 0;
    return minVal + (secVal / 60);
  }

  const syncForms = useCallback((sourceForm: 'diag' | 'detail', data: any) => {
    const diagValues = diagnosisForm.getValues();
    const detailValues = detailedForm.getValues();

    const mappings: {[key: string]: string} = {
      costoHoraMaquina: 'machineHourlyRate',
      piezasAlMes: 'piezasAlMes',
      precioA: 'precioA',
      precioB: 'precioB',
      filosA: 'filosA',
      pzsPorFiloA: 'piezasFiloA',
      cicloMinA: 'cicloMinA',
      cicloSegA: 'cicloSegA',
      vcA: 'vcA',
    };

    if (sourceForm === 'diag') {
        Object.entries(mappings).forEach(([diagKey, detailKey]) => {
            const value = data[diagKey];
             if (value !== undefined && String(value) !== String(detailedForm.getValues(detailKey as any))) {
                detailedForm.setValue(detailKey as any, value, { shouldValidate: true, shouldDirty: true });
            }
        });
    } else { // source === 'detail'
        Object.entries(mappings).forEach(([diagKey, detailKey]) => {
            const value = data[detailKey];
             if (value !== undefined && String(value) !== String(diagnosisForm.getValues(diagKey as any))) {
                diagnosisForm.setValue(diagKey as any, value, { shouldValidate: true, shouldDirty: true });
            }
        });
    }
  }, [diagnosisForm, detailedForm]);

  useEffect(() => {
    const subscription = diagnosisForm.watch((value, { name, type }) => {
        if (type === 'change' && name && Object.keys(value).includes(name)) {
            syncForms('diag', value);
        }
    });
    return () => subscription.unsubscribe();
  }, [diagnosisForm.watch, syncForms]);

  useEffect(() => {
    const subscription = detailedForm.watch((value, { name, type }) => {
      if (type === 'change' && name && Object.keys(value).includes(name)) {
            syncForms('detail', value);
        }
    });
    return () => subscription.unsubscribe();
  }, [detailedForm.watch, syncForms]);

    useEffect(() => {
    if (initialData) {
      detailedForm.reset(initialData);
      if (initialData.name) {
        saveCaseForm.reset({ caseName: initialData.name });
      }
    }
  }, [initialData, detailedForm, saveCaseForm]);

  function onQuickSubmit(data: z.infer<typeof QuickDiagnosisSchema>) {
    const { precioA, precioB, filosA, pzsPorFiloA, costoHoraMaquina, cicloMinA, cicloSegA, vcA } = data;
    
    if (!precioA || !precioB || !filosA || !pzsPorFiloA || !costoHoraMaquina || cicloMinA === undefined) {
        toast({ variant: "destructive", title: "Datos incompletos", description: "Por favor, complete todos los 'Datos de Partida' para el Paso 1." });
        setQuickResult(null);
        return;
    }
    
    const nA = (filosA || 1) * (pzsPorFiloA || 1);
    const tcA = parseTimeToMinutes(cicloMinA, cicloSegA);
    const cm = (costoHoraMaquina || 0) / 60;
    const deltaP = (precioB || 0) - (precioA || 0);

    if (costoHoraMaquina <= 0 || precioA < 0 || precioB < 0 || nA <= 0 || tcA <= 0) {
        toast({ variant: "destructive", title: "Datos inválidos", description: "Asegúrese que los valores de partida sean mayores o iguales a cero." });
        setQuickResult(null);
        return;
    }

    if (deltaP <= 0) {
        setQuickResult({
            breakEvenSeconds: 0,
            breakEvenPieces: 0,
            deltaP: deltaP,
            tcA: tcA,
            vcBTarget: vcA || 0,
            newCycleTimeTarget: tcA,
        });
        if (deltaP < 0) {
            toast({ variant: "default", title: "Precio B es menor", description: "El Precio B es menor que el Precio A. No hay sobrecosto que justificar." });
        } else {
             toast({ variant: "default", title: "Mismo Precio", description: "No hay sobrecosto que justificar. Cualquier mejora será un ahorro directo." });
        }
        return;
    }

    const nB_target = precioB * nA / precioA;
    const delta_N_filo = (nB_target / (filosA || 1)) - (pzsPorFiloA || 1);
    
    const delta_t_min = deltaP / (nA * cm);
    const breakEvenSeconds = delta_t_min * 60;
    const tcB_target = tcA - delta_t_min;

    let vcBTarget = 0;
    if (vcA && vcA > 0 && tcB_target > 0) {
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

    diagnosisForm.setValue('segundosMenosReales', parseFloat(breakEvenSeconds.toFixed(2)));
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
            diagnosisForm.setValue('vcBReal', parseFloat(actualVcB.toFixed(2)));
        }
    } else { // modo 'vc'
        if ((vcA || 0) <= 0 || (vcBReal || 0) <= 0 || vcBReal === vcA) {
            toast({ variant: "destructive", title: "Vc inválida", description: "Ingrese una Vc Actual y una Nueva Vc (distinta) para simular." });
            return;
        }
        tcB_real_min = tcA * ((vcA || 0) / (vcBReal || 1));
        diagnosisForm.setValue('segundosMenosReales', parseFloat(((tcA - tcB_real_min) * 60).toFixed(2)));
    }
     if (tcB_real_min <= 0) {
        toast({ variant: "destructive", title: "Tiempo de ciclo inválido", description: "El ahorro de segundos es mayor o igual al tiempo de ciclo actual." });
        return;
    }

    const nB_real = (filosA || 1) * ((pzsPorFiloA || 0) + (piezasMasReales || 0));
    if (nB_real <= 0) {
        toast({ variant: "destructive", title: "Rendimiento inválido", description: "El rendimiento de la herramienta B no puede ser cero o negativo." });
        return;
    }
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
    detailedForm.setValue("vcB", parseFloat(actualVcB.toFixed(2)));
    detailedForm.setValue("filosB", filosA || 0);
    detailedForm.setValue("modoVidaB", "piezas");
  }

  function onDetailedSubmit(data: z.infer<typeof DetailedReportSchema>) {
    const { machineHourlyRate, piezasAlMes, tiempoParada } = data;
    
    if (!machineHourlyRate || !piezasAlMes) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Por favor, complete los 'Datos Generales' del informe."});
      return;
    }
    
    const costoMin = machineHourlyRate / 60;

    // Tool A calculations
    const tcA = parseTimeToMinutes(data.cicloMinA, data.cicloSegA);
    let pzA = data.piezasFiloA || 0;
    let minA = data.minutosFiloA || 0;
    if (data.modoVidaA === 'minutos' && tcA > 0) {
        pzA = (data.minutosFiloA || 0) / tcA;
    } else if (tcA > 0) {
        minA = (data.piezasFiloA || 0) * tcA;
    }
    const piezasTotalA = (data.filosA || 1) * pzA;
    const costoHerramientaA = piezasTotalA > 0 ? ((data.precioA || 0) * (data.insertosPorHerramientaA || 1)) / piezasTotalA : 0;
    const costoParadaA = pzA > 0 ? ((tiempoParada || 0) * costoMin) / pzA : 0;
    const costoMaquinaA = (tcA * costoMin) + costoParadaA;
    const cppA = costoHerramientaA + costoMaquinaA;

    // Tool B calculations
    const tcB = parseTimeToMinutes(data.cicloMinB, data.cicloSegB);
    let pzB = data.piezasFiloB || 0;
    let minB = data.minutosFiloB || 0;
    if (data.modoVidaB === 'minutos' && tcB > 0) {
        pzB = (data.minutosFiloB || 0) / tcB;
    } else if (tcB > 0) {
        minB = (data.piezasFiloB || 0) * tcB;
    }
    const piezasTotalB = (data.filosB || 1) * pzB;
    const costoHerramientaB = piezasTotalB > 0 ? ((data.precioB || 0) * (data.insertosPorHerramientaB || 1)) / piezasTotalB : 0;
    const costoParadaB = pzB > 0 ? ((tiempoParada || 0) * costoMin) / pzB : 0;
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
    const roi = investment > 0 && ahorroAnual > 0 ? (ahorroAnual / investment) * 100 : (ahorroAnual > 0 ? Infinity : 0);
    
    // Time savings
    const annualParts = (piezasAlMes || 0) * 12;
    const tiempoAhorradoPorPiezaMin = tcA - tcB;
    const machineHoursFreedAnnual = (annualParts * tiempoAhorradoPorPiezaMin) / 60;
    const machineHoursFreedValueAnnual = machineHoursFreedAnnual * machineHourlyRate;
    const piezasAdicionalesAnual = tcB > 0 ? (machineHoursFreedAnnual * 60) / tcB : 0;
    const diasLaboralesAhorradosAnual = machineHoursFreedAnnual / 8; // 8-hour shifts
    const semanasLaboralesAhorradasAnual = diasLaboralesAhorradosAnual / 5; // 5-day weeks

    // For detailed table
    const insertosNecesariosA = piezasTotalA > 0 ? (piezasAlMes || 0) / piezasTotalA : 0;
    const insertosNecesariosB = piezasTotalB > 0 ? (piezasAlMes || 0) / piezasTotalB : 0;
    const costoTotalInsertosA = insertosNecesariosA * (data.precioA || 0);
    const costoTotalInsertosB = insertosNecesariosB * (data.precioB || 0);

    // For Financial Summary
    const costoTotalMensualA = cppA * (piezasAlMes || 0);
    const costoTotalMensualB = cppB * (piezasAlMes || 0);
    const tiempoMaquinaMensualHorasA = (tcA * (piezasAlMes || 0)) / 60;
    const tiempoMaquinaMensualHorasB = (tcB * (piezasAlMes || 0)) / 60;
    const machineHoursFreedMonthly = tiempoMaquinaMensualHorasA - tiempoMaquinaMensualHorasB;
    const tiempoMaquinaMensualValorA = tiempoMaquinaMensualHorasA * machineHourlyRate;
    const tiempoMaquinaMensualValorB = tiempoMaquinaMensualHorasB * machineHourlyRate;
    const turnosMensualesA = tiempoMaquinaMensualHorasA / 8;
    const turnosMensualesB = tiempoMaquinaMensualHorasB / 8;
    const timeReductionPercent = tcA > 0 ? ((tcA - tcB) / tcA) * 100 : 0;

    setDetailedResult({
        cppA, cppB, costoHerramientaA, costoHerramientaB, costoMaquinaA, costoMaquinaB,
        ahorroAnual, ahorroMensual, ahorroPorPieza,
        roi, toolCostIncreasePercent, totalCostReductionPercent,
        machineHoursFreedAnnual, machineHoursFreedValueAnnual, piezasAdicionalesAnual,
        diasLaboralesAhorradosAnual, semanasLaboralesAhorradasAnual,
        piezasTotalA: piezasTotalA,
        piezasTotalB: piezasTotalB,
        tiempoCicloA: tcA,
        tiempoCicloB: tcB,
        minutosFiloA: minA,
        minutosFiloB: minB,
        costoParadaA,
        costoParadaB,
        insertosNecesariosA,
        insertosNecesariosB,
        costoTotalInsertosA,
        costoTotalInsertosB,
        costoTotalMensualA,
        costoTotalMensualB,
        tiempoMaquinaMensualHorasA,
        tiempoMaquinaMensualHorasB,
        tiempoMaquinaMensualValorA,
        tiempoMaquinaMensualValorB,
        turnosMensualesA,
        turnosMensualesB,
        machineHoursFreedMonthly,
        timeReductionPercent,
    });
  }

  const handlePrint = () => {
    if (detailedResult) {
      window.print();
    } else {
      toast({
        variant: "destructive",
        title: "Informe no generado",
        description: "Primero debes generar el informe para poder imprimirlo.",
      });
    }
  };

  const handleSaveCase = async (caseName: string) => {
    if (!detailedResult) {
      toast({
        variant: "destructive",
        title: "No hay informe para guardar",
        description: "Primero debes generar un informe detallado.",
      });
      return;
    }
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes iniciar sesión para guardar un caso.",
      });
      return;
    }

    const formValues = detailedForm.getValues();
    const isExistingCase = !!initialData?.id;

    const historyEntry = {
      modifiedBy: user.uid,
      modifiedAt: new Date(), // Use client-side timestamp for history arrays
      snapshot: formValues, // Snapshot of the form state
    };
    
    const fullCaseData = {
      ...formValues,
      results: detailedResult,
      userId: user.uid,
      name: caseName,
      annualSavings: detailedResult.ahorroAnual,
      roi: detailedResult.roi,
      status: formValues.status || "Pendiente",
      ...(isExistingCase 
        ? { 
            dateModified: serverTimestamp(),
            modifiedBy: user.uid,
            history: [...(initialData.history || []), historyEntry],
          } 
        : { 
            dateCreated: serverTimestamp(),
            history: [historyEntry],
          }),
    };


    if (isExistingCase) {
      const caseDocRef = doc(firestore, "cuttingToolAnalyses", initialData.id);
      setDocumentNonBlocking(caseDocRef, fullCaseData, { merge: true });
    } else {
      const casesCollection = collection(firestore, "cuttingToolAnalyses");
      const docRef = await addDocumentNonBlocking(casesCollection, fullCaseData);
      
      // Create notification
      const notificationsCollection = collection(firestore, "notifications");
      await addDoc(notificationsCollection, {
          title: "Nuevo Caso de Éxito",
          message: `Se añadió un nuevo caso: "${caseName}"`,
          caseId: docRef?.id,
          createdAt: serverTimestamp(),
          readBy: [],
      });
    }
    
    toast({
      title: `Caso ${isExistingCase ? 'actualizado' : 'guardado'}`,
      description: `El caso "${caseName}" ha sido ${isExistingCase ? 'actualizado' : 'guardado'} con éxito.`,
    });
    setSaveAlertOpen(false);
    router.push('/cases');
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const formatMinutes = (timeInMinutes: number) => {
    const minutes = Math.floor(timeInMinutes);
    const seconds = Math.round((timeInMinutes - minutes) * 60);
    return `${minutes} min ${seconds} seg`;
  };

  const StatCard = ({ icon, title, value, description, valueClassName, isCompact = false }: { icon?: React.ReactNode, title: string, value: string, description?: string, valueClassName?: string, isCompact?: boolean }) => (
    <Card className={cn(isCompact && "print:p-1")}>
        <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isCompact ? "p-3 print:p-2" : "pb-2")}>
            <CardTitle className={cn("font-medium", isCompact ? "text-sm print:text-xs" : "text-base")}>{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent className={cn("p-3 pt-0", isCompact ? "print:p-2 print:pt-0" : "pt-0")}>
            <div className={cn("font-bold", isCompact ? "text-2xl print:text-xl" : "text-3xl", valueClassName)}>{value}</div>
            {description && <p className="text-xs text-muted-foreground print:text-[8pt]">{description}</p>}
        </CardContent>
    </Card>
  )

  const watchedSimTimeMode = useWatch({ control: diagnosisForm.control, name: 'modoSimulacionTiempo' });
  const watchedModoVidaA = useWatch({ control: detailedForm.control, name: 'modoVidaA' });
  const watchedModoVidaB = useWatch({ control: detailedForm.control, name: 'modoVidaB' });
  
  const handleNewCase = () => {
    detailedForm.reset({
      cliente: "",
      fecha: new Date().toISOString().split('T')[0],
      contacto: "",
      operacion: "",
      pieza: "",
      material: "",
      status: "Pendiente",
      machineHourlyRate: 35,
      piezasAlMes: 2000,
      tiempoParada: 2,
      descA: "Herramienta Actual",
      precioA: '' as any,
      insertosPorHerramientaA: 1,
      filosA: '' as any,
      cicloMinA: '' as any,
      cicloSegA: '' as any,
      vcA: '' as any,
      modoVidaA: 'piezas',
      piezasFiloA: '' as any,
      minutosFiloA: 0,
      notasA: "",
      descB: "Herramienta Propuesta",
      precioB: '' as any,
      insertosPorHerramientaB: 1,
      filosB: '' as any,
      cicloMinB: '' as any,
      cicloSegB: '' as any,
      vcB: '' as any,
      modoVidaB: 'piezas',
      piezasFiloB: '' as any,
      minutosFiloB: 0,
      notasB: "",
    });
    setDetailedResult(null);
    setQuickResult(null);
    setNetSavingsResult(null);
    saveCaseForm.reset({ caseName: "" });
    router.push('/dashboard');
  }

  return (
    <Tabs defaultValue={initialData ? "detailed" : "quick"} className="w-full">
      <TabsList className="grid w-full grid-cols-2 no-print">
        <TabsTrigger value="quick" disabled={isReadOnly}>1. Diagnóstico</TabsTrigger>
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
                <fieldset disabled={isReadOnly}>
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
                            <FormField control={diagnosisForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio Inserto ($)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 100" /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex space-x-2">
                               <FormField control={diagnosisForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 4" /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={diagnosisForm.control} name="pzsPorFiloA" render={({ field }) => (<FormItem><FormLabel>Pzs/Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 20" /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                             <div className="flex space-x-2">
                                <FormField control={diagnosisForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 1" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={diagnosisForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>Seg</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 30" /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={diagnosisForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 180" /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                        <div className="space-y-3">
                          <h4 className="font-medium text-accent mb-4">Datos Inserto B (Propuesta)</h4>
                            <FormField control={diagnosisForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio Inserto ($)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Ej: 150" /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                    </div>
                  </div>
                </fieldset>

                <Separator className="my-8" />

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold font-headline">Paso 1: ¿Cuánto <span className="text-primary">necesitamos</span> para justificar el costo?</h3>
                    <div className="p-6 border rounded-lg space-y-4">
                        <p className="text-sm text-muted-foreground">Calcula los objetivos mínimos (más piezas o menos tiempo) para compensar la diferencia de precio entre A y B.</p>
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onQuickSubmit)} disabled={isReadOnly}>Calcular Punto de Equilibrio</Button>
                         {quickResult && (
                            <div className="mt-6 pt-6 border-t">
                                {quickResult.deltaP > 0 ? (
                                    <>
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
                                    </>
                                ) : (
                                    <div className="text-center text-gray-600 p-4 bg-green-50 rounded-lg">
                                        <h4 className="font-semibold text-lg text-green-800">¡Buenas noticias!</h4>
                                        <p>El Precio B es igual o menor que el Precio A. No hay sobrecosto que justificar. Cualquier mejora resultará en un ahorro directo.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <Separator className="my-8" />
                
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold font-headline">Paso 2: ¿Cuánto <span className="text-green-600">vamos a ahorrar</span> realmente?</h3>
                     <div className="p-6 border rounded-lg space-y-6">
                        <p className="text-sm text-muted-foreground">Simula el ahorro neto total basado en tu propuesta real de mejora (puedes mejorar rendimiento, tiempo, o ambos).</p>
                        
                        <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
                        </fieldset>
                        
                        <Button type="button" onClick={diagnosisForm.handleSubmit(onNetSavingsSubmit)} variant="default" className="bg-green-600 hover:bg-green-700" disabled={isReadOnly}>Calcular Ahorro Neto Real</Button>
                         
                         {netSavingsResult && (
                            <div className="mt-6 pt-6 border-t">
                                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">💸 Resultado de la Simulación Real</h3>
                                <div className="text-center mb-6">
                                    <span className="text-lg font-medium text-gray-700">AHORRO NETO ANUAL:</span>
                                    <div className={`text-5xl font-bold ${netSavingsResult.netAnnualSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netSavingsResult.netAnnualSavings)}</div>
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3 text-center">Desglose del Ahorro</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                    <StatCard title="Costo/Pieza Actual (A)" value={formatCurrency(netSavingsResult.cppA)} />
                                    <StatCard title="Nuevo Costo/Pieza (B)" value={formatCurrency(netSavingsResult.cppB)} />
                                    <StatCard title="Ahorro Neto / Pieza" value={formatCurrency(netSavingsResult.savingsPerPiece)} />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3 text-center">Impacto en Producción</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                                    <StatCard title="Nuevo Tiempo de Ciclo" value={formatMinutes(netSavingsResult.newCycleTime)} />
                                    <StatCard title="Nuevo Rendimiento" value={`${netSavingsResult.newToolLife.toFixed(0)} pzs/filo`} />
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
          <CardHeader className="no-print flex-row justify-between items-center">
            <div>
              <CardTitle className="font-headline">Informe Detallado (A vs. B)</CardTitle>
              <CardDescription>
                Genera una comparación exhaustiva entre dos herramientas de corte. Los datos se sincronizan desde la pestaña de Diagnóstico.
              </CardDescription>
            </div>
            {!isReadOnly && <Button onClick={handleNewCase} variant="outline" size="sm">Nuevo Informe</Button>}
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...detailedForm}>
              <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-8 no-print">
                
                <fieldset disabled={isReadOnly}>
                    {/* Datos del Informe */}
                    <div className="p-6 bg-white rounded-lg shadow-md border">
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                        <FormField control={detailedForm.control} name="machineHourlyRate" render={({ field }) => (<FormItem><FormLabel>⚙️ Costo de Hora-Máquina ($)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                        <FormField control={detailedForm.control} name="piezasAlMes" render={({ field }) => (<FormItem><FormLabel>🏭 Piezas/Mes</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                        <FormField control={detailedForm.control} name="tiempoParada" render={({ field }) => (<FormItem><FormLabel>⏱️ Parada por Cambio (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>)}/>
                    </div>

                    {/* Comparativa A vs B */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Herramienta A */}
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-destructive/80 text-destructive-foreground p-4">
                                <CardTitle>Inserto A (Actual)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4 pt-6">
                                <FormField control={detailedForm.control} name="descA" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de 4 filos..." {...field} /></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="precioA" render={({ field }) => (<FormItem><FormLabel>Precio de Compra ($)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                <div className="flex space-x-2">
                                    <FormField control={detailedForm.control} name="insertosPorHerramientaA" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)}/></FormControl></FormItem>)}/>
                                    <FormField control={detailedForm.control} name="filosA" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                </div>
                                <FormField control={detailedForm.control} name="modoVidaA" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                {watchedModoVidaA === 'piezas' ? (
                                    <FormField control={detailedForm.control} name="piezasFiloA" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                ) : (
                                    <FormField control={detailedForm.control} name="minutosFiloA" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                                )}
                                <div className="flex space-x-2">
                                    <FormField control={detailedForm.control} name="cicloMinA" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                    <FormField control={detailedForm.control} name="cicloSegA" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                </div>
                                <FormField control={detailedForm.control} name="vcA" render={({ field }) => (<FormItem><FormLabel>Vc Actual (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="notasA" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                            </CardContent>
                        </Card>
                        {/* Herramienta B */}
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-primary/90 text-primary-foreground p-4">
                                <CardTitle>Inserto B (Propuesta)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4 pt-6">
                                <FormField control={detailedForm.control} name="descB" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Ej: Inserto de alta vel..." {...field} /></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="precioB" render={({ field }) => (<FormItem><FormLabel>Precio de Compra ($)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                <div className="flex space-x-2">
                                    <FormField control={detailedForm.control} name="insertosPorHerramientaB" render={({ field }) => (<FormItem><FormLabel>Insertos/Herr.</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)}/></FormControl></FormItem>)}/>
                                    <FormField control={detailedForm.control} name="filosB" render={({ field }) => (<FormItem><FormLabel>Filos/Inserto</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                </div>
                                <FormField control={detailedForm.control} name="modoVidaB" render={({ field }) => (<FormItem><FormLabel>Calcular Vida Útil por:</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="piezas">Piezas por Filo</SelectItem><SelectItem value="minutos">Minutos por Filo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                {watchedModoVidaB === 'piezas' ? (
                                    <FormField control={detailedForm.control} name="piezasFiloB" render={({ field }) => (<FormItem><FormLabel>Piezas por Filo</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                ) : (
                                    <FormField control={detailedForm.control} name="minutosFiloB" render={({ field }) => (<FormItem><FormLabel>Minutos por Filo</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>)}/>
                                )}
                                <div className="flex space-x-2">
                                    <FormField control={detailedForm.control} name="cicloMinB" render={({ field }) => (<FormItem><FormLabel>Ciclo (Min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                    <FormField control={detailedForm.control} name="cicloSegB" render={({ field }) => (<FormItem><FormLabel>(Seg)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                </div>
                                <FormField control={detailedForm.control} name="vcB" render={({ field }) => (<FormItem><FormLabel>Vc Propuesta (m/min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                                <FormField control={detailedForm.control} name="notasB" render={({ field }) => (<FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="No se imprime..." {...field} /></FormControl></FormItem>)}/>
                            </CardContent>
                        </Card>
                    </div>
                </fieldset>
                
                {!isReadOnly && 
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button type="submit">Generar Informe</Button>
                      <AlertDialog open={isSaveAlertOpen} onOpenChange={setSaveAlertOpen}>
                          <AlertDialogTrigger asChild>
                              <Button type="button" variant="secondary" disabled={!detailedResult}>
                                  <Save className="mr-2 h-4 w-4" />Guardar Caso
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Guardar Caso de Éxito</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      Ingresa un nombre para identificar este análisis en el futuro. Si el caso ya existe, los cambios se guardarán y se añadirá una entrada al historial.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Form {...saveCaseForm}>
                                  <form id="save-case-form" onSubmit={saveCaseForm.handleSubmit((data) => handleSaveCase(data.caseName))} className="space-y-4">
                                      <FormField
                                          control={saveCaseForm.control}
                                          name="caseName"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel>Nombre del Caso</FormLabel>
                                                  <FormControl>
                                                      <Input placeholder="Ej: Optimización Cliente X - Pieza Y" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </form>
                              </Form>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction type="submit" form="save-case-form">
                                      Guardar
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    <Button type="button" variant="secondary" onClick={handlePrint} disabled={!detailedResult}><Download className="mr-2 h-4 w-4" />Imprimir / Guardar PDF</Button>
                  </div>
                }
              </form>
            </Form>

            {detailedResult && (
                <div className="printable-area pt-6 border-t space-y-8">
                    <div className="cover-page">
                        <header className="flex justify-between items-start">
                            <div className="cover-logo">SECOCUT SRL</div>
                            <div className="text-right">
                                <h1 className="text-4xl font-bold text-primary">Análisis de Productividad</h1>
                                <p className="text-lg text-muted-foreground">Estudio de Costo por Pieza</p>
                            </div>
                        </header>
                        <div className="cover-content mt-24">
                            <div className="mb-8">
                                <p className="text-sm text-muted-foreground">Cliente</p>
                                <p className="text-2xl font-semibold">{detailedForm.getValues("cliente") || 'N/A'}</p>
                            </div>
                             <div className="mb-8">
                                <p className="text-sm text-muted-foreground">Fecha del Análisis</p>
                                <p className="text-2xl font-semibold">{new Date(detailedForm.getValues("fecha")?.replace(/-/g, '\/') || Date.now()).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-sm text-muted-foreground">Operación</p>
                                    <p className="text-2xl font-semibold">{detailedForm.getValues("operacion") || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Pieza</p>
                                    <p className="text-2xl font-semibold">{detailedForm.getValues("pieza") || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Material</p>
                                    <p className="text-2xl font-semibold">{detailedForm.getValues("material") || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                         <footer className="mt-24 pt-4 border-t text-center text-sm text-muted-foreground">
                            <p>Informe generado con la Herramienta de Productividad de SECOCUT SRL</p>
                            <p>Contacto: {detailedForm.getValues("contacto") || 'N/A'}</p>
                             <p className="text-lg font-bold text-primary mt-4">Se pueden conseguir Resultados o Excusas, no las dos cosas.</p>
                        </footer>
                    </div>
                    
                    <div className="report-content page-break-before space-y-8">
                        <div className="text-center">
                            <h3 className="text-3xl font-bold tracking-tight">Análisis de Costo por Pieza (CPP)</h3>
                            <p className="text-lg text-muted-foreground">Basado en {detailedForm.getValues("piezasAlMes")?.toLocaleString()} pzs/mes y un costo de {formatCurrency(detailedForm.getValues("machineHourlyRate"))}/hr</p>
                            <div className="mt-4">
                                <p className="text-xl font-medium text-foreground">{detailedResult.ahorroAnual > 0 ? 'AHORRO ANUAL PROYECTADO' : 'PÉRDIDA ANUAL PROYECTADA'}</p>
                                <p className={`text-6xl font-bold ${detailedResult.ahorroAnual > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(detailedResult.ahorroAnual)}</p>
                                <p className="text-xl text-muted-foreground mt-1">({formatCurrency(detailedResult.ahorroMensual)} / Mes)</p>
                            </div>
                        </div>
                        
                        <div className="my-6 no-break-inside">
                          <h3 className="text-xl font-bold text-center mb-4">Comparativa de Costo Total por Pieza</h3>
                          <div className="grid grid-cols-2 gap-4 md:gap-8 justify-items-center">
                              {/* Columna Actual */}
                              <div className="w-full max-w-xs flex flex-col items-center">
                                  <div className="text-2xl font-bold text-destructive">{formatCurrency(detailedResult.cppA)}</div>
                                  <div className="text-md font-semibold text-muted-foreground mb-2">Actual</div>
                                  <div className="w-full rounded-lg overflow-hidden shadow-md">
                                      <div className="bg-destructive text-destructive-foreground p-2 text-center">
                                          <div className="font-bold text-sm">Máquina</div>
                                          <div className="text-sm">{formatCurrency(detailedResult.costoMaquinaA)}</div>
                                      </div>
                                      <div className="bg-red-300 text-red-900 p-2 text-center">
                                          <div className="font-bold text-sm">Herram.</div>
                                          <div className="text-sm">{formatCurrency(detailedResult.costoHerramientaA)}</div>
                                      </div>
                                  </div>
                              </div>
                              {/* Columna Propuesta */}
                              <div className="w-full max-w-xs flex flex-col items-center">
                                  <div className="text-2xl font-bold text-primary">{formatCurrency(detailedResult.cppB)}</div>
                                  <div className="text-md font-semibold text-muted-foreground mb-2">Propuesta</div>
                                  <div className="w-full rounded-lg overflow-hidden shadow-md">
                                      <div className="bg-primary text-primary-foreground p-2 text-center">
                                          <div className="font-bold text-sm">Máquina</div>
                                          <div className="text-sm">{formatCurrency(detailedResult.costoMaquinaB)}</div>
                                      </div>
                                      <div className="bg-blue-300 text-blue-900 p-2 text-center">
                                          <div className="font-bold text-sm">Herram.</div>
                                          <div className="text-sm">{formatCurrency(detailedResult.costoHerramientaB)}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>


                        <div className="p-4 bg-muted rounded-lg no-break-inside section-spacing">
                            <h3 className="text-lg font-bold text-center mb-4">Análisis de Inversión vs. Ahorro</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        </div>

                        <div className="no-break-inside section-spacing">
                            <h3 className="text-lg font-bold text-center mb-4">Análisis de Horas de Máquina Liberadas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <StatCard 
                                    title="Piezas Adicionales Anuales"
                                    description={`Producibles en las horas liberadas`}
                                    value={detailedResult.piezasAdicionalesAnual.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    valueClassName="text-primary"
                                    isCompact
                                />
                            </div>
                        </div>
                        
                        <div className="mb-8 mt-8 no-break-inside compact-table section-spacing">
                          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Datos Detallados</h3>
                          <div className="overflow-x-auto rounded-lg border">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead className="font-semibold">Parámetro</TableHead>
                                          <TableHead className="text-center bg-destructive/10 text-destructive font-semibold">Inserto A (Actual)</TableHead>
                                          <TableHead className="text-center bg-primary/10 text-primary font-semibold">Inserto B (Propuesta)</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      <TableRow className="bg-muted/50"><TableCell colSpan={3} className="font-semibold text-muted-foreground">Datos del Inserto</TableCell></TableRow>
                                      <TableRow><TableCell>Descripción</TableCell><TableCell className="text-center">{detailedForm.getValues("descA")}</TableCell><TableCell className="text-center">{detailedForm.getValues("descB")}</TableCell></TableRow>
                                      <TableRow><TableCell>Precio del Inserto</TableCell><TableCell className="text-center">{formatCurrency(detailedForm.getValues("precioA") || 0)}</TableCell><TableCell className="text-center">{formatCurrency(detailedForm.getValues("precioB") || 0)}</TableCell></TableRow>
                                      <TableRow><TableCell>Filos por Inserto</TableCell><TableCell className="text-center">{detailedForm.getValues("filosA")}</TableCell><TableCell className="text-center">{detailedForm.getValues("filosB")}</TableCell></TableRow>
                                      <TableRow><TableCell>Vida por Filo (Minutos)</TableCell><TableCell className="text-center">{detailedResult.minutosFiloA.toFixed(2)} {detailedForm.getValues("modoVidaA") === 'minutos' ? '(input)' : '(calc.)'}</TableCell><TableCell className="text-center">{detailedResult.minutosFiloB.toFixed(2)} {detailedForm.getValues("modoVidaB") === 'minutos' ? '(input)' : '(calc.)'}</TableCell></TableRow>
                                      <TableRow><TableCell>Piezas por Filo</TableCell><TableCell className="text-center font-bold">{(detailedResult.piezasTotalA / (detailedForm.getValues("filosA") || 1)).toFixed(2)} {detailedForm.getValues("modoVidaA") === 'piezas' ? '(input)' : '(calc.)'}</TableCell><TableCell className="text-center font-bold">{(detailedResult.piezasTotalB / (detailedForm.getValues("filosB") || 1)).toFixed(2)} {detailedForm.getValues("modoVidaB") === 'piezas' ? '(input)' : '(calc.)'}</TableCell></TableRow>
                                      <TableRow><TableCell>Piezas Totales / Inserto</TableCell><TableCell className="text-center font-semibold">{detailedResult.piezasTotalA.toFixed(0)}</TableCell><TableCell className="text-center font-semibold">{detailedResult.piezasTotalB.toFixed(0)}</TableCell></TableRow>
                                      <TableRow><TableCell>Insertos Requeridos / Mes</TableCell><TableCell className="text-center">{detailedResult.insertosNecesariosA.toFixed(2)} ({formatCurrency(detailedResult.costoTotalInsertosA)})</TableCell><TableCell className="text-center">{detailedResult.insertosNecesariosB.toFixed(2)} ({formatCurrency(detailedResult.costoTotalInsertosB)})</TableCell></TableRow>
                                      <TableRow className="bg-muted/50"><TableCell className="font-bold">Costo Herramienta / Pieza</TableCell><TableCell className="text-center font-bold text-destructive">{formatCurrency(detailedResult.costoHerramientaA)}</TableCell><TableCell className="text-center font-bold text-primary">{formatCurrency(detailedResult.costoHerramientaB)}</TableCell></TableRow>
                                      
                                      <TableRow className="bg-muted/50"><TableCell colSpan={3} className="font-semibold text-muted-foreground">Datos del Proceso</TableCell></TableRow>
                                      <TableRow><TableCell>Tiempo de Ciclo (min)</TableCell><TableCell className="text-center">{detailedResult.tiempoCicloA.toFixed(3)} min</TableCell><TableCell className="text-center">{detailedResult.tiempoCicloB.toFixed(3)} min</TableCell></TableRow>
                                      <TableRow><TableCell>Velocidad de Corte (Vc)</TableCell><TableCell className="text-center">{detailedForm.getValues("vcA")} m/min</TableCell><TableCell className="text-center">{detailedForm.getValues("vcB")} m/min</TableCell></TableRow>
                                      <TableRow><TableCell>Costo Hora-Máquina</TableCell><TableCell colSpan={2} className="text-center">{formatCurrency(detailedForm.getValues("machineHourlyRate"))} ({formatCurrency(detailedForm.getValues("machineHourlyRate")/60)}/min)</TableCell></TableRow>
                                      <TableRow><TableCell>Parada por Cambio (costo/pza)</TableCell><TableCell className="text-center">{formatCurrency(detailedResult.costoParadaA)}</TableCell><TableCell className="text-center">{formatCurrency(detailedResult.costoParadaB)}</TableCell></TableRow>
                                      <TableRow className="bg-muted/50"><TableCell className="font-bold">Costo Máquina / Pieza</TableCell><TableCell className="text-center font-bold text-destructive">{formatCurrency(detailedResult.costoMaquinaA)}</TableCell><TableCell className="text-center font-bold text-primary">{formatCurrency(detailedResult.costoMaquinaB)}</TableCell></TableRow>

                                      <TableRow className="bg-foreground/10"><TableCell className="font-extrabold text-lg">COSTO TOTAL / PIEZA</TableCell><TableCell className="text-center font-extrabold text-lg text-destructive">{formatCurrency(detailedResult.cppA)}</TableCell><TableCell className="text-center font-extrabold text-lg text-primary">{formatCurrency(detailedResult.cppB)}</TableCell></TableRow>
                                  </TableBody>
                              </Table>
                          </div>
                        </div>
                        
                        <div className="no-break-inside section-spacing compact-table">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Resumen Financiero (para {detailedForm.getValues("piezasAlMes")?.toLocaleString()} piezas/mes)</h3>
                            <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead className="font-semibold">Métrica</TableHead>
                                    <TableHead>Inserto A (Actual)</TableHead>
                                    <TableHead>Inserto B (Propuesta)</TableHead>
                                    <TableHead className="bg-green-100/50 text-green-700">Ahorro</TableHead>
                                    <TableHead className="bg-green-100/50 text-green-700">% Mejora</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                <TableRow>
                                    <TableCell>Costo Total por Pieza</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.cppA)}</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.cppB)}</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{formatCurrency(detailedResult.ahorroPorPieza)}</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{detailedResult.totalCostReductionPercent.toFixed(1)}%</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Costo Total (Mensual)</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.costoTotalMensualA)}</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.costoTotalMensualB)}</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{formatCurrency(detailedResult.ahorroMensual)}</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{detailedResult.totalCostReductionPercent.toFixed(1)}%</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Tiempo de Máquina (Mensual)</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.tiempoMaquinaMensualValorA)} ({detailedResult.tiempoMaquinaMensualHorasA.toFixed(2)} hs)</TableCell>
                                    <TableCell>{formatCurrency(detailedResult.tiempoMaquinaMensualValorB)} ({detailedResult.tiempoMaquinaMensualHorasB.toFixed(2)} hs)</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{formatCurrency(detailedResult.machineHoursFreedValueAnnual / 12)} ({detailedResult.machineHoursFreedMonthly.toFixed(2)} hs)</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{detailedResult.timeReductionPercent.toFixed(1)}%</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Turnos de 8hs (Mensual)</TableCell>
                                    <TableCell>{detailedResult.turnosMensualesA.toFixed(2)} turnos</TableCell>
                                    <TableCell>{detailedResult.turnosMensualesB.toFixed(2)} turnos</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{(detailedResult.turnosMensualesA - detailedResult.turnosMensualesB).toFixed(2)} turnos liberados</TableCell>
                                    <TableCell className="font-semibold text-green-700 bg-green-100/50">{detailedResult.timeReductionPercent.toFixed(1)}%</TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/80">
                                    <TableCell className="font-bold">Costo Total (Anual)</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(detailedResult.costoTotalMensualA * 12)}</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(detailedResult.costoTotalMensualB * 12)}</TableCell>
                                    <TableCell className="font-bold text-lg text-green-700 bg-green-100/50">{formatCurrency(detailedResult.ahorroAnual)}</TableCell>
                                    <TableCell className="font-bold text-lg text-green-700 bg-green-100/50">{detailedResult.totalCostReductionPercent.toFixed(1)}%</TableCell>
                                </TableRow>
                                </TableBody>
                            </Table>
                            </div>
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
