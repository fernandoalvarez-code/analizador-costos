
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Share2, FileText, Wand2, ArrowLeft, Download, Flame, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatNumber, formatoMinutosYSegundos } from '@/lib/formatters';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { addDoc, collection, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, useUser } from "@/firebase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { MonthlySavingsSummary } from '@/components/calculator/MonthlySavingsSummary';


const MATERIALS = [
  { grupo: "ISO P", nombre: "Acero Bajo Carbono (Ej: 1010, 1020)", kc: 1500, dureza: "150 HB" },
  { grupo: "ISO P", nombre: "Acero Medio Carbono (Ej: 1045, 4140)", kc: 1800, dureza: "200 HB" },
  { grupo: "ISO P", nombre: "Acero Aleado / Cementación (Ej: 8620, 16MnCr5)", kc: 1700, dureza: "180 HB" },
  { grupo: "ISO P", nombre: "Acero Alta Aleación / Herramienta", kc: 2100, dureza: "300 HB" },
  { grupo: "ISO M", nombre: "Acero Inoxidable Austenítico (304, 316)", kc: 2200, dureza: "200 HB" },
  { grupo: "ISO M", nombre: "Acero Inox. Dúplex / Súper Dúplex", kc: 2600, dureza: "260 HB" },
  { grupo: "ISO K", nombre: "Fundición Gris (GG)", kc: 1200, dureza: "200 HB" },
  { grupo: "ISO K", nombre: "Fundición Nodular / Dúctil (GGG)", kc: 1500, dureza: "250 HB" },
  { grupo: "ISO N", nombre: "Aluminio / Aleaciones de Aluminio", kc: 700, dureza: "60 HB" },
  { grupo: "ISO N", nombre: "Latón / Bronce / Cobre", kc: 900, dureza: "100 HB" },
  { grupo: "ISO N", nombre: "Plásticos de Ingeniería (Nylon, Delrin)", kc: 300, dureza: "N/A" },
  { grupo: "ISO S", nombre: "Aleaciones de Titanio (Ej: Ti-6Al-4V)", kc: 2000, dureza: "350 HB" },
  { grupo: "ISO S", nombre: "Súper Aleaciones Base Níquel (Inconel)", kc: 2800, dureza: "400 HB" },
  { grupo: "ISO H", nombre: "Aceros Templados (> 45 HRC)", kc: 3500, dureza: "50+ HRC" }
];

const TAYLOR_CONSTANTS: Record<string, {n: number, C: number}> = {
  "ISO P": { n: 0.25, C: 250 }, "ISO M": { n: 0.20, C: 150 }, "ISO K": { n: 0.25, C: 200 },
  "ISO N": { n: 0.35, C: 900 }, "ISO S": { n: 0.18, C: 130 }, "ISO H": { n: 0.15, C: 120 },
};

const MATRIZ_ROMPEVIRUTAS: Record<string, any> = {
  "ME10": { desc: "Geometría Aguda Double Turbo" },
  "M12":  { desc: "Geometría Universal Double Turbo" }
};

const CALIDADES_SECO = {
  "MS2050": { tipo: "PVD", aplicacion: "Inox / Titanio", desc: "Grado de alta tenacidad" }
};

const dataDoubleTurbo: Record<string, Record<string, Record<string, number>>> = {
    "ISO P": {
        "ME10": { base: 0.14, medio: 0.16, fino: 0.24 },
        "M12":  { base: 0.16, medio: 0.18, fino: 0.28 }
    },
    "ISO M": {
        "ME10": { base: 0.14, medio: 0.16, fino: 0.24 },
    },
    "ISO K": {
        "M12": { base: 0.17, medio: 0.19, fino: 0.28 }
    },
    "ISO S": {
        "ME10": { base: 0.095, medio: 0.10, fino: 0.12 }
    }
};

const calcularFzSugerido = (ae: number | string, dc: number | string, materialSMG: string, rompeviruta: string) => {
  const ratio = (Number(ae) / Number(dc));
  if(isNaN(ratio) || ratio <= 0) return null;

  let nivel = "base"; // 100% ae
  if (ratio <= 0.15) nivel = "fino";    // <=15% ae
  else if (ratio <= 0.40) nivel = "medio"; // <=40% ae

  const materialData = MATERIALS.find(m => m.nombre === materialSMG);
  const materialGroup = materialData?.grupo;

  if (!materialGroup || !dataDoubleTurbo[materialGroup] || !dataDoubleTurbo[materialGroup][rompeviruta] || !dataDoubleTurbo[materialGroup][rompeviruta][nivel]) {
      return null;
  }
  return dataDoubleTurbo[materialGroup][rompeviruta][nivel];
};


const extraerRadioISO = (codigoInserto: string): number | null => {
  if (!codigoInserto) return null;
  const partePrincipal = codigoInserto.split('-')[0];
  const soloNumeros = partePrincipal.replace(/\D/g, '');
  if (soloNumeros.length >= 2) return parseInt(soloNumeros.slice(-2), 10) / 10;
  return null;
};

const analizarRompevirutas = (codigoInserto: string): { esWiper: boolean; tipoCorte: string; sufijo: string } => {
    if (!codigoInserto) return { esWiper: false, tipoCorte: 'Desconocido', sufijo: '' };
    const textoLimpio = codigoInserto.replace(/\s|-/g, '').toUpperCase();
    const match = textoLimpio.match(/\d{6}(.*)/);
    if (!match || !match[1]) return { esWiper: false, tipoCorte: 'Desconocido', sufijo: '' };
    const sufijo = match[1];
    const esWiper = sufijo.includes('W');
    let tipoCorte = 'Medio';
    if (sufijo.includes('F') || sufijo.includes('FF')) tipoCorte = 'Terminacion';
    else if (sufijo.includes('R') || sufijo.includes('RR')) tipoCorte = 'Desbaste';
    return { esWiper, tipoCorte, sufijo };
};

const auditarParametros = (ap: number | string, avance: number | string, codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  if (!radio || !ap || !avance) return null;
  const apNum = Number(ap);
  const avanceNum = Number(avance);
  if (apNum < radio) return `⚠️ Riesgo de Vibración: Tu ap (${apNum}mm) es menor al radio del inserto (${radio}mm). Las fuerzas radiales empujarán la pieza.`;
  if (avanceNum > (radio * 0.5)) return `⚠️ Avance Excesivo: Un avance de ${avanceNum} mm/rev es muy alto para un radio de ${radio}mm. Límite sugerido: ${(radio*0.5).toFixed(2)} mm/rev.`;
  return null;
};

const auditarAplicacion = (ap: number | string, codigoInserto: string): string | null => {
  if (!ap || !codigoInserto) return null;
  const { tipoCorte } = analizarRompevirutas(codigoInserto);
  const apNum = Number(ap);
  if (tipoCorte === 'Terminacion' && apNum > 1.5) return `⚠️ Cuidado: Estás usando un rompevirutas de Terminación con un ap de ${apNum}mm. La viruta se va a atascar y romperá el filo.`;
  if (tipoCorte === 'Desbaste' && apNum < 1.0) return `⚠️ Cuidado: Estás usando un rompevirutas de Desbaste Pesado para un corte muy fino (${apNum}mm). La viruta no va a romper y saldrá en hilos largos.`;
  return null;
};

const calcularRaTeorico = (avance: number | string, codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  const avanceNum = Number(avance);
  if (!avanceNum || !radio || radio <= 0) return null;
  let ra_micrones = (Math.pow(avanceNum, 2) / (32 * radio)) * 1000;
  const { esWiper } = analizarRompevirutas(codigoInserto);
  if (esWiper) ra_micrones = ra_micrones / 2; 
  return ra_micrones.toFixed(2);
};

const analizarInsertoFresado = (codigoInserto: string): { formaPlaquita: string, incidenciaPlaquita: string, geometriaFilo: string, alertaGeometria: string | null } | null => {
  if (!codigoInserto) return null;
  const textoLimpio = codigoInserto.toUpperCase().trim();
  const formaPlaquita = textoLimpio.charAt(0); 
  const incidenciaPlaquita = textoLimpio.charAt(1);
  let geometriaFilo = 'Media';
  let alertaGeometria = null;
  if (textoLimpio.includes('-D') || textoLimpio.includes('TN')) {
    geometriaFilo = 'Robusta / Negativa';
    alertaGeometria = '💡 Filo robusto detectado. Ideal para desbaste pesado o cortes interrumpidos. Consumirá más HP de la máquina.';
  } else if (textoLimpio.includes('-E') || textoLimpio.includes('-F')) {
    geometriaFilo = 'Viva / Positiva';
    alertaGeometria = '⚠️ Filo muy vivo y positivo. Excelente para acabados y bajo consumo de HP, pero frágil ante cortes interrumpidos.';
  }
  return { formaPlaquita, incidenciaPlaquita, geometriaFilo, alertaGeometria };
};

const auditarMaterialFresado = (codigoGrado: string, materialSeleccionado: string): string | null => {
  if (!codigoGrado || !materialSeleccionado) return null;
  const grado = codigoGrado.toUpperCase();
  const material = materialSeleccionado.toLowerCase();
  if (grado.includes('PCD') && (material.includes('acero') || material.includes('fundicion'))) return '❌ ERROR CRÍTICO: El PCD (Diamante) reacciona químicamente con el hierro a altas temperaturas. Solo usar en Aluminio, Plásticos o Titanio.';
  if (grado.includes('PCBN') && material.includes('aluminio')) return '⚠️ ALERTA DE COSTO: El PCBN es extremadamente caro y está diseñado para aceros templados >45HRC o fundición gris. Para aluminio, usa plaquitas no recubiertas (Ej: H15) o PCD.';
  if ((grado.includes('MP') || grado.includes('MK')) && (material.includes('titanio') || material.includes('inconel'))) return '💡 SUGERENCIA: Para Titanio se recomiendan calidades PVD (Ej: MS2050 o F15M) por su tenacidad de filo, no CVD.';
  return null;
};

const auditarBroca = (diametro?: number | string, profundidad?: number | string): string | null => {
  if (!diametro || !profundidad) return null;
  const numDiametro = Number(diametro);
  const numProfundidad = Number(profundidad);
  if (numDiametro <= 0 || numProfundidad <= 0) return null;
  const ratioL_D = numProfundidad / numDiametro;
  if (ratioL_D > 8) return '⚠️ Alerta de Profundidad (>8xD): Broca muy larga. Se requiere agujero piloto y reducir el avance (fn) un 20% al entrar para evitar que la broca flexe o se parta.';
  return null;
};

const calcularVf = (f: number | string, vc: number | string, d: number | string): number => {
    const numF = Number(f); const numVc = Number(vc); const numD = Number(d);
    if (numF <= 0 || numVc <= 0 || numD <= 0) return 0;
    const rpm = (numVc * 1000) / (Math.PI * numD);
    return numF * rpm;
};

const calcularQ = (opType: string, ap: string|number, ae: string|number, f: string|number, vc: string|number, dc: string|number, z: string|number) => {
  const numAp = Number(ap) || 0; const numF = Number(f) || 0; 
  const numVc = Number(vc) || 0; const numDc = Number(dc) || 0; 
  const numAe = Number(ae) || 0; const numZ = Number(z) || 1;

  if (opType === 'turning') {
     return numVc * numAp * numF;
  } else if (opType === 'milling') {
     if (numDc === 0) return 0;
     const rpm = (numVc * 1000) / (Math.PI * numDc);
     const vf = numF * numZ * rpm;
     return (numAp * numAe * vf) / 1000;
  } else if (opType === 'drilling') {
     if (numDc === 0) return 0;
     const rpm = (numVc * 1000) / (Math.PI * numDc);
     const vf = numF * rpm;
     return (Math.PI * Math.pow(numDc, 2) * vf) / 4000;
  }
  return 0;
};

const calcularEspesorViruta = (opType: string, f: string|number, ae: string|number, dc: string|number, ap: string|number, toolCode: string) => {
   const numF = Number(f) || 0; const numAe = Number(ae) || 0;
   const numDc = Number(dc) || 0; const numAp = Number(ap) || 0;
   const re = extraerRadioISO(toolCode) || 0.8;

   if (opType === 'milling') {
      if (numAe > 0 && numDc > 0 && numAe < (numDc / 2)) {
         return numF * Math.sqrt(numAe / numDc); 
      }
      return numF;
   } else if (opType === 'turning') {
      if (numAp > 0 && re > 0 && numAp < re) {
         return numF * Math.sqrt(numAp / re);
      }
      return numF * 0.996; 
   }
   return numF;
};

const SurveyField = ({ label }: { label: string }) => (
    <div className="flex justify-between items-end border-b-2 border-dotted border-slate-300 py-3">
        <span className="font-semibold text-slate-700">{label}:</span>
        <span className="flex-grow"></span>
    </div>
);

export default function TaylorCurvePage() {
  const { user } = useUser();
  const router = useRouter();

  const isInternalUser = user?.email?.endsWith('@secocut.com') || false;

  const [logos, setLogos] = useState({ company: '', brand: '' });

  const [operationType, setOperationType] = useState<'turning' | 'milling' | 'drilling'>('turning');
  const [materialId, setMaterialId] = useState('Acero Medio Carbono (Ej: 1045, 4140)'); 
  const [machineCostHr, setMachineCostHr] = useState<string | number>(35);
  const [toolChangeTime, setToolChangeTime] = useState<string | number>(2);
  const [pieceName, setPieceName] = useState<string>("");
  const [machinePowerHP, setMachinePowerHP] = useState<string | number>(15); 
  const [profundidadAgujero, setProfundidadAgujero] = useState<string | number>("");
  const [lifeModeCurrent, setLifeModeCurrent] = useState<'piezas' | 'minutos'>('piezas');
  const [lifeModePremium, setLifeModePremium] = useState<'piezas' | 'minutos'>('piezas');

  const [toolNameCurrent, setToolNameCurrent] = useState<string>("");
  const [toolCostCurrent, setToolCostCurrent] = useState<string | number>("");
  const [apCurrent, setApCurrent] = useState<string | number>("");
  const [feedCurrent, setFeedCurrent] = useState<string | number>("");
  const [vcCurrent, setVcCurrent] = useState<string | number>("");
  const [pcsCurrent, setPcsCurrent] = useState<string | number>("");
  const [tcCurrent, setTcCurrent] = useState<string | number>("");
  const [zCurrent, setZCurrent] = useState<string | number>("");
  const [edgesCurrent, setEdgesCurrent] = useState<string | number>("");
  const [dcCurrent, setDcCurrent] = useState<string | number>("");
  const [aeCurrent, setAeCurrent] = useState<string | number>("");
  
  const [toolNamePremium, setToolNamePremium] = useState<string>("");
  const [toolCostPremium, setToolCostPremium] = useState<string | number>("");
  const [apPremium, setApPremium] = useState<string | number>("");
  const [feedPremium, setFeedPremium] = useState<string | number>("");
  const [vcPremium, setVcPremium] = useState<string | number>("");
  const [pcsPremium, setPcsPremium] = useState<string | number>("");
  const [tcPremiumInput, setTcPremiumInput] = useState<string | number>("");
  const [zPremium, setZPremium] = useState<string | number>("");
  const [edgesPremium, setEdgesPremium] = useState<string | number>("");
  const [dcPremium, setDcPremium] = useState<string | number>("");
  const [aePremium, setAePremium] = useState<string | number>("");

  const [monthlyProduction, setMonthlyProduction] = useState<string | number>(0);
  const [horasPorTurno, setHorasPorTurno] = useState<string | number>(8);
  const [turnosPorDia, setTurnosPorDia] = useState<string | number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveCaseName, setSaveCaseName] = useState("");
  const [saveClientName, setSaveClientName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSurvey, setIsGeneratingSurvey] = useState(false);

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Hola, soy tu Copiloto Seco. Estoy analizando los parámetros de esta máquina. ¿En qué te ayudo?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [isTaylorModalOpen, setIsTaylorModalOpen] = useState(false);
  const [taylorBase, setTaylorBase] = useState({ vc: 0, feed: 0, pcs: 0, time: 0 });
  const [simulatedVc, setSimulatedVc] = useState(0);
  const [simulatedFeed, setSimulatedFeed] = useState(0);
  const [simulationResult, setSimulationResult] = useState<{ newPcs: number, newTime: number, newCost: number, newRa: string | null } | null>(null);
  const [taylorBaseCost, setTaylorBaseCost] = useState(0);
  const [targetSavings, setTargetSavings] = useState<string | number>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStressTestActive, setIsStressTestActive] = useState(false);

  const [hoveredData, setHoveredData] = useState<any | null>(null);

  const [suggestedCuttingData, setSuggestedCuttingData] = useState<{ap: string, fz: string, vc: string, notes: string} | null>(null);
  const [isFetchingCuttingData, setIsFetchingCuttingData] = useState(false);

  useEffect(() => {
    const isReadyForSuggestion = materialId && toolNamePremium && toolNamePremium.length > 2;
    if (!isReadyForSuggestion) {
      setSuggestedCuttingData(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsFetchingCuttingData(true);
      try {
        const response = await fetch('/api/suggest-cutting-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material: materialId, quality: '', toolDesc: toolNamePremium })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) setSuggestedCuttingData(data.data);
        }
      } catch (error) {
        console.error("Error fetching cutting data:", error);
      } finally {
        setIsFetchingCuttingData(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [materialId, toolNamePremium]);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const baseTc = Number(tcCurrent);
    const baseVc = Number(vcCurrent);
    const baseFeed = Number(feedCurrent);
    const baseAp = Number(apCurrent);

    const premVc = Number(vcPremium);
    const premFeed = Number(feedPremium);
    const premAp = Number(apPremium);

    if (baseTc > 0 && premVc > 0 && premFeed > 0 && premAp > 0) {
      
      const safeBaseVc = baseVc > 0 ? baseVc : premVc;
      const safeBaseFeed = baseFeed > 0 ? baseFeed : premFeed;
      const safeBaseAp = baseAp > 0 ? baseAp : premAp;

      const nuevoTiempoPremium = baseTc * (safeBaseVc / premVc) * (safeBaseFeed / premFeed) * (safeBaseAp / premAp);

      if (isFinite(nuevoTiempoPremium) && nuevoTiempoPremium > 0) {
          setTcPremiumInput(nuevoTiempoPremium.toFixed(2));
      }
    }
  }, [tcCurrent, vcCurrent, feedCurrent, apCurrent, vcPremium, feedPremium, apPremium]);

  useEffect(() => {
    if (operationType === 'drilling') {
      const vc = Number(vcCurrent);
      const d = Number(dcCurrent);
      const f = Number(feedCurrent);
      const l = Number(profundidadAgujero);

      if (vc > 0 && d > 0 && f > 0 && l > 0) {
        const rpm = (vc * 1000) / (Math.PI * d);
        const vf = f * rpm; 
        const tiempoMinutosDecimal = l / vf;

        if (isFinite(tiempoMinutosDecimal)) {
          setTcCurrent(tiempoMinutosDecimal.toFixed(4));
        }
      }
    }
  }, [operationType, vcCurrent, dcCurrent, feedCurrent, profundidadAgujero]);

  const raActual = calcularRaTeorico(feedCurrent, toolNameCurrent);
  const raPropuesta = calcularRaTeorico(feedPremium, toolNamePremium);

  const warningParamCurrent = auditarParametros(apCurrent, feedCurrent, toolNameCurrent);
  const warningAppCurrent = auditarAplicacion(apCurrent, toolNameCurrent);
  const warningCurrent = warningParamCurrent || warningAppCurrent;

  const warningParamPremium = auditarParametros(apPremium, feedPremium, toolNamePremium);
  const warningAppPremium = auditarAplicacion(apPremium, toolNamePremium);
  const warningPremium = warningParamPremium || warningAppPremium;

  const analisisFresaCurrent = useMemo(() => analizarInsertoFresado(toolNameCurrent), [toolNameCurrent]);
  const alertaMaterialCurrent = useMemo(() => auditarMaterialFresado(toolNameCurrent, materialId), [toolNameCurrent, materialId]);
  const warningFresaCurrent = alertaMaterialCurrent || analisisFresaCurrent?.alertaGeometria;

  const analisisFresaPremium = useMemo(() => analizarInsertoFresado(toolNamePremium), [toolNamePremium]);
  const alertaMaterialPremium = useMemo(() => auditarMaterialFresado(toolNamePremium, materialId), [toolNamePremium, materialId]);
  const warningFresaPremium = alertaMaterialPremium || analisisFresaPremium?.alertaGeometria;
  
  const warningBrocaCurrent = useMemo(() => auditarBroca(dcCurrent, profundidadAgujero), [dcCurrent, profundidadAgujero]);
  const warningBrocaPremium = useMemo(() => auditarBroca(dcPremium, profundidadAgujero), [dcPremium, profundidadAgujero]);

  const obtenerFactorIncidencia = (codigoInserto: string): number => {
    if (!codigoInserto || codigoInserto.length < 2) return 1.0;
    const segundaLetra = codigoInserto.charAt(1).toUpperCase();
    switch (segundaLetra) {
      case 'N': case 'O': return 1.00;
      case 'A': case 'B': case 'C': return 0.92;
      case 'P': case 'D': return 0.88;
      case 'E': case 'F': case 'G': return 0.85;
      default: return 1.00;
    }
  };

  const obtenerAnguloTexto = (codigoInserto: string): string => {
    if (!codigoInserto || codigoInserto.length < 2) return 'N/A';
    const segundaLetra = codigoInserto.charAt(1).toUpperCase();
    const angulos: Record<string, string> = {
      'N': '0° (Negativo)', 'A': '3°', 'B': '5°', 'C': '7°', 'P': '11°', 'D': '15°', 'E': '20°', 'F': '25°', 'G': '30°'
    };
    return angulos[segundaLetra] || 'Desconocido';
  };

  const obtenerFactorForma = (codigoInserto: string): number => {
    if (!codigoInserto || codigoInserto.length < 1) return 1.0;
    const primeraLetra = codigoInserto.charAt(0).toUpperCase();
    switch (primeraLetra) {
      case 'V': return 0.85;
      case 'D': return 0.90;
      case 'T': return 0.92;
      case 'E': case 'M': return 0.98;
      case 'C': case 'W': return 1.00;
      case 'S': case 'P': return 1.05;
      case 'R': return 1.10;
      default: return 1.00;
    }
  };

  React.useEffect(() => {
    const fetchLogos = async () => {
      try {
        const docRef = doc(db, "settings", "general"); 
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLogos({
            company: data.companyLogoUrl || '',
            brand: data.secoLogoUrl || ''
          });
        }
      } catch (error) {
        console.error("Error cargando logos para el PDF:", error);
      }
    };
    if (user) fetchLogos();
  }, [user]);

  const handleSaveCase = async () => {
    if (!user) { alert("Debes iniciar sesión para guardar."); return; }
    if (!saveCaseName.trim()) { alert("Por favor, ingresa un nombre para el caso."); return; }

    setIsSaving(true);
    
    try {
        const pdfBlob = await handleGeneratePDF('blob');
        let pdfUrl = '';

        if (pdfBlob instanceof Blob) {
            const storageRef = ref(storage, `analisis_costos_pdfs/${user.uid}_${Date.now()}.pdf`);
            const snapshot = await uploadBytes(storageRef, pdfBlob);
            pdfUrl = await getDownloadURL(snapshot.ref);
        }

        const docData = {
            userId: user.uid,
            
            // --- Campos de la tabla Dashboard (cuttingToolAnalyses) ---
            name: saveCaseName,
            cliente: saveClientName || "Sin Cliente",
            operacion: operationType || "N/A",
            material: materialId || "N/A",
            pieza: pieceName || "",
            roi: 0,
            status: "Pendiente",

            // --- Campos de la tabla Historial y generales ---
            clientName: saveClientName,
            caseName: saveCaseName,
            annualSavings: (curveDataInfo.realAbsoluteSavings * (Number(monthlyProduction) || 0)) * 12,
            pdfUrl: pdfUrl,
            dateCreated: serverTimestamp(),
            date: serverTimestamp(),
            taylorInputs: {
              operationType, materialId, machineCostHr, toolChangeTime, pieceName, machinePowerHP, profundidadAgujero,
              monthlyProduction, horasPorTurno, turnosPorDia, lifeModeCurrent, lifeModePremium,
              toolNameCurrent, toolCostCurrent, apCurrent, feedCurrent, vcCurrent, pcsCurrent, tcCurrent, zCurrent, edgesCurrent, dcCurrent, aeCurrent,
              toolNamePremium, toolCostPremium, apPremium, feedPremium, vcPremium, pcsPremium, tcPremiumInput, zPremium, edgesPremium, dcPremium, aePremium,
            },
        };
        
        const docRef = await addDoc(collection(db, "cuttingToolAnalyses"), docData);
        console.log("🔥 [TAYLOR] Documento real guardado en Firestore con ID:", docRef.id);
        
        alert(`Análisis "${saveCaseName}" guardado correctamente.`);
        setIsSaveModalOpen(false);

    } catch (error) {
        console.error("🔥 [TAYLOR ERROR] Error real de Firebase al guardar:", error);
        alert(`Error al guardar. ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
        setIsSaving(false);
    }
};

  const handleGeneratePDF = async (action: 'download' | 'share' | 'blob') => {
    setIsGenerating(true);
    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const a4Width = 210;

        const elementoPagina1 = document.getElementById('pdf-pagina-1');
        if (!elementoPagina1) throw new Error("Elemento 'pdf-pagina-1' no encontrado.");
        
        const canvas1 = await html2canvas(elementoPagina1, { scale: 2, useCORS: true, allowTaint: true });
        const imgData1 = canvas1.toDataURL('image/png');
        const imgHeight1 = (canvas1.height * a4Width) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', 0, 0, a4Width, imgHeight1);

        pdf.addPage();

        const elementoPagina2 = document.getElementById('pdf-pagina-2');
        if (!elementoPagina2) throw new Error("Elemento 'pdf-pagina-2' no encontrado.");

        const canvas2 = await html2canvas(elementoPagina2, { scale: 2, useCORS: true, allowTaint: true });
        const imgData2 = canvas2.toDataURL('image/png');
        const imgHeight2 = (canvas2.height * a4Width) / canvas2.width;
        pdf.addImage(imgData2, 'PNG', 0, 0, a4Width, imgHeight2);

        const fileName = `Reporte_Secocut_Analisis.pdf`;
        if (action === 'blob') {
          return pdf.output('blob');
        } else if (action === 'download') {
            pdf.save(fileName);
        } else {
            const pdfBlob = pdf.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: 'Reporte Secocut', files: [file] });
            } else {
                alert("Tu navegador no soporta la función de compartir. El archivo se descargará.");
                pdf.save(fileName);
            }
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error al procesar el PDF.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleGenerateSurveyPDF = async () => {
    setIsGeneratingSurvey(true);
    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const a4Width = 210;
        const element = document.getElementById('survey-pdf-content');
        if (!element) throw new Error("Elemento 'survey-pdf-content' no encontrado.");
        
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * a4Width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, a4Width, imgHeight);
        pdf.save(`Planilla_Relevamiento_${operationType}.pdf`);
    } catch (error) {
        console.error("Error generando planilla:", error);
        alert("Error al generar la planilla PDF.");
    } finally {
        setIsGeneratingSurvey(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    const radioCurrent = extraerRadioISO(toolNameCurrent);
    const radioPremium = extraerRadioISO(toolNamePremium);

    const chatPayload = {
      userMessage: userMessage,
      screenContext: {
        operationType: operationType,
        material: materialId,
        machine: {
          potencia_motor_hp: Number(machinePowerHP) || 0,
        },
        condicion_actual_competencia: {
          herramienta: toolNameCurrent,
          radio_punta_mm: radioCurrent,
          advertencia_fisica: warningCurrent,
          angulo_incidencia_iso: obtenerAnguloTexto(toolNameCurrent),
          profundidad_ap_mm: Number(apCurrent) || 0,
          vc: Number(vcCurrent) || 0,
          feed: Number(feedCurrent) || 0,
          carga_husillo_hp: curveDataInfo.hpCurrent,
          costPerPiece: curveDataInfo.actualCostCurrent
        },
        propuesta_seco: {
          herramienta: toolNamePremium,
          radio_punta_mm: radioPremium,
          advertencia_fisica: warningPremium,
          angulo_incidencia_iso: obtenerAnguloTexto(toolNamePremium),
          profundidad_ap_mm: Number(apPremium) || 0,
          vc: Number(vcPremium) || 0,
          feed: Number(feedPremium) || 0,
          carga_husillo_hp: curveDataInfo.hpPremium,
          costPerPiece: curveDataInfo.actualCostPremium
        }
      }
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload)
      });

      if (!response.ok) {
        let errorMsg = `Error HTTP: ${response.status}`;
        try {
           const errData = await response.json();
           errorMsg = errData.error || errData.message || errorMsg;
        } catch(e) { }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error de conexión: ${error instanceof Error ? error.message : 'Desconocido'}.` 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderChatMessage = (content: string) => {
    const tagRegex = /\[BOTON_ACCION:(\w+):([\d.]+)\]/g;
    
    if (content.search(tagRegex) === -1) return <p className="text-sm whitespace-pre-wrap">{content}</p>;

    const actions = Array.from(content.matchAll(tagRegex));
    const cleanText = content.replace(tagRegex, '').trim();

    const getVarName = (variable: string) => {
      if (variable === 'VC') return 'Vc';
      if (variable === 'AVANCE') return 'Avance';
      if (variable === 'AP') return 'ap';
      return variable;
    }

    return (
      <div className="space-y-2">
        {cleanText && <p className="text-sm whitespace-pre-wrap">{cleanText}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {actions.map((match, i) => {
            const variable = match[1];
            const value = match[2];
            
            return (
              <button
                key={i}
                onClick={() => {
                  if (variable === 'VC') setVcPremium(Number(value));
                  if (variable === 'AVANCE') setFeedPremium(Number(value));
                  if (variable === 'AP') setApPremium(Number(value));
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              >
                ✨ Aplicar {getVarName(variable)}: {value}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  
  const curveDataInfo = useMemo(() => {
    const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
    const safeToolCostCurrent = Number(toolCostCurrent) || 0;
    const safeToolCostPremium = Number(toolCostPremium) || 0;
    const safeToolChangeTime = Number(toolChangeTime) || 0;
    const safeTcCurrent = Number(tcCurrent) || 0;
    const safeTcPremium = Number(tcPremiumInput) || 0;
    const safeVcCurrent = Number(vcCurrent) || 0.0001;
    const vcPropuesta = Number(vcPremium) || 0.0001;
    const mat = MATERIALS.find(m => m.nombre === materialId) || MATERIALS[1];
    const taylorProps = TAYLOR_CONSTANTS[mat.grupo as keyof typeof TAYLOR_CONSTANTS] || { n: 0.25, C: 250 };
    
    const n = taylorProps.n;
    
    const vidaMinutosCompetidor = lifeModeCurrent === 'minutos' ? (Number(pcsCurrent) || 1) : ((Number(pcsCurrent) || 1) * safeTcCurrent);
    const constante_C_Competidor = safeVcCurrent > 0 && vidaMinutosCompetidor > 0 ? safeVcCurrent * Math.pow(vidaMinutosCompetidor, n) : 0;
    
    const vidaMinutosSeco = lifeModePremium === 'minutos' ? (Number(pcsPremium) || 1) : ((Number(pcsPremium) || 1) * safeTcPremium);
    const constante_C_Seco = vcPropuesta > 0 && vidaMinutosSeco > 0 ? vcPropuesta * Math.pow(vidaMinutosSeco, n) : 0;

    const kc = mat.kc || 1500;
    const safeMachinePowerHP = Number(machinePowerHP) || 15;
    let hpCurrent = 0, hpPremium = 0;
    const safeMonthlyProduction = Number(monthlyProduction) || 0;
    const safeEdgesCurrent = Number(edgesCurrent) || 1;
    const safeEdgesPremium = Number(edgesPremium) || 1;

    if (operationType === 'turning') {
        const safeFeedCurrent = Number(feedCurrent) || 0.0001, safeApCurrent = Number(apCurrent) || 0.0001;
        const kwCurrent_base = (safeApCurrent * safeFeedCurrent * safeVcCurrent * kc) / 60000;
        hpCurrent = kwCurrent_base * 1.341 * obtenerFactorForma(toolNameCurrent) * obtenerFactorIncidencia(toolNameCurrent);
        const kwPremium_base = (Number(apPremium) * Number(feedPremium) * vcPropuesta * kc) / 60000;
        hpPremium = kwPremium_base * 1.341 * obtenerFactorForma(toolNamePremium) * obtenerFactorIncidencia(toolNamePremium);
    } else if (operationType === 'milling') {
        const safeDcCurrent = Number(dcCurrent) || 0.0001, safeFzCurrent = Number(feedCurrent) || 0, safeZCurrentMilling = Number(zCurrent) || 1, safeApCurrent = Number(apCurrent) || 0, safeAeCurrent = Number(aeCurrent) || 0;
        const rpmCurrent = (safeVcCurrent * 1000) / (Math.PI * safeDcCurrent), vfCurrent = safeFzCurrent * safeZCurrentMilling * rpmCurrent;
        const rpmPremium = (vcPropuesta * 1000) / (Math.PI * (Number(dcPremium) || 0.0001)), vfPremium = (Number(feedPremium) || 0) * (Number(zPremium) || 1) * rpmPremium;
        const qCurrent = (safeApCurrent * safeAeCurrent * vfCurrent) / 1000, kwCurrent = (qCurrent * kc) / 60000;
        hpCurrent = (kwCurrent * 1.341) / 0.8;
        const qPremium = ((Number(apPremium) || 0) * (Number(aePremium) || 0) * vfPremium) / 1000, kwPremium = (qPremium * kc) / 60000;
        hpPremium = (kwPremium * 1.341) / 0.8;
    } else if (operationType === 'drilling') {
        const safeDcCurrent = Number(dcCurrent) || 0.0001, safeFnCurrent = Number(feedCurrent) || 0;
        const rpmCurrent = (safeVcCurrent * 1000) / (Math.PI * safeDcCurrent), vfCurrent = safeFnCurrent * rpmCurrent;
        const rpmPremium = (vcPropuesta * 1000) / (Math.PI * (Number(dcPremium) || 0.0001)), vfPremium = (Number(feedPremium) || 0) * rpmPremium;
        const qCurrent = (Math.PI * Math.pow(safeDcCurrent, 2) / 4) * vfCurrent / 1000, kwCurrent = (qCurrent * kc) / 60000;
        hpCurrent = (kwCurrent * 1.341) / 0.8;
        const qPremium = (Math.PI * Math.pow((Number(dcPremium) || 0.0001), 2) / 4) * vfPremium / 1000, kwPremium = (qPremium * kc) / 60000;
        hpPremium = (kwPremium * 1.341) / 0.8;
    }
    const loadCurrent = (hpCurrent / safeMachinePowerHP) * 100, loadPremium = (hpPremium / safeMachinePowerHP) * 100;
    
    let effectivePcsCurrent = lifeModeCurrent === 'piezas' ? (Number(pcsCurrent) || 1) : (safeTcCurrent > 0 ? (Number(pcsCurrent) || 0) / safeTcCurrent : 0);
    let effectivePcsPremium = lifeModePremium === 'piezas' ? (Number(pcsPremium) || 1) : (safeTcPremium > 0 ? (Number(pcsPremium) || 0) / safeTcPremium : 0);
    if (effectivePcsCurrent <= 0) effectivePcsCurrent = 1; 
    if (effectivePcsPremium <= 0) effectivePcsPremium = 1;
    
    const calcCostWithBreakdown = (v: number, isPremium: boolean, feed: number) => {
        const C = isPremium ? constante_C_Seco : constante_C_Competidor;
        if (C <= 0 || v <= 0) return { costoTotal: 0, costoMaquina: 0, costoInsertoPuro: 0, costoParada: 0, lifePcs: 0, hpReq: 0 };
    
        const toolPrice = isPremium ? safeToolCostPremium : safeToolCostCurrent;
        const z = isPremium ? (Number(zPremium) || 1) : (Number(zCurrent) || 1);
        const edges = isPremium ? safeEdgesPremium : safeEdgesCurrent;
        const ap = isPremium ? (Number(apPremium) || 0.0001) : (Number(apCurrent) || 0.0001);
    
        const baseTime = isPremium ? safeTcPremium : safeTcCurrent;
        const baseVc = isPremium ? vcPropuesta : safeVcCurrent;
        const tc = baseTime * (baseVc / v);
        
        const lifeMins = Math.pow((C / v), (1 / n));
        
        const costoMaquina = safeMachineCostMin * tc;
        const piecesPerToolLife = lifeMins > 0 ? lifeMins / tc : 0;
        const costPerEdge = edges > 0 ? toolPrice / edges : 0;

        const costoInsertoPuro = piecesPerToolLife > 0 ? (costPerEdge * z) / piecesPerToolLife : 0;
        const costoParada = piecesPerToolLife > 0 ? (safeToolChangeTime * safeMachineCostMin) / piecesPerToolLife : 0;
        
        const costoTotal = costoMaquina + costoInsertoPuro + costoParada;

        let hpReq = 0;
        const toolCode = isPremium ? toolNamePremium : toolNameCurrent;
        const dc = isPremium ? (Number(dcPremium) || 0.0001) : (Number(dcCurrent) || 0.0001);
        const ae = isPremium ? (Number(aePremium) || 0) : (Number(aeCurrent) || 0);

        if (operationType === 'turning') {
            const kw_base = (ap * feed * v * kc) / 60000;
            hpReq = kw_base * 1.341 * obtenerFactorForma(toolCode) * obtenerFactorIncidencia(toolCode);
        } else if (operationType === 'milling') {
            const rpm = (v * 1000) / (Math.PI * dc);
            const vf = feed * z * rpm;
            const q = (ap * ae * vf) / 1000;
            hpReq = ((q * kc) / 60000 * 1.341) / 0.8;
        } else if (operationType === 'drilling') {
            const rpm = (v * 1000) / (Math.PI * dc);
            const vf = feed * rpm;
            const q = (Math.PI * Math.pow(dc, 2) / 4) * vf / 1000;
            hpReq = ((q * kc) / 60000 * 1.341) / 0.8;
        }

        return { costoTotal, costoMaquina, costoInsertoPuro, costoParada, lifePcs: piecesPerToolLife, hpReq };
    };

    const calcEmpiricalCost = (tc: number, toolPrice: number, pcsPerEdge: number, z: number, edges: number) => {
        const costCorte = safeMachineCostMin * tc;
        const costPerEdge = edges > 0 ? toolPrice / edges : 0;
        const toolChangePenalty = (costPerEdge * z) + (safeToolChangeTime * safeMachineCostMin);
        const costoHerr = pcsPerEdge > 0 ? toolChangePenalty / pcsPerEdge : 0;
        return costCorte + costoHerr;
    };

    const speedsSet = new Set<number>();
    const C_for_range = taylorProps.C;
    for (let v = 50; v <= C_for_range * 1.5; v += 10) { speedsSet.add(v); }
    if (Number(vcCurrent) > 0) speedsSet.add(Number(vcCurrent)); if (Number(vcPremium) > 0) speedsSet.add(Number(vcPremium));
    const sortedSpeeds = Array.from(speedsSet).sort((a, b) => a - b);
    
    let minPremiumCost = Infinity;
    let optimalSpeed = 0;
    let hpLimitReached = false;

    const limiteTermicoActual = isStressTestActive ? taylorProps.C * 1.05 : null;

    const data = sortedSpeeds.map(v => {
        const resActual = calcCostWithBreakdown(v, false, Number(feedCurrent) || 0.0001);
        const resPremium = calcCostWithBreakdown(v, true, Number(feedPremium) || 0.0001);
        
        if (isStressTestActive && limiteTermicoActual && v >= limiteTermicoActual) {
            // Falla térmica catastrófica (colapso de filo)
            resActual.costoTotal = resActual.costoTotal * Math.pow((v / limiteTermicoActual), 6);
        }
        
        const objHpExcedido = resPremium.hpReq > safeMachinePowerHP;

        // Sólo actualizamos el óptimo si NO excede la potencia de la máquina.
        if (!objHpExcedido && resPremium.costoTotal < minPremiumCost && resPremium.costoTotal > 0) { 
            minPremiumCost = resPremium.costoTotal; 
            optimalSpeed = v; 
            hpLimitReached = false;
        } else if (objHpExcedido && resPremium.costoTotal < minPremiumCost) {
            hpLimitReached = true;
        }
        
        const multZ_Act = operationType === 'milling' ? (Number(zCurrent)||1) : 1;
        const multZ_Prem = operationType === 'milling' ? (Number(zPremium)||1) : 1;
        
        const insertosAct = resActual.lifePcs > 0 ? Math.ceil(safeMonthlyProduction / (resActual.lifePcs * safeEdgesCurrent)) * multZ_Act : 0;
        const insertosPrem = resPremium.lifePcs > 0 ? Math.ceil(safeMonthlyProduction / (resPremium.lifePcs * safeEdgesPremium)) * multZ_Prem : 0;

        return { 
          speed: v,
          costoActual: resActual.costoTotal,
          costoPremium: resPremium.costoTotal,
          desgloseActual: {
            maquina: resActual.costoMaquina,
            inserto: resActual.costoInsertoPuro,
            parada: resActual.costoParada,
            lote: insertosAct
          },
          desglosePremium: {
            maquina: resPremium.costoMaquina,
            inserto: resPremium.costoInsertoPuro,
            parada: resPremium.costoParada,
            lote: insertosPrem
          }
        };
    });
    
    const actualCostCurrent = calcEmpiricalCost(safeTcCurrent, safeToolCostCurrent, effectivePcsCurrent, (Number(zCurrent) || 1), safeEdgesCurrent);
    const actualCostPremium = calcEmpiricalCost(safeTcPremium, safeToolCostPremium, effectivePcsPremium, (Number(zPremium) || 1), safeEdgesPremium);
    
    const desgloseActualReal = {
        maquina: safeMachineCostMin * safeTcCurrent,
        inserto: effectivePcsCurrent > 0 ? ((safeToolCostCurrent / safeEdgesCurrent) * (operationType === 'milling' ? (Number(zCurrent)||1) : 1)) / effectivePcsCurrent : 0,
        parada: effectivePcsCurrent > 0 ? (safeToolChangeTime * safeMachineCostMin) / effectivePcsCurrent : 0,
        lote: effectivePcsCurrent > 0 ? Math.ceil(safeMonthlyProduction / (effectivePcsCurrent * safeEdgesCurrent)) * (operationType === 'milling' ? (Number(zCurrent)||1) : 1) : 0,
    };

    const desglosePremiumReal = {
        maquina: safeMachineCostMin * safeTcPremium,
        inserto: effectivePcsPremium > 0 ? ((safeToolCostPremium / safeEdgesPremium) * (operationType === 'milling' ? (Number(zPremium)||1) : 1)) / effectivePcsPremium : 0,
        parada: effectivePcsPremium > 0 ? (safeToolChangeTime * safeMachineCostMin) / effectivePcsPremium : 0,
        lote: effectivePcsPremium > 0 ? Math.ceil(safeMonthlyProduction / (effectivePcsPremium * safeEdgesPremium)) * (operationType === 'milling' ? (Number(zPremium)||1) : 1) : 0,
    };

    const realAbsoluteSavings = actualCostCurrent - actualCostPremium;
    const realSavingsPercentage = actualCostCurrent > 0 ? (realAbsoluteSavings / actualCostCurrent) * 100 : 0;
    const monthlySavings = isFinite(realAbsoluteSavings) ? realAbsoluteSavings * safeMonthlyProduction : 0;
    
    const qCurrent = calcularQ(operationType, apCurrent, aeCurrent, feedCurrent, vcCurrent, dcCurrent, zCurrent);
    const qPremium = calcularQ(operationType, apPremium, aePremium, feedPremium, vcPremium, dcPremium, zPremium);
    const hmCurrent = calcularEspesorViruta(operationType, feedCurrent, aeCurrent, dcCurrent, apCurrent, toolNameCurrent);
    const hmPremium = calcularEspesorViruta(operationType, feedPremium, aePremium, dcPremium, apPremium, toolNamePremium);

    return { data, actualCostCurrent, actualCostPremium, realAbsoluteSavings, realSavingsPercentage, tcPremium: safeTcPremium, monthlySavings, hpCurrent, hpPremium, loadCurrent, loadPremium, velocidadOptimaSeco: optimalSpeed, costoOptimoSeco: minPremiumCost, limitHpAlert: hpLimitReached, desgloseActualReal, desglosePremiumReal, qCurrent, qPremium, hmCurrent, hmPremium, limiteTermicoActual };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, apCurrent, apPremium, feedCurrent, feedPremium, vcCurrent, vcPremium, pcsCurrent, pcsPremium, tcCurrent, zCurrent, zPremium, edgesCurrent, edgesPremium, operationType, monthlyProduction, machinePowerHP, toolNameCurrent, toolNamePremium, dcCurrent, dcPremium, aeCurrent, aePremium, profundidadAgujero, lifeModeCurrent, lifeModePremium, tcPremiumInput, isStressTestActive]);

  useEffect(() => {
    if (!isTaylorModalOpen || !taylorBase || taylorBase.vc === 0 || taylorBase.feed === 0) {
        setSimulationResult(null);
        return;
    }

    const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
    const safeToolCostPremium = Number(toolCostPremium) || 0;
    const safeToolChangeTime = Number(toolChangeTime) || 0;
    const safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || 1);
    const safeEdgesPremium = Number(edgesPremium) || 1;
    const factorVelocidad = Math.pow((taylorBase.vc / simulatedVc), 3.0), factorAvance = Math.pow((taylorBase.feed / simulatedFeed), 1.5);
    
    const nuevasPzas = Math.round(taylorBase.pcs * factorVelocidad * factorAvance);
    const nuevoTiempoMin = taylorBase.time * (taylorBase.vc / simulatedVc) * (taylorBase.feed / simulatedFeed);
    
    const costCorte = safeMachineCostMin * nuevoTiempoMin;
    const costPerPunta = safeEdgesPremium > 0 ? safeToolCostPremium / safeEdgesPremium : 0;
    const costJuego = costPerPunta * safeZPremium;
    
    const penalidadCambio = costJuego + (safeToolChangeTime * safeMachineCostMin);
    
    let costoHerr = 0;
    if (lifeModePremium === 'minutos') {
        const piecesPerToolLife = nuevasPzas > 0 ? nuevasPzas / nuevoTiempoMin : 0;
        costoHerr = piecesPerToolLife > 0 ? penalidadCambio / piecesPerToolLife : 0;
    } else {
        costoHerr = nuevasPzas > 0 ? penalidadCambio / nuevasPzas : 0;
    }

    const nuevoCosto = costCorte + costoHerr;
    const nuevoRa = calcularRaTeorico(simulatedFeed, toolNamePremium);
    setSimulationResult({ newPcs: nuevasPzas, newTime: nuevoTiempoMin, newCost: nuevoCosto, newRa: nuevoRa });
  }, [simulatedVc, simulatedFeed, taylorBase, isTaylorModalOpen, machineCostHr, toolCostPremium, toolChangeTime, operationType, zPremium, edgesPremium, toolNamePremium, lifeModePremium]);

  useEffect(() => {
    const percentage = Number(targetSavings);
    if (!percentage || percentage <= 0 || !isTaylorModalOpen || taylorBaseCost <= 0) return;

    const autoCalcularPorObjetivo = () => {
      const costoObjetivo = taylorBaseCost * (1 - (percentage / 100));
      let vcSimulada = taylorBase.vc, costoIterativo = taylorBaseCost;
      const limiteSeguridadVc = taylorBase.vc * 2;
      const safeMachineCostMin = (Number(machineCostHr) || 0) / 60, safeToolCostPremium = Number(toolCostPremium) || 0, safeToolChangeTime = Number(toolChangeTime) || 0, safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || 1), safeEdgesPremium = Number(edgesPremium) || 1;
      const costPerPunta = safeEdgesPremium > 0 ? safeToolCostPremium / safeEdgesPremium : 0, costJuego = costPerPunta * safeZPremium;
      const penalidadCambio = costJuego + (safeMachineCostMin * safeToolChangeTime);

      while (costoIterativo > costoObjetivo && vcSimulada < limiteSeguridadVc) {
        vcSimulada++;
        const factorVelocidad = Math.pow((taylorBase.vc / vcSimulada), 3.0);
        const piezasTemp = taylorBase.pcs * factorVelocidad, tiempoTemp = taylorBase.time * (taylorBase.vc / vcSimulada);
        const costCorte = safeMachineCostMin * tiempoTemp;
        
        let costHerr = 0;
        if (lifeModePremium === 'minutos') {
            const pzasTempLife = piezasTemp > 0 ? piezasTemp / tiempoTemp : 0;
            costHerr = pzasTempLife > 0 ? penalidadCambio / pzasTempLife : 0;
        } else {
            costHerr = piezasTemp > 0 ? penalidadCambio / piezasTemp : 0;
        }

        costoIterativo = costCorte + costHerr;
      }

      if (vcSimulada < limiteSeguridadVc) {
        setSimulatedVc(vcSimulada);
        setSimulatedFeed(taylorBase.feed);
      } else {
        alert("El porcentaje de ahorro deseado es físicamente imposible solo aumentando la velocidad. Intenta un objetivo más bajo o ajusta también el avance.");
      }
    };
    const debounceTimer = setTimeout(autoCalcularPorObjetivo, 500);
    return () => clearTimeout(debounceTimer);
  }, [targetSavings, isTaylorModalOpen, taylorBase.vc, taylorBase.feed, taylorBase.pcs, taylorBase.time, taylorBaseCost, machineCostHr, toolCostPremium, toolChangeTime, operationType, zPremium, edgesPremium, lifeModePremium]);

  const premiumMins = Math.floor(curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0);
  const premiumSecs = Math.round(((curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0) - premiumMins) * 60);
  const porcentajeAhorro = curveDataInfo.realSavingsPercentage.toFixed(1);

  const getLoadColor = (load: number) => {
      if (load < 20) return { bar: 'bg-red-500', text: 'text-red-700', label: 'Subutilizado (Sube Avance)' };
      if (load <= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Óptimo / Seguro' };
      if (load <= 95) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Desbaste Pesado' };
      return { bar: 'bg-red-600 animate-pulse', text: 'text-red-800 font-black', label: '¡PELIGRO: Sobrecarga!' };
  };
  
  const materialGroups = MATERIALS.reduce((acc, mat) => {
      (acc[mat.grupo] = acc[mat.grupo] || []).push(mat);
      return acc;
  }, {} as Record<string, typeof MATERIALS>);

  const porcentajeAhorroSimulado = taylorBaseCost > 0 && simulationResult ? (((taylorBaseCost - simulationResult.newCost) / taylorBaseCost) * 100) : 0;
  
  const insightText = useMemo(() => {
      const { velocidadOptimaSeco, costoOptimoSeco, limitHpAlert } = curveDataInfo;
      const numVcCurrent = Number(vcCurrent);
      if (!numVcCurrent || !velocidadOptimaSeco || !costoOptimoSeco) return null;
      
      let mensajeBase = "";
      if (numVcCurrent < velocidadOptimaSeco) {
          mensajeBase = `💡 Tu máquina está subutilizada. Si subimos la velocidad de ${numVcCurrent} a ${velocidadOptimaSeco} m/min con el inserto Seco, alcanzarás el costo mínimo absoluto de ${formatCurrency(costoOptimoSeco)} por pieza.`;
      } else if (numVcCurrent > velocidadOptimaSeco + 10) { 
          mensajeBase = `⚠️ Estás quemando insertos. Bajando la velocidad a ${velocidadOptimaSeco} m/min con Seco, extenderás la vida útil drásticamente y bajarás tu costo a ${formatCurrency(costoOptimoSeco)}.`;
      } else {
          mensajeBase = `✅ ¡Estás muy cerca del punto óptimo! Mantener la velocidad alrededor de ${velocidadOptimaSeco} m/min te asegura la máxima eficiencia y rentabilidad.`;
      }

      if (limitHpAlert) {
          mensajeBase += ` 🔴 Atención: La velocidad teórica más óptima fue limitada porque excedía los ${machinePowerHP} HP de tu máquina.`;
      }

      return mensajeBase;
  }, [curveDataInfo, vcCurrent, machinePowerHP]);

  const unidadVidaUtil = lifeModePremium === 'minutos' ? 'minutos' : (operationType === 'drilling' ? 'agujeros' : 'pzas/filo');

  if (isLoading) {
    return <div className="container mx-auto p-8"><Skeleton className="w-full h-[600px]" /></div>;
  }
  
  const getHmColorClass = (hm: number) => {
    if (hm < 0.05) return "text-orange-500";
    if (hm > 0.25) return "text-red-600";
    return "text-emerald-600";
  };

  const qActual = calcularQ(operationType, apCurrent, aeCurrent, feedCurrent, vcCurrent, dcCurrent, zCurrent);
  const hmActual = calcularEspesorViruta(operationType, feedCurrent, aeCurrent, dcCurrent, apCurrent, toolNameCurrent);

  const qPropuesta = calcularQ(operationType, apPremium, aePremium, feedPremium, vcPremium, dcPremium, zPremium);
  const hmPropuesta = calcularEspesorViruta(operationType, feedPremium, aePremium, dcPremium, apPremium, toolNamePremium);

  const calculateIncidence = (partCost: number, totalCost: number) => {
    if (!totalCost || totalCost === 0 || isNaN(partCost) || isNaN(totalCost)) return "0.0";
    return ((partCost / totalCost) * 100).toFixed(1); 
  };

  const renderSafeNumber = (value: number | string | undefined | null, decimals: number = 1, suffix: string = '', cssClass: string = '') => {
      const num = Number(value);
      if (value === undefined || value === null || isNaN(num) || !isFinite(num) || num < 0) {
          return <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap leading-none"><AlertTriangle className="h-3 w-3" /> Ajustar parámetros</span>;
      }
      return <span className={cssClass}>{num.toFixed(decimals)}{suffix ? ` ${suffix}` : ''}</span>;
  };


  return (
    <>
      <div className={`container mx-auto space-y-8 pb-16 transition-all duration-300 ${isCopilotOpen ? 'pr-[320px]' : ''}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 h-10 w-10">
                <ArrowLeft />
            </Button>
            <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <TrendingUp className="text-blue-600 h-7 w-7" />
                Editar Análisis de Costos
            </h1>
            <p className="text-slate-500 text-sm mt-1">Ajusta los parámetros para refinar tu análisis.</p>
            </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={() => handleGeneratePDF('download')}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳ Generando...</span> : <>
              <FileText size={16} />
              PDF
            </>}
          </button>
          
          <button
            onClick={() => handleGeneratePDF('share')}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {isGenerating ? <span className="animate-pulse">⏳...</span> : <>
              <Share2 size={16} />
              WhatsApp
            </>}
          </button>
          <button
            onClick={() => {
              setSaveCaseName(pieceName);
              setIsSaveModalOpen(true);
            }}
            disabled={isSaving}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Guardar Análisis
          </button>
        </div>
      </div>

      <div className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h2 className="font-black text-slate-800 text-sm uppercase border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              🏭 1. Parámetros del Taller
            </h2>
            
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mb-2">
              <button onClick={() => setOperationType('turning')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'turning' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>🔄 Torneado</button>
              <button onClick={() => setOperationType('milling')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'milling' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>⚙️ Fresado</button>
              <button onClick={() => setOperationType('drilling')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'drilling' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>🔩 Taladrado</button>
            </div>
            <div className="text-center mb-4">
                <Button variant="link" size="sm" onClick={handleGenerateSurveyPDF} disabled={isGeneratingSurvey} className="text-slate-600">
                    <Download className="mr-2 h-4 w-4" />
                    {isGeneratingSurvey ? 'Generando...' : 'Descargar Planilla de Relevamiento'}
                </Button>
            </div>

            
            <div className="space-y-4 flex-grow">
              <div>
                <Label className="block text-xs font-bold text-slate-500 mb-1">Pieza / Operación</Label>
                <Input type="text" placeholder="Ej: Eje principal" className="w-full bg-slate-50 text-slate-900" value={pieceName} onChange={e => setPieceName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="block text-xs font-bold text-slate-500 mb-1">Material</Label>
                  <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger className="w-full bg-slate-50 text-slate-900"><SelectValue placeholder="Selecciona un material" /></SelectTrigger>
                    <SelectContent>
                        {Object.entries(materialGroups).map(([groupName, materials]) => (
                            <SelectGroup key={groupName}>
                                <SelectLabel>{groupName}</SelectLabel>
                                {materials.map(m => <SelectItem key={m.nombre} value={m.nombre}>{m.nombre}</SelectItem>)}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {operationType === 'drilling' && (
                    <div className="col-span-2">
                        <Label className="block text-xs font-bold text-slate-500 mb-1">Profundidad del Agujero (mm)</Label>
                        <Input type="number" min="0" className="bg-white text-slate-900 border-slate-200 transition-colors focus:border-blue-400" value={profundidadAgujero} onChange={e => setProfundidadAgujero(e.target.value)} />
                        <p className="text-[9px] text-slate-400 mt-0.5">Ratio L/D</p>
                    </div>
                )}
                <div>
                  <Label className="block text-xs font-bold text-blue-700 mb-1">Motor (HP)</Label>
                  <Input type="number" step="0.5" min="0" className="font-bold text-blue-700 bg-blue-50 text-slate-900 border-blue-200 transition-colors focus:border-blue-400" value={machinePowerHP} onChange={e => setMachinePowerHP(e.target.value)} />
                </div>
                <div className="relative group">
                  <Label className="block text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                    Costo Máq. ($/hr) {isInternalUser && <Info className="h-3 w-3 text-slate-400 cursor-help" />}
                  </Label>
                  <Input type="number" min="0" className="bg-white text-slate-900 border-slate-200 transition-colors focus:border-blue-400" value={machineCostHr} onChange={e => setMachineCostHr(e.target.value)} />
                  {isInternalUser && (
                    <>
                      <p className="text-[9px] text-slate-400 mt-0.5 cursor-help underline decoration-dotted decoration-slate-300">💡 Ref. Industrial</p>
                      <div className="absolute z-10 hidden group-hover:block w-56 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg -bottom-14 left-0 pointer-events-none">
                        <p><b>Torno / Fresadora básica:</b> $30 - $50</p>
                        <p><b>Centro Mec. (3-5 Ejes):</b> $60 - $120+</p>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <Label className="block text-xs font-bold text-slate-500 mb-1">Cambio (min)</Label>
                  <Input type="number" min="0" step="0.5" className="bg-white text-slate-900 border-slate-200 transition-colors focus:border-blue-400" value={toolChangeTime} onChange={e => setToolChangeTime(e.target.value)} />
                  <p className="text-[9px] text-slate-400 mt-0.5">Rápido: 0.5 - 5 min</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <Label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">📦 Escala Comercial</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative col-span-1 md:col-span-2">
                  <Input type="number" min="0" placeholder="0" className="w-full text-base font-black text-blue-700 pl-3 pr-14 h-11 bg-slate-50 text-slate-900 transition-colors focus:border-blue-400" value={monthlyProduction} onChange={(e) => setMonthlyProduction(e.target.value)} />
                  <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Pzs/Mes</span>
                </div>
                <div className="relative">
                  <Input type="number" min="1" max="24" className="w-full text-base font-bold pl-3 pr-12 h-11 bg-white text-slate-900 transition-colors focus:border-blue-400" value={horasPorTurno} onChange={(e) => setHorasPorTurno(e.target.value ? Number(e.target.value) : '')} />
                  <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Hrs/Trn</span>
                </div>
                <div className="relative">
                  <Input type="number" min="1" max="5" className="w-full text-base font-bold pl-3 pr-12 h-11 bg-white text-slate-900 transition-colors focus:border-blue-400" value={turnosPorDia} onChange={(e) => setTurnosPorDia(e.target.value ? Number(e.target.value) : '')} />
                  <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Trns/Día</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50/50 p-5 rounded-xl border-2 border-red-200 shadow-sm flex flex-col h-full relative overflow-hidden transition-all hover:shadow-md hover:border-red-300">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>
            <h2 className="font-black text-red-700 text-sm uppercase mb-4 mt-1 flex items-center gap-2">🔴 Condición Actual (Taller)</h2>
            
            <div className="grid grid-cols-2 gap-4 flex-grow">
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-800 mb-1 uppercase tracking-wider">Herramienta Competencia</Label>
                <Input type="text" placeholder="Ej: CNMG 120408" className="border-red-200 bg-white text-slate-900" value={toolNameCurrent} onChange={e => setToolNameCurrent(e.target.value)} />
                {operationType === 'milling' && warningFresaCurrent && (
                    <div className={`mt-2 p-2 text-xs font-medium rounded-r-lg ${warningFresaCurrent.includes('ERROR') ? 'bg-red-100 border-l-4 border-red-500 text-red-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                        {warningFresaCurrent}
                    </div>
                )}
              </div>
              <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Costo Inserto ($)</Label><Input type="number" min="0" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={toolCostCurrent} onChange={e => setToolCostCurrent(e.target.value)} /></div>
              <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Filos / Inserto</Label><Input type="number" min="1" placeholder="Ej: 4" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={edgesCurrent} onChange={e => setEdgesCurrent(e.target.value)} /></div>
              
              {operationType === 'milling' || operationType === 'drilling' ? (
                <div><Label className="block text-[10px] font-bold text-red-600 mb-1">{operationType === 'milling' ? 'Dc Fresa (mm)' : 'Dc Broca (mm)'}</Label><Input type="number" min="0" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={dcCurrent} onChange={e => setDcCurrent(e.target.value)} /></div>
              ) : null}

              {operationType === 'milling' ? (
                <>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Ancho (ae) mm</Label><Input type="number" min="0" step="0.1" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={aeCurrent} onChange={e => setAeCurrent(e.target.value)} /></div>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Prof. (ap) mm</Label><Input type="number" min="0" step="0.1" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={apCurrent} onChange={e => setApCurrent(e.target.value)} /></div>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Cant. Dientes (Z)</Label><Input type="number" min="1" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={zCurrent} onChange={e => setZCurrent(e.target.value)} /></div>
                </>
              ) : operationType === 'turning' ? (
                 <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Prof. Corte (ap) mm</Label><Input type="number" min="0" step="0.1" className="border-red-200 bg-white text-slate-900 transition-colors focus:border-red-400" value={apCurrent} onChange={e => setApCurrent(e.target.value)} /></div>
              ) : null}

              <div className="relative group">
                  <Label className="block text-[10px] font-bold text-red-600 mb-1 flex items-center justify-between">
                    {operationType === 'turning' ? 'Avance (mm/rev)' : operationType === 'milling' ? 'Avance (mm/z)' : 'Avance (mm/rev)'}
                    {isInternalUser && <Info className="h-3 w-3 text-red-400 cursor-help" />}
                  </Label>
                  <Input type="number" min="0" step="0.01" className="border-red-200 bg-white text-slate-900 font-mono transition-colors focus:border-red-400" value={feedCurrent} onChange={e => setFeedCurrent(e.target.value)} />
                  {isInternalUser && (
                    <div className="absolute z-20 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg top-full mt-1 left-0 pointer-events-none">
                      <p><b>Desbaste:</b> 0.20 - 0.40 mm/rev</p>
                      <p><b>Terminación:</b> 0.05 - 0.15 mm/rev</p>
                      <p className="mt-1 flex items-center text-red-300">⚠️ Límite Max = Radio × 0.5</p>
                    </div>
                  )}
                  {raActual && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                          Acabado (Ra): <span className="text-red-600 font-bold">{raActual} µm</span>
                      </p>
                  )}
                  {qActual > 0 && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                          Remoción (Q): {renderSafeNumber(qActual, 1, 'cm³/min', 'text-red-600 font-bold')}
                      </p>
                  )}
                  {hmActual > 0 && operationType !== 'drilling' && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                          {operationType === 'milling' ? 'Espesor (hm): ' : 'Espesor (he): '}
                          {renderSafeNumber(hmActual, 3, 'mm', `font-bold ${getHmColorClass(hmActual)}`)}
                      </p>
                  )}
              </div>
              
              
              <div className="relative group">
                <Label className="block text-[10px] font-bold text-red-600 mb-1 flex items-center justify-between">
                  Vc Actual (m/min) {isInternalUser && <Info className="h-3 w-3 text-red-400 cursor-help" />}
                </Label>
                <Input type="number" min="0" className="border-red-200 bg-white text-slate-900 font-mono transition-colors focus:border-red-400" value={vcCurrent} onChange={e => setVcCurrent(e.target.value)} />
                {isInternalUser && (
                  <div className="absolute z-20 hidden group-hover:block w-52 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg top-full mt-1 left-0 pointer-events-none">
                    <p><b>Aceros (P):</b> 150 - 250 m/min</p>
                    <p><b>Inoxidables (M):</b> 80 - 150 m/min</p>
                    <p><b>Fundición (K):</b> 200 - 300 m/min</p>
                  </div>
                )}
              </div>
              
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="block text-[10px] font-bold text-red-600 mb-1">Medir en</Label>
                  <Select value={lifeModeCurrent} onValueChange={(v: 'piezas'|'minutos') => setLifeModeCurrent(v)}>
                    <SelectTrigger className="border-red-200 bg-white text-slate-900 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piezas">{operationType === 'drilling' ? 'Agujeros' : 'Piezas'}</SelectItem>
                      <SelectItem value="minutos">Minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-[10px] font-bold text-red-600 mb-1">Rendimiento</Label>
                  <Input type="number" min="0" className="border-red-200 bg-white text-slate-900 h-9 transition-colors focus:border-red-400" placeholder="Ej: 120" value={pcsCurrent} onChange={e => setPcsCurrent(e.target.value)} />
                </div>
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-700 mb-1">Tiempo Actual (min decimales)</Label>
                <Input type="number" min="0" step="0.01" className="border-red-300 font-bold bg-white text-slate-900 disabled:bg-slate-100 font-mono transition-colors focus:border-red-400" placeholder="Ej: 7.0" value={tcCurrent} onChange={e => setTcCurrent(e.target.value)} disabled={operationType === 'drilling'} />
              </div>
            </div>
            {operationType === 'turning' && warningCurrent && (
              <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-800 p-3 text-xs font-medium rounded-r-lg">
                {warningCurrent}
              </div>
            )}
             {operationType === 'drilling' && warningBrocaCurrent && (
              <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 text-xs font-medium rounded-r-lg">
                {warningBrocaCurrent}
              </div>
            )}
            
            <div className="mt-6 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga Husillo</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    curveDataInfo.loadCurrent > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {renderSafeNumber(curveDataInfo.loadCurrent, 1, '%')}
                  </span>
                </div>
                <span className={`text-xs font-black flex items-center gap-1 ${getLoadColor(curveDataInfo.loadCurrent).text}`}>⚡ {renderSafeNumber(curveDataInfo.hpCurrent, 1, 'HP')}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden"><div className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(curveDataInfo.loadCurrent).bar}`} style={{ width: `${Math.min(curveDataInfo.loadCurrent, 100)}%` }}></div></div>
              <p className={`text-[9px] font-bold text-right uppercase ${getLoadColor(curveDataInfo.loadCurrent).text}`}>{getLoadColor(curveDataInfo.loadCurrent).label}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50/80 to-white p-5 rounded-xl border-2 border-green-500/40 shadow-lg shadow-green-500/10 flex flex-col h-full relative overflow-hidden transition-all hover:shadow-xl hover:shadow-green-500/20">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>
            <h2 className="font-black text-green-700 text-sm uppercase mb-4 mt-1 flex items-center gap-2">🟢 Propuesta (Secocut)</h2>
            
            <div className="grid grid-cols-2 gap-4 flex-grow">
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1 uppercase tracking-wider">Herramienta / Inserto Seco</Label>
                <Input type="text" placeholder="Ej: CNMG 120408-M3W TP2501" className="border-green-300 bg-white text-slate-900 shadow-inner font-bold text-green-900" value={toolNamePremium} onChange={e => setToolNamePremium(e.target.value)} />
                 {operationType === 'milling' && warningFresaPremium && (
                    <div className={`mt-2 p-2 text-xs font-medium rounded-r-lg ${warningFresaPremium.includes('ERROR') ? 'bg-red-100 border-l-4 border-red-500 text-red-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                        {warningFresaPremium}
                    </div>
                )}
                {isInternalUser && isFetchingCuttingData && (
                  <div className="flex items-center space-x-2 mt-3 text-green-700 text-xs bg-green-50 p-2 rounded-md border border-green-200">
                    <Loader2 className="w-3 h-3 animate-spin text-green-600" />
                    <span>Consultando catálogo Seco...</span>
                  </div>
                )}
                {isInternalUser && suggestedCuttingData && !isFetchingCuttingData && (
                  <Alert className="mt-3 bg-green-50 border border-green-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Wand2 className="h-10 w-10 text-green-600" />
                      </div>
                      <Wand2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-sm font-semibold text-green-800 flex items-center">
                          Referencia de Catálogo Seco
                      </AlertTitle>
                      <AlertDescription className="text-xs text-green-700 mt-2 space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                              <div className="bg-white p-2 rounded border border-green-200 text-center">
                                <span className="block font-bold text-green-800 mb-0.5">ap</span>
                                <span className="font-mono text-green-700">{suggestedCuttingData.ap}</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-green-200 text-center">
                                <span className="block font-bold text-green-800 mb-0.5">Avance</span>
                                <span className="font-mono text-green-700">{suggestedCuttingData.fz}</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-green-200 text-center">
                                <span className="block font-bold text-green-800 mb-0.5">Vc</span>
                                <span className="font-mono text-green-700">{suggestedCuttingData.vc}</span>
                              </div>
                          </div>
                          {suggestedCuttingData.notes && suggestedCuttingData.notes !== "N/A" && (
                              <div className="mt-2 text-[11px] text-green-700 italic bg-white p-2 rounded border border-green-100">
                                  💡 {suggestedCuttingData.notes}
                              </div>
                          )}
                      </AlertDescription>
                  </Alert>
                )}
              </div>
              <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Costo Inserto ($)</Label><Input type="number" min="0" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={toolCostPremium} onChange={e => setToolCostPremium(e.target.value)} /></div>
              <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Filos / Inserto</Label><Input type="number" min="1" placeholder="Ej: 8" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={edgesPremium} onChange={e => setEdgesPremium(e.target.value)} /></div>
              
              {operationType === 'milling' || operationType === 'drilling' ? (
                <div><Label className="block text-[10px] font-bold text-green-700 mb-1">{operationType === 'milling' ? 'Diámetro Fresa (Dc) mm' : 'Diámetro Broca (Dc) mm'}</Label><Input type="number" min="0" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={dcPremium} onChange={e => setDcPremium(e.target.value)} /></div>
              ) : null}

              {operationType === 'milling' ? (
                <>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Ancho Corte (ae) mm</Label><Input type="number" min="0" step="0.1" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={aePremium} onChange={e => setAePremium(e.target.value)} /></div>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Prof. Corte (ap) mm</Label><Input type="number" min="0" step="0.1" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={apPremium} onChange={e => setApPremium(e.target.value)} /></div>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Cant. Dientes (Z)</Label><Input type="number" min="1" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={zPremium} onChange={e => setZPremium(e.target.value)} /></div>
                </>
              ) : operationType === 'turning' ? (
                <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Prof. Corte (ap) mm</Label><Input type="number" min="0" step="0.1" className="border-green-200 bg-white text-slate-900 transition-colors focus:border-green-400" value={apPremium} onChange={e => setApPremium(e.target.value)} /></div>
              ) : null }

              <div className="relative group">
                  <Label className="block text-[10px] font-bold text-green-700 mb-1 flex items-center justify-between">
                    {operationType === 'turning' ? 'Avance (mm/rev)' : operationType === 'milling' ? 'Avance (mm/z)' : 'Avance (mm/rev)'}
                    {isInternalUser && <Info className="h-3 w-3 text-green-500 cursor-help" />}
                  </Label>
                  <Input type="number" min="0" step="0.01" className="border-green-200 bg-white text-slate-900 font-mono transition-colors focus:border-green-400" value={feedPremium} onChange={e => setFeedPremium(e.target.value)} />
                  {isInternalUser && (
                    <div className="absolute z-20 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg top-full mt-1 left-0 pointer-events-none">
                      <p><b>Desbaste:</b> 0.20 - 0.40 mm/rev</p>
                      <p><b>Terminación:</b> 0.05 - 0.15 mm/rev</p>
                      <p className="mt-1 flex items-center text-green-300">⚡ Geometrías Wiper: +100% fz</p>
                    </div>
                  )}
                  {raPropuesta && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                          Acabado (Ra): <span className="text-green-600 font-bold">{raPropuesta} µm</span>
                      </p>
                  )}
                  {qPropuesta > 0 && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                          Remoción (Q): {renderSafeNumber(qPropuesta, 1, 'cm³/min', 'text-green-600 font-bold')}
                      </p>
                  )}
                  {hmPropuesta > 0 && operationType !== 'drilling' && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
                          {operationType === 'milling' ? 'Espesor (hm): ' : 'Espesor (he): '}
                          {renderSafeNumber(hmPropuesta, 3, 'mm', `font-bold ${getHmColorClass(hmPropuesta)}`)}
                      </p>
                  )}
              </div>

              <div className="relative group">
                <Label className="block text-[10px] font-bold text-green-700 mb-1 flex items-center justify-between">
                  Vc Propuesta {isInternalUser && <Info className="h-3 w-3 text-green-500 cursor-help" />}
                </Label>
                <Input type="number" min="0" className="border-green-200 bg-white text-slate-900 font-mono transition-colors focus:border-green-400" value={vcPremium} onChange={e => setVcPremium(e.target.value)} />
                {isInternalUser && (
                  <div className="absolute z-20 hidden group-hover:block w-52 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg top-full mt-1 left-0 pointer-events-none">
                    <p className="mb-1 text-green-300">💡 <b>Recomendación Duratomic®</b></p>
                    <p><b>Aceros (TP):</b> 200 - 350 m/min</p>
                    <p><b>Fundición (TK):</b> 250 - 450 m/min</p>
                    <p><b>Inoxidables (TM):</b> 120 - 200 m/min</p>
                  </div>
                )}
              </div>
              
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="block text-[10px] font-bold text-green-700 mb-1">Medir en</Label>
                  <Select value={lifeModePremium} onValueChange={(v: 'piezas'|'minutos') => setLifeModePremium(v)}>
                    <SelectTrigger className="border-green-200 bg-white text-slate-900 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piezas">{operationType === 'drilling' ? 'Agujeros' : 'Piezas'}</SelectItem>
                      <SelectItem value="minutos">Minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-[10px] font-bold text-green-700 mb-1">Rendimiento</Label>
                  <Input type="number" min="0" className="border-green-200 bg-white text-slate-900 h-9 transition-colors focus:border-green-400" placeholder="Ej: 120" value={pcsPremium} onChange={e => setPcsPremium(e.target.value)} />
                </div>
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1">Tiempo Propuesto (min decimales)</Label>
                <Input type="number" min="0" step="0.01" className="border-green-400 font-black bg-green-50 text-green-900 shadow-inner h-10 text-lg text-center font-mono transition-colors focus:border-green-400" placeholder="Ej: 6.36" value={tcPremiumInput} onChange={e => setTcPremiumInput(e.target.value)} />
              </div>
            </div>
            {operationType === 'turning' && warningPremium && (
              <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 text-xs font-medium rounded-r-lg">
                {warningPremium}
              </div>
            )}
             {operationType === 'drilling' && warningBrocaPremium && (
              <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 text-xs font-medium rounded-r-lg">
                {warningBrocaPremium}
              </div>
            )}
            
            <div className="mt-6 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga Husillo</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    curveDataInfo.loadPremium > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {renderSafeNumber(curveDataInfo.loadPremium, 1, '%')}
                  </span>
                </div>
                <span className={`text-xs font-black flex items-center gap-1 ${getLoadColor(curveDataInfo.loadPremium).text}`}>⚡ {renderSafeNumber(curveDataInfo.hpPremium, 1, 'HP')}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden"><div className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(curveDataInfo.loadPremium).bar}`} style={{ width: `${Math.min(curveDataInfo.loadPremium, 100)}%` }}></div></div>
              <p className={`text-[9px] font-bold text-right uppercase ${getLoadColor(curveDataInfo.loadPremium).text}`}>{getLoadColor(curveDataInfo.loadPremium).label}</p>
            </div>
             <div className="mt-4 pt-4 border-t border-green-200/50">
                <Button
                    onClick={() => {
                        const base = {
                            vc: Number(vcPremium) || 0,
                            feed: Number(feedPremium) || 0,
                            pcs: Number(pcsPremium) || 0,
                            time: curveDataInfo.tcPremium || 0,
                        };
                        if (base.vc > 0 && base.feed > 0 && base.pcs > 0 && base.time > 0) {
                            setTaylorBase(base);
                            setSimulatedVc(base.vc);
                            setSimulatedFeed(base.feed);
                            setTargetSavings('');

                            const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
                            const safeToolCostPremium = Number(toolCostPremium) || 0;
                            const safeToolChangeTime = Number(toolChangeTime) || 0;
                            const safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || 1);
                            const safeEdgesPremium = Number(edgesPremium) || 1;
                            
                            const costCorte = safeMachineCostMin * base.time;
                            const costPerPunta = safeEdgesPremium > 0 ? safeToolCostPremium / safeEdgesPremium : 0;
                            const costJuego = costPerPunta * safeZPremium;
                            const penalidadCambio = costJuego + (safeToolChangeTime * safeMachineCostMin);
                            const costoHerr = base.pcs > 0 ? penalidadCambio / base.pcs : 0;
                            const baseCost = costCorte + costoHerr;
                            setTaylorBaseCost(baseCost);

                            setIsTaylorModalOpen(true);
                        } else {
                            alert("Por favor, completa todos los datos de la propuesta (Vc, Avance, Pzas/filo) antes de simular.");
                        }
                    }}
                    variant="outline"
                    className="w-full bg-green-100 border-green-200 text-green-800 hover:bg-green-200 hover:text-green-900"
                >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Simular Escenarios (Taylor)
                </Button>
            </div>
          </div>
          
          <div className="md:col-span-1 border-t border-slate-200 mt-4 pt-4 flex flex-col justify-center">
              <div className="flex items-center justify-between p-3 rounded-md bg-orange-50 border border-orange-200 shadow-sm">
                  <div className="flex items-center space-x-2">
                      <Flame className="h-5 w-5 text-orange-600" />
                      <div className="flex flex-col">
                          <Label htmlFor="stress-test" className="text-orange-900 font-bold">Simular Estrés Térmico</Label>
                          <span className="text-[10px] text-orange-700 leading-tight mt-0.5 max-w-[250px]">Muestra en el gráfico cuándo la herramienta económica sufrirá una inestabilidad catastrófica.</span>
                      </div>
                  </div>
                  <Switch id="stress-test" className="data-[state=checked]:bg-orange-600" checked={isStressTestActive} onCheckedChange={setIsStressTestActive} />
              </div>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Curva de Costo vs. Velocidad</CardTitle>
                <CardDescription>Los puntos marcan el costo operativo real en la Vc seleccionada.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                        data={curveDataInfo.data} 
                        margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
                        onMouseMove={(e) => { if (e && e.activePayload && e.activePayload.length > 0) setHoveredData(e.activePayload[0].payload); }}
                        onMouseLeave={() => setHoveredData(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 15 }} tick={{fontSize: 12}} />
                        <YAxis label={{ value: 'Costo Total Relativo', angle: -90, position: 'insideLeft', offset: 0 }} tick={{fontSize: 12}} tickFormatter={(value) => formatCurrency(value).replace('USD ', '$')} />
                        <Tooltip 
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }} 
                            content={() => null}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#ef4444' }} />
                        <Line type="monotone" dataKey="costoPremium" name="Propuesta (Secocut)" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#22c55e' }} />

                        {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={Number(vcCurrent)} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                        {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={Number(vcPremium)} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
                        
                        {curveDataInfo.velocidadOptimaSeco > 0 &&
                          <ReferenceLine 
                            x={curveDataInfo.velocidadOptimaSeco} 
                            stroke="#10B981" 
                            strokeDasharray="4 4" 
                            label={{ position: 'insideTopRight', value: '🔥 Óptimo', fill: '#10B981', fontSize: 10, fontWeight: 'bold' }} 
                          />
                        }

                        {isStressTestActive && curveDataInfo.limiteTermicoActual && (
                          <ReferenceLine
                            x={curveDataInfo.limiteTermicoActual}
                            stroke="#ea580c"
                            strokeWidth={2}
                            strokeDasharray="6 6"
                            label={{ position: 'insideTopLeft', value: '⚠️ Falla Térmica Compe.', fill: '#ea580c', fontSize: 11, fontWeight: 'bold' }}
                          />
                        )}
                    </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-1">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle className="text-base">Detalles del Punto</CardTitle>
                            <CardDescription className="text-xs h-4">
                                {hoveredData ? `Datos para Vc: ${hoveredData.speed} m/min` : "Pasa el mouse sobre el gráfico"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {hoveredData ? (
                             <div className="text-xs min-w-[240px]">
                                {hoveredData.costoActual !== undefined && hoveredData.desgloseActual && (
                                  <div className="space-y-1 border-b border-slate-100 pb-2 mb-2">
                                    <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Competidor: {formatCurrency(hoveredData.costoActual)}</p>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>⚙️ Tiempo de Corte: {formatCurrency(hoveredData.desgloseActual.maquina)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desgloseActual.maquina, hoveredData.costoActual)}%)</span></div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>💎 Inserto Puro: {formatCurrency(hoveredData.desgloseActual.inserto)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desgloseActual.inserto, hoveredData.costoActual)}%)</span></div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>🔴 Costo Paradas: {formatCurrency(hoveredData.desgloseActual.parada)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desgloseActual.parada, hoveredData.costoActual)}%)</span></div>
                                    {hoveredData.desgloseActual.lote > 0 && (<p className="text-[10px] text-amber-700 font-bold mt-1 pt-1 border-t border-slate-50">📦 Insertos para Lote: {(curveDataInfo.desgloseActualReal?.lote || 0).toFixed(1)} unds.</p>)}
                                  </div>
                                )}

                                {hoveredData.costoPremium !== undefined && hoveredData.desglosePremium && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">SECOCUT: {formatCurrency(hoveredData.costoPremium)}</p>
                                      { (() => {
                                          const porcentajeAhorro = hoveredData.costoActual > 0 ? ((hoveredData.costoActual - hoveredData.costoPremium) / hoveredData.costoActual) * 100 : 0;
                                          if (porcentajeAhorro > 0) {
                                            return <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-full">Ahorro {porcentajeAhorro.toFixed(1)}%</span>
                                          }
                                          return null;
                                        })()
                                      }
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>⚙️ Tiempo de Corte: {formatCurrency(hoveredData.desglosePremium.maquina)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desglosePremium.maquina, hoveredData.costoPremium)}%)</span></div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>💎 Inserto Puro: {formatCurrency(hoveredData.desglosePremium.inserto)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desglosePremium.inserto, hoveredData.costoPremium)}%)</span></div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><span>🔴 Costo Paradas: {formatCurrency(hoveredData.desglosePremium.parada)}</span><span className="text-[9px] font-medium text-slate-400 ml-1">({calculateIncidence(hoveredData.desglosePremium.parada, hoveredData.costoPremium)}%)</span></div>
                                    {hoveredData.desglosePremium.lote > 0 && (<p className="text-[10px] text-emerald-700 font-bold mt-1 pt-1 border-t border-slate-50">📦 Insertos para Lote: {(curveDataInfo.desglosePremiumReal?.lote || 0).toFixed(1)} unds.</p>)}
                                  </div>
                                )}
                                {hoveredData.desgloseActual && hoveredData.desglosePremium && hoveredData.costoPremium > 0 && (
                                  (() => {
                                    const diffInserto = hoveredData.desglosePremium.inserto - hoveredData.desgloseActual.inserto;
                                    const diffPercentage = (Math.abs(diffInserto) / hoveredData.costoPremium) * 100;
                                    const isMoreExpensive = diffInserto > 0;
                                    return (
                                      <div className="mt-3 pt-2 border-t border-slate-200/80 bg-slate-50 rounded-b-md -mx-3 -mb-3 px-3 pb-2 text-center"><p className="text-[10px] text-slate-600 leading-tight"><span className="font-bold text-slate-700">⚖️ Diferencia de Inserto:</span>{' '}<span className={isMoreExpensive ? 'text-red-600 font-medium' : 'text-emerald-600 font-bold'}>{isMoreExpensive ? '+' : ''}{formatCurrency(diffInserto)}</span></p><p className="text-[9px] text-slate-400 mt-0.5 italic">(Apenas un <span className="font-bold">{diffPercentage.toFixed(1)}%</span> de impacto en la pieza)</p></div>
                                    );
                                  })()
                                )}
                              </div>
                          ) : (
                            <div className="text-center py-10">
                               <p className="text-sm text-muted-foreground">👈 Pasa el mouse sobre la línea de la gráfica para analizar cada velocidad.</p>
                            </div>
                          )}
                        </CardContent>
                    </Card>
                </div>
              </div>
            </CardContent>
        </Card>

        {(!isFinite(curveDataInfo.actualCostCurrent) || !isFinite(curveDataInfo.actualCostPremium) || isNaN(curveDataInfo.monthlySavings)) ? (
            <Alert variant="destructive" className="mt-6 border-red-500 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-bold text-lg">Colapso Técnico / Falla Matemática</AlertTitle>
                <AlertDescription className="text-red-700 mt-2">
                    Las condiciones de corte que ingresaste no son sostenibles físicamente (Ej: avance excesivo que rompe el radio, velocidad infinita, o vida útil cero). La ecuación de Taylor está arrojando costos matemáticamente irracionales. Ajusta los parámetros de mecanizado.
                </AlertDescription>
            </Alert>
        ) : (
          isFinite(curveDataInfo.monthlySavings) && Number(monthlyProduction) > 0 && (
            <MonthlySavingsSummary
              monthlyVolume={Number(monthlyProduction)}
              compToolCost={curveDataInfo.desgloseActualReal.inserto}
              secoToolCost={curveDataInfo.desglosePremiumReal.inserto}
              compMachineCost={curveDataInfo.desgloseActualReal.maquina + curveDataInfo.desgloseActualReal.parada}
              secoMachineCost={curveDataInfo.desglosePremiumReal.maquina + curveDataInfo.desglosePremiumReal.parada}
              compTime={Number(tcCurrent)}
              secoTime={Number(tcPremiumInput)}
              horasPorTurno={Number(horasPorTurno) || 8}
              turnosPorDia={Number(turnosPorDia) || 1}
            />
          )
        )}
      </div>
      
        {insightText && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                  <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Análisis del Punto Óptimo</h3>
                  <p className="text-sm text-blue-900 dark:text-blue-300">{insightText}</p>
              </div>
          </div>
        )}
      </div>

      {isInternalUser && (
        <>
          <button
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className="fixed bottom-6 right-6 h-14 w-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-50 border-2 border-slate-700"
          >
            <span className="text-2xl">🤖</span>
          </button>

          <div className={`fixed top-0 right-0 h-full w-[320px] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col ${isCopilotOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h3 className="font-black text-slate-800 tracking-tight">Copiloto Seco</h3>
              </div>
              <button onClick={() => setIsCopilotOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 shadow-sm border ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-700 rounded-tr-none' : 'bg-white text-slate-700 border-slate-200 rounded-tl-none'}`}>
                    {msg.role === 'assistant' ? renderChatMessage(msg.content) : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-xl rounded-tl-none p-3 shadow-sm text-slate-400 text-sm flex gap-1">
                    <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pregúntale al Copiloto..."
                  className="w-full pl-4 pr-14 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg text-sm transition-all"
                />
                <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="absolute right-2 top-2 text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
              <p className="text-[9px] text-center text-slate-400 mt-2">El Copiloto lee automáticamente tus parámetros.</p>
            </form>
          </div>
        </>
      )}

        {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 p-4">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">💾 Guardar Simulación</h3>
              <p className="text-xs text-slate-500 mt-1">Este análisis se guardará en la tabla de Historial.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="block text-xs font-bold text-slate-700 mb-1">Cliente / Empresa</Label>
                <Input type="text" placeholder="Ej: John Deere" className="w-full" value={saveClientName} onChange={e => setSaveClientName(e.target.value)} />
              </div>
              <div>
                <Label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Operación</Label>
                <Input type="text" placeholder="Ej: Torneado Eje Principal" className="w-full" value={saveCaseName} onChange={e => setSaveCaseName(e.target.value)} />
              </div>
              
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Ahorro Anual Proyectado (Automático)</p>
                <p className="font-black text-emerald-800 text-xl">
                  {formatCurrency((curveDataInfo.realAbsoluteSavings * (Number(monthlyProduction)||0)) * 12)}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
                Cancelar
              </button>
              
              <button 
                onClick={handleSaveCase} 
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isSaving ? '⏳ Guardando...' : 'Guardar Análisis'}
              </button>
            </div>
          </div>
        </div>
      )}

        <Dialog open={isTaylorModalOpen} onOpenChange={(isOpen) => { setIsTaylorModalOpen(isOpen); if (!isOpen) setTargetSavings(''); }}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Wand2 className="text-purple-500" />
                        Simulador Interactivo (Ecuación de Taylor)
                    </DialogTitle>
                    <DialogDescription>
                        Mueve los controles para encontrar el punto óptimo entre productividad y vida útil, o ingresa un % de ahorro objetivo.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-2">
                    <Label htmlFor="target-savings" className="font-bold">🎯 Ahorro Objetivo (%)</Label>
                    <Input
                        id="target-savings" type="number" placeholder="Ej: 15" value={targetSavings}
                        onChange={(e) => setTargetSavings(e.target.value)}
                        className="w-full md:w-1/2 border-purple-300 focus-visible:ring-purple-500"
                    />
                    <p className="text-xs text-muted-foreground">Ingresa un % de ahorro y el simulador encontrará la Vc necesaria.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-6">
                        <div>
                            <Label className="font-bold">Velocidad de Corte (Vc)</Label>
                            <div className="flex items-center gap-4">
                                <Slider min={taylorBase.vc * 0.7} max={taylorBase.vc * 1.5} step={1} value={[simulatedVc]} onValueChange={(val) => setSimulatedVc(val[0])} />
                                <span className="font-bold text-blue-600 w-24 text-center border rounded-md p-2">{simulatedVc.toFixed(0)} m/min</span>
                            </div>
                        </div>
                        <div>
                            <Label className="font-bold">Avance (f)</Label>
                             <div className="flex items-center gap-4">
                                <Slider min={taylorBase.feed * 0.7} max={taylorBase.feed * 1.5} step={0.01} value={[simulatedFeed]} onValueChange={(val) => setSimulatedFeed(val[0])} />
                                <span className="font-bold text-blue-600 w-24 text-center border rounded-md p-2">{simulatedFeed.toFixed(2)} mm/rev</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
                        <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">⏱️ Nuevo Tiempo de Ciclo</p>
                            <p className="text-2xl font-black text-slate-800">{simulationResult ? formatoMinutosYSegundos(simulationResult.newTime) : '-'}</p>
                        </div>
                         <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">⚙️ Nueva Vida Útil</p>
                            <p className="text-2xl font-black text-slate-800">{simulationResult ? `${formatNumber(simulationResult.newPcs)} ${unidadVidaUtil}` : '-'}</p>
                        </div>
                         <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">Acabado Teórico (Ra)</p>
                            <p className={`text-2xl font-black ${simulationResult && simulationResult.newRa && Number(simulationResult.newRa) > 3.2 ? 'text-red-500' : 'text-slate-800'}`}>
                                {simulationResult?.newRa ? `${simulationResult.newRa} µm` : '-'}
                            </p>
                        </div>
                         <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                            <p className="text-xs font-bold text-green-700 uppercase mb-1">💰 Nuevo Costo por Pieza</p>
                            {simulationResult ? (
                                <>
                                    <p className="text-3xl font-black text-green-800">{formatCurrency(simulationResult.newCost)}</p>
                                    {porcentajeAhorroSimulado > 0.1 && (
                                        <div className="mt-2 text-sm font-bold text-green-800 bg-green-200 inline-block px-3 py-1 rounded-full shadow-sm">
                                            ↓ Ahorras un {porcentajeAhorroSimulado.toFixed(1)}%
                                        </div>
                                    )}
                                    {porcentajeAhorroSimulado < -0.1 && (
                                        <div className="mt-2 text-sm font-bold text-red-800 bg-red-200 inline-block px-3 py-1 rounded-full shadow-sm">
                                            ↑ Sube un {Math.abs(porcentajeAhorroSimulado).toFixed(1)}%
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-3xl font-black text-green-800">-</p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsTaylorModalOpen(false)}>Cancelar</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                        if (simulationResult) {
                            setVcPremium(simulatedVc);
                            setFeedPremium(simulatedFeed);
                            setPcsPremium(simulationResult.newPcs);
                        }
                        setIsTaylorModalOpen(false);
                    }}>
                        Aplicar estos parámetros
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1 }}>
          <div id="pdf-pagina-1" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
            
            <div className="relative mb-8 pb-4 border-b-2 border-slate-800">
              <div className="flex justify-between items-start mb-8 h-16">
                {logos.company ? <img src={logos.company} alt="Logo Empresa" crossOrigin="anonymous" className="h-full object-contain max-w-[250px] object-left" /> : <div className="h-12 flex items-center justify-center bg-blue-600 text-white font-black px-4 rounded text-lg">SECOCUT</div>}
                
                {logos.brand ? <img src={logos.brand} alt="Logo Marca" crossOrigin="anonymous" className="h-full object-contain max-w-[200px] object-right" /> : <div className="h-12 flex items-center justify-center text-slate-800 font-black text-3xl">Seco</div>}
              </div>

              <div className="text-center mb-10 mt-4">
                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Análisis de Curva de Costos</h1>
              </div>

              <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-blue-600">{saveClientName || pieceName || 'Reporte de Análisis'}</h2>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Informe Técnico</p>
                  <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('es-ES')}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">1. Condiciones de Trabajo Evaluadas</h2>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-2 border border-slate-700">Parámetro</th>
                    <th className="p-2 border border-slate-700 text-center">Condición Actual (Competidor)</th>
                    <th className="p-2 border border-slate-700 text-center">Propuesta (Secocut)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold bg-slate-50">Herramienta</td>
                    <td className="p-2 border border-slate-300 text-center">{toolNameCurrent || 'No especificada'}</td>
                    <td className="p-2 border border-slate-300 font-bold text-green-700 bg-green-50 text-center">{toolNamePremium || 'No especificada'}</td>
                  </tr>
                  {(operationType === 'turning' || operationType === 'milling') && (
                    <tr>
                      <td className="p-2 border border-slate-300 font-bold">Incidencia (Holgura)</td>
                      <td className="p-2 border border-slate-300 text-center">{obtenerAnguloTexto(toolNameCurrent)}</td>
                      <td className="p-2 border border-slate-300 text-center bg-green-50 font-medium">{obtenerAnguloTexto(toolNamePremium)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Precio Inserto</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostCurrent))}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostPremium))}</td>
                  </tr>
                  {(operationType === 'milling' || operationType === 'drilling') && (
                    <tr>
                      <td className="p-2 border border-slate-300 font-bold">{operationType === 'drilling' ? 'Diámetro de Broca (Dc)' : 'Diámetro Fresa (Dc)'}</td>
                      <td className="p-2 border border-slate-300 text-center">{dcCurrent} mm</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-green-700">{dcPremium} mm</td>
                    </tr>
                  )}
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">
                      {operationType === 'drilling' ? 'Prof. del Agujero (L)' : 'Profundidad de Corte (ap)'}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">{operationType === 'drilling' ? profundidadAgujero : apCurrent} mm</td>
                    <td className="p-2 border border-slate-300 text-center text-green-700">{operationType === 'drilling' ? profundidadAgujero : apPremium} mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Tiempo de Corte (min)</td>
                    <td className="p-2 border border-slate-300 text-center">{formatoMinutosYSegundos(Number(tcCurrent))}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatoMinutosYSegundos(Number(tcPremiumInput))}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Velocidad de Corte (Vc)</td>
                    <td className="p-2 border border-slate-300 text-center">{vcCurrent} m/min</td>
                    <td className="p-2 border border-slate-300 text-center">{vcPremium} m/min</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Avance ({operationType === 'milling' ? 'fz' : 'fn'})</td>
                    <td className="p-2 border border-slate-300 text-center">{feedCurrent} {operationType === 'milling' ? 'mm/z' : 'mm/rev'}</td>
                    <td className="p-2 border border-slate-300 text-center text-green-700 font-bold">{feedPremium} {operationType === 'milling' ? 'mm/z' : 'mm/rev'}</td>
                  </tr>
                  {operationType === 'drilling' && (
                    <tr className="bg-green-50">
                      <td className="font-bold p-2 text-gray-800 border border-slate-300">Velocidad de Penetración (Vf)</td>
                      <td className="p-2 text-center border border-slate-300">{calcularVf(feedCurrent, vcCurrent, dcCurrent).toFixed(0)} mm/min</td>
                      <td className="p-2 text-center text-green-800 font-black border border-slate-300">
                        {calcularVf(feedPremium, vcPremium, dcPremium).toFixed(0)} mm/min
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Rendimiento Estimado</td>
                    <td className="p-2 border border-slate-300 text-center">{pcsCurrent} {lifeModeCurrent === 'minutos' ? 'minutos' : (operationType === 'drilling' ? 'agujeros' : 'pzs')}/filo</td>
                    <td className="p-2 border border-slate-300 text-center text-green-700 font-bold">{pcsPremium} {lifeModePremium === 'minutos' ? 'minutos' : (operationType === 'drilling' ? 'agujeros' : 'pzs')}/filo</td>
                  </tr>
                   {operationType !== 'drilling' && (
                    <tr className="bg-slate-100">
                      <td className="p-2 border border-slate-300 font-bold">Rugosidad Teórica (Ra)</td>
                      <td className="p-2 border border-slate-300 text-center">
                          {`${raActual ?? 'N/A'} µm`}
                      </td>
                      <td className="p-2 border border-slate-300 text-center bg-slate-50 font-medium">
                          {`${raPropuesta ?? 'N/A'} µm`}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Consumo de Motor</td>
                    <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpCurrent.toFixed(1)} HP ({curveDataInfo.loadCurrent.toFixed(1)}%)</td>
                    <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpPremium.toFixed(1)} HP ({curveDataInfo.loadPremium.toFixed(1)}%)</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-300 font-black text-slate-800">Costo Real por Pieza</td>
                    <td className="p-2 border border-slate-300 font-black text-red-600 text-center text-lg">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</td>
                    <td className="p-2 border border-slate-300 text-center">
                      {isFinite(curveDataInfo.actualCostPremium) ? (
                          <div className="flex items-center gap-2 justify-center">
                              <span className="font-black text-green-800 text-xl">
                                {formatCurrency(curveDataInfo.actualCostPremium)}
                              </span>
                          </div>
                      ) : (
                          'N/A'
                      )}
                    </td>
                  </tr>
                  <tr className="text-[10px] text-slate-500 bg-white">
                    <td className="p-2 border border-slate-300 pl-6">↳ Costo de Máquina</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.maquina)}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.maquina)}</td>
                  </tr>
                  <tr className="text-[10px] text-slate-500 bg-white">
                    <td className="p-2 border border-slate-300 pl-6">↳ Costo de Inserto Puro</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.inserto)}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.inserto)}</td>
                  </tr>
                  <tr className="text-[10px] text-slate-500 bg-white">
                    <td className="p-2 border border-slate-300 pl-6">↳ Costo de Paradas</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desgloseActualReal.parada)}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(curveDataInfo.desglosePremiumReal.parada)}</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="p-2 border border-slate-300 font-bold text-amber-900">📦 Insertos Consumidos (Lote)</td>
                    <td className="p-2 border border-slate-300 text-center font-black text-amber-700">
                      {(curveDataInfo.desgloseActualReal?.lote || 0).toFixed(1)} unds.
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-black text-emerald-700">
                      {(curveDataInfo.desglosePremiumReal?.lote || 0).toFixed(1)} unds.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`border-2 rounded-xl p-6 text-center mb-8 relative overflow-hidden ${curveDataInfo.monthlySavings >= 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
              <div className={`absolute top-0 left-0 w-full h-2 ${curveDataInfo.monthlySavings >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p className={`text-sm font-bold uppercase tracking-widest mb-2 mt-2 ${curveDataInfo.monthlySavings >= 0 ? 'text-green-700' : 'text-red-700'}`}>Impacto Mensual Proyectado</p>
              <p className={`text-5xl font-black mb-2 ${curveDataInfo.monthlySavings >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {curveDataInfo.monthlySavings >= 0 ? '' : '-'}{formatCurrency(Math.abs(curveDataInfo.monthlySavings))}
              </p>
              <div className={`inline-block px-4 py-2 rounded-full mt-2 ${curveDataInfo.monthlySavings >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className={`text-sm font-bold ${curveDataInfo.monthlySavings >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Basado en {formatNumber(Number(monthlyProduction))} piezas/mes • {curveDataInfo.monthlySavings >= 0 ? 'Ahorro' : 'Costo Extra'} unitario: {formatCurrency(Math.abs(curveDataInfo.realAbsoluteSavings))}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
              Reporte de Análisis de Costos • Página 1 de 2
            </div>
          </div>

          <div id="pdf-pagina-2" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-slate-800 uppercase">Análisis Gráfico</h2>
                  <p className="text-sm font-bold text-slate-500">Página 2 de 2</p>
              </div>
            <div>
              <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">2. Análisis de Curva de Costos</h2>
              <div className="w-full h-[300px] border border-slate-200 p-2 bg-white">
                <LineChart width={650} height={280} data={curveDataInfo.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="speed" label={{ value: 'Vc (m/min)', position: 'bottom', offset: -5 }} />
                  <YAxis label={{ value: 'Costo USD', angle: -90, position: 'insideLeft' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="costoActual" name="Inserto Competidor" stroke="#ef4444" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="costoPremium" name="Propuesta (Secocut)" stroke="#22c55e" strokeWidth={3} dot={false} />
                  {isFinite(curveDataInfo.actualCostCurrent) && <ReferenceDot x={Number(vcCurrent)} y={curveDataInfo.actualCostCurrent} r={6} fill="#ef4444" stroke="white" strokeWidth={2} isFront={true} />}
                  {isFinite(curveDataInfo.actualCostPremium) && <ReferenceDot x={Number(vcPremium)} y={curveDataInfo.actualCostPremium} r={6} fill="#22c55e" stroke="white" strokeWidth={2} isFront={true} />}
                  {isStressTestActive && curveDataInfo.limiteTermicoActual && (
                    <ReferenceLine x={curveDataInfo.limiteTermicoActual} stroke="#ea580c" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '⚠️ Falla Térmica Compe.', fill: '#ea580c', fontSize: 9 }} />
                  )}
                </LineChart>
              </div>
            </div>
            {isFinite(curveDataInfo.monthlySavings) && Number(monthlyProduction) > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-bold bg-slate-100 p-2 rounded text-slate-800 uppercase mb-3 border-l-4 border-blue-600">
                  3. Proyección de Ahorro Mensual (Base: {formatNumber(Number(monthlyProduction))} piezas)
                </h2>
                
                {(() => {
                  const vol = Number(monthlyProduction) || 0;
                  const compTool = curveDataInfo.desgloseActualReal.inserto * vol;
                  const secoTool = curveDataInfo.desglosePremiumReal.inserto * vol;
                  const toolSavings = compTool - secoTool;

                  const compMach = (curveDataInfo.desgloseActualReal.maquina + curveDataInfo.desgloseActualReal.parada) * vol;
                  const secoMach = (curveDataInfo.desglosePremiumReal.maquina + curveDataInfo.desglosePremiumReal.parada) * vol;
                  const machineSavings = compMach - secoMach;

                  const netSavings = toolSavings + machineSavings;

                  return (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <p className="text-xs text-slate-500 font-bold mb-1">1. Impacto en Compras</p>
                        <p className="text-[9px] text-slate-400 leading-tight mb-2">Diferencia en gasto de insertos</p>
                        <p className={`text-xl font-black tracking-tight ${toolSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {toolSavings > 0 ? '+' : ''}{formatCurrency(toolSavings)}
                        </p>
                      </div>
                      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <p className="text-xs text-slate-500 font-bold mb-1">2. Impacto en Producción</p>
                        <p className="text-[9px] text-slate-400 leading-tight mb-2">Ahorro en horas máquina y operador</p>
                        <p className={`text-xl font-black tracking-tight ${machineSavings >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {machineSavings > 0 ? '+' : ''}{formatCurrency(machineSavings)}
                        </p>
                      </div>
                      <div className={`p-3 border-2 rounded-lg ${netSavings >= 0 ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
                        <p className={`text-xs font-bold mb-1 ${netSavings >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>3. AHORRO NETO TOTAL</p>
                        <p className={`text-[9px] leading-tight mb-2 ${netSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Impacto financiero final</p>
                        <p className={`text-2xl font-black tracking-tight ${netSavings >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {netSavings > 0 ? '+' : ''}{formatCurrency(netSavings)}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="mt-auto pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
              Documento generado automáticamente por Simulador de Competitividad Secocut SRL.
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1 }}>
            <div id="survey-pdf-content" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
                <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-slate-800">
                    {logos.company ? <img src={logos.company} alt="Logo Empresa" crossOrigin="anonymous" className="h-16 object-contain" /> : <div className="h-16 w-48 bg-slate-200"></div>}
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Planilla de Relevamiento</h1>
                </div>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8 text-sm">
                    <SurveyField label="Cliente" />
                    <SurveyField label="Fecha" />
                    <SurveyField label="Máquina" />
                    <SurveyField label="Material a mecanizar" />
                    <div className="flex items-end border-b-2 border-dotted border-slate-300 py-3">
                        <span className="font-semibold text-slate-700 mr-2">Costo Máquina ($/hr):</span>
                        <span className="flex-grow"></span>
                    </div>
                    <div className="flex items-end border-b-2 border-dotted border-slate-300 py-3">
                        <span className="font-semibold text-slate-700 mr-2">Potencia Motor (HP):</span>
                        <span className="flex-grow"></span>
                    </div>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h2 className="text-lg font-bold text-blue-700 mb-4 uppercase">Datos Técnicos - {operationType.charAt(0).toUpperCase() + operationType.slice(1)}</h2>
                    <div className="space-y-4 text-sm">
                        {operationType === 'turning' && (
                            <>
                                <SurveyField label="Inserto Actual (Código)" />
                                <div className="grid grid-cols-2 gap-8"><SurveyField label="Precio por Inserto (USD)" /><SurveyField label="Filos por Inserto" /></div>
                                <SurveyField label="Profundidad de Corte (ap) mm" />
                                <SurveyField label="Avance (fn) mm/rev" />
                                <SurveyField label="Velocidad de Corte (Vc) m/min" />
                                <SurveyField label="Vida Útil Actual" />
                                <SurveyField label="Tiempo de Cambio de Herramienta (min)" />
                            </>
                        )}
                        {operationType === 'milling' && (
                            <>
                                <SurveyField label="Inserto Actual (Código)" />
                                <div className="grid grid-cols-2 gap-8"><SurveyField label="Precio por Inserto (USD)" /><SurveyField label="Filos por Inserto" /></div>
                                <SurveyField label="Profundidad de Corte (ap) mm" />
                                <SurveyField label="Avance (fz) mm/z" />
                                <SurveyField label="Velocidad de Corte (Vc) m/min" />
                                <SurveyField label="Cantidad de Dientes de la Fresa (Z)" />
                                <SurveyField label="Vida Útil Actual" />
                                <SurveyField label="Tiempo de Cambio de Herramienta (min)" />
                            </>
                        )}
                        {operationType === 'drilling' && (
                            <>
                                <SurveyField label="Broca / Inserto Actual" />
                                <div className="grid grid-cols-2 gap-8"><SurveyField label="Precio de Broca/Inserto (USD)" /><SurveyField label="Filos útiles" /></div>
                                <SurveyField label="Diámetro de Broca (Dc) mm" />
                                <SurveyField label="Profundidad del Agujero (L) mm" />
                                <SurveyField label="Avance (fn) mm/rev" />
                                <SurveyField label="Velocidad de Corte (Vc) m/min" />
                                <SurveyField label="Vida Útil Actual" />
                                <SurveyField label="Tiempo de Cambio de Herramienta (min)" />
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-8">
                    <h3 className="text-sm font-bold text-slate-600 mb-2">Notas Adicionales:</h3>
                    <div className="w-full h-32 border-2 border-dotted border-slate-300 rounded-lg p-2"></div>
                </div>
            </div>
        </div>
    </>
  );
}






