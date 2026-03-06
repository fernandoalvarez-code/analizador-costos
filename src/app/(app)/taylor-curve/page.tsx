"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Share2, FileText, Wand2 } from 'lucide-react';
import { formatCurrency, formatNumber, formatoMinutosYSegundos } from '@/lib/formatters';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { addDoc, collection, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, useUser } from "@/firebase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';


const MATERIALS = [
  // --- GRUPO ISO P (Aceros) 🟦 ---
  { grupo: "ISO P", nombre: "Acero Bajo Carbono (Ej: 1010, 1020)", kc: 1500, dureza: "150 HB" },
  { grupo: "ISO P", nombre: "Acero Medio Carbono (Ej: 1045, 4140)", kc: 1800, dureza: "200 HB" },
  { grupo: "ISO P", nombre: "Acero Aleado / Cementación (Ej: 8620, 16MnCr5)", kc: 1700, dureza: "180 HB" },
  { grupo: "ISO P", nombre: "Acero Alta Aleación / Herramienta", kc: 2100, dureza: "300 HB" },

  // --- GRUPO ISO M (Inoxidables) 🟨 ---
  { grupo: "ISO M", nombre: "Acero Inoxidable Austenítico (304, 316)", kc: 2200, dureza: "200 HB" },
  { grupo: "ISO M", nombre: "Acero Inox. Dúplex / Súper Dúplex", kc: 2600, dureza: "260 HB" },

  // --- GRUPO ISO K (Fundiciones) 🟥 ---
  { grupo: "ISO K", nombre: "Fundición Gris (GG)", kc: 1200, dureza: "200 HB" },
  { grupo: "ISO K", nombre: "Fundición Nodular / Dúctil (GGG)", kc: 1500, dureza: "250 HB" },

  // --- GRUPO ISO N (No Ferrosos y Plásticos) 🟩 ---
  { grupo: "ISO N", nombre: "Aluminio / Aleaciones de Aluminio", kc: 700, dureza: "60 HB" },
  { grupo: "ISO N", nombre: "Latón / Bronce / Cobre", kc: 900, dureza: "100 HB" },
  { grupo: "ISO N", nombre: "Plásticos de Ingeniería (Nylon, Delrin)", kc: 300, dureza: "N/A" },

  // --- GRUPO ISO S (Superaleaciones y Titanio) 🟧 ---
  { grupo: "ISO S", nombre: "Aleaciones de Titanio (Ej: Ti-6Al-4V)", kc: 2000, dureza: "350 HB" },
  { grupo: "ISO S", nombre: "Súper Aleaciones Base Níquel (Inconel)", kc: 2800, dureza: "400 HB" },

  // --- GRUPO ISO H (Materiales Templados) ⬜ ---
  { grupo: "ISO H", nombre: "Aceros Templados (> 45 HRC)", kc: 3500, dureza: "50+ HRC" }
];

const TAYLOR_CONSTANTS: Record<string, {n: number, C: number}> = {
  "ISO P": { n: 0.25, C: 250 },
  "ISO M": { n: 0.20, C: 150 },
  "ISO K": { n: 0.25, C: 200 },
  "ISO N": { n: 0.35, C: 900 },
  "ISO S": { n: 0.18, C: 130 },
  "ISO H": { n: 0.15, C: 120 },
};

const MATRIZ_ROMPEVIRUTAS: Record<string, {min_f: number, max_f: number, min_ap?: number, max_ap?: number, desc: string}> = {
  // Plaquitas Positivas
  "AL":  { min_f: 0.15, max_f: 0.60, min_ap: 0.5, max_ap: 4.0, desc: "Aluminio" },
  "FF1": { min_f: 0.05, max_f: 0.30, min_ap: 0.2, max_ap: 3.0, desc: "Súper Acabado" },
  "F1":  { min_f: 0.10, max_f: 0.50, min_ap: 0.2, max_ap: 3.0, desc: "Fundiciones/Forjados Finos" },
  "MF2": { min_f: 0.08, max_f: 0.50, min_ap: 0.15, max_ap: 3.0, desc: "Acabado Versátil" },
  "M3":  { min_f: 0.12, max_f: 0.60, min_ap: 0.2, max_ap: 5.0, desc: "Semidesbaste" },
  "M5":  { min_f: 0.15, max_f: 0.70, min_ap: 1.0, max_ap: 6.0, desc: "Desbaste" },
  "RR96": { min_f: 0.50, max_f: 2.20, min_ap: 5.0, max_ap: 24.0, desc: "Desbaste Pesado Ferrocarril" },
  "RR97": { min_f: 0.50, max_f: 2.20, min_ap: 5.0, max_ap: 24.0, desc: "Desbaste Pesado Ferrocarril" },
  "UX":  { min_f: 0.05, max_f: 0.40, min_ap: 0.5, max_ap: 4.0, desc: "Piezas Delgadas" },
  
  // Plaquitas Negativas
  "FF2": { min_f: 0.08, max_f: 0.30, min_ap: 0.2, max_ap: 1.5, desc: "Acabado" },
  "MF1": { min_f: 0.08, max_f: 0.30, min_ap: 0.2, max_ap: 3.5, desc: "Acabado Inox/Titanio" },
  "MF4": { min_f: 0.15, max_f: 0.50, desc: "Inox/Superaleaciones" },
  "MF5": { min_f: 0.20, max_f: 0.80, desc: "Inox/Superaleaciones (Altos Avances)" },
  "M1":  { min_f: 0.20, max_f: 0.40, min_ap: 1.5, max_ap: 5.0, desc: "Titanio/Inox" },
  "M4":  { min_f: 0.10, max_f: 0.70, min_ap: 0.2, max_ap: 5.0, desc: "Fundición" },
};

// Función para extraer el radio del código ISO (Ej: "TNMG 160408-M5" -> 0.8)
const extraerRadioISO = (codigoInserto: string): number | null => {
  if (!codigoInserto) return null;

  // 1. Trabajar con la parte ANTES del rompevirutas/sufijo
  const partePrincipal = codigoInserto.split('-')[0];

  // 2. Quitar todos los caracteres no numéricos
  const soloNumeros = partePrincipal.replace(/\D/g, '');

  // 3. Necesitamos al menos 2 dígitos para el radio (ej: 04, 08, 12)
  if (soloNumeros.length >= 2) {
    // 4. Tomar los ÚLTIMOS dos dígitos
    const radioString = soloNumeros.slice(-2);
    return parseInt(radioString, 10) / 10;
  }
  
  return null;
};

// Analizador del Rompevirutas a prueba de errores de tipeo
const analizarRompevirutas = (codigoInserto: string): { esWiper: boolean; tipoCorte: string; sufijo: string } => {
    if (!codigoInserto) {
        return { esWiper: false, tipoCorte: 'Desconocido', sufijo: '' };
    }
    const textoLimpio = codigoInserto.replace(/\s|-/g, '').toUpperCase();
    const match = textoLimpio.match(/\d{6}(.*)/);

    if (!match || !match[1]) {
        return { esWiper: false, tipoCorte: 'Desconocido', sufijo: '' };
    }

    const sufijo = match[1];
    const esWiper = sufijo.includes('W');

    let tipoCorte = 'Medio';
    if (sufijo.includes('F') || sufijo.includes('FF')) {
        tipoCorte = 'Terminacion';
    } else if (sufijo.includes('R') || sufijo.includes('RR')) {
        tipoCorte = 'Desbaste';
    }

    return { esWiper, tipoCorte, sufijo };
};

const auditarLimitesRompevirutas = (codigoInserto: string | undefined, avance_f: number | string, ap_mm: number | string): string | null => {
  if (!codigoInserto || !avance_f || !ap_mm) return null;

  const { sufijo } = analizarRompevirutas(codigoInserto);
  if (!sufijo) return null;

  // Prioriza llaves más largas para evitar falsos positivos (ej: "MF2" antes que "M" o "F")
  const chipbreakerKey = Object.keys(MATRIZ_ROMPEVIRUTAS)
                               .sort((a, b) => b.length - a.length)
                               .find(key => sufijo.includes(key));

  if (!chipbreakerKey) return null;

  const limites = MATRIZ_ROMPEVIRUTAS[chipbreakerKey];
  const numAvance = Number(avance_f);
  const numAp = Number(ap_mm);

  if (numAvance < limites.min_f || numAvance > limites.max_f) {
    return `⚠️ Avance (${numAvance}) fuera de rango para ${chipbreakerKey} (${limites.desc}). Rango ideal: ${limites.min_f}-${limites.max_f} mm/rev.`;
  }
  if (limites.min_ap !== undefined && limites.max_ap !== undefined && (numAp < limites.min_ap || numAp > limites.max_ap)) {
    return `⚠️ Profundidad (${numAp}mm) fuera de rango para ${chipbreakerKey} (${limites.desc}). Rango ideal: ${limites.min_ap}-${limites.max_ap} mm.`;
  }
  
  return `✅ Parámetros en rango para rompevirutas ${chipbreakerKey} (${limites.desc}).`;
};


// Función para generar advertencias técnicas
const auditarParametros = (ap: number | "", avance: number | "", codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  let advertencia = null;

  if (radio && ap && avance) {
    const apNum = Number(ap);
    const avanceNum = Number(avance);
    // 1. Auditoría de Vibración / Rotura de Viruta
    if (apNum < radio) {
      advertencia = `⚠️ Riesgo de Vibración: Tu ap (${apNum}mm) es menor al radio del inserto (${radio}mm). Las fuerzas radiales empujarán la pieza.`;
    }
    // 2. Auditoría de Acabado Superficial y Rotura
    else if (avanceNum > (radio * 0.6)) {
      advertencia = `⚠️ Avance Excesivo: Un avance de ${avanceNum} mm/rev es muy alto para un radio de ${radio}mm. Generará mal acabado superficial o romperá el filo.`;
    }
  }

  return advertencia; // Si devuelve un string, mostrarlo en rojo en la pantalla
};

const auditarAplicacion = (ap: number | "", codigoInserto: string): string | null => {
  if (!ap || !codigoInserto) return null;
  const { tipoCorte } = analizarRompevirutas(codigoInserto);
  const apNum = Number(ap);
  
  if (tipoCorte === 'Terminacion' && apNum > 1.5) {
    return `⚠️ Cuidado: Estás usando un rompevirutas de Terminación con un ap de ${apNum}mm. La viruta se va a atascar y romperá el filo.`;
  }
  
  if (tipoCorte === 'Desbaste' && apNum < 1.0) {
    return `⚠️ Cuidado: Estás usando un rompevirutas de Desbaste Pesado para un corte muy fino (${apNum}mm). La viruta no va a romper y saldrá en hilos largos.`;
  }
  
  return null;
};

const calcularRaTeorico = (avance: number | "", codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  const avanceNum = Number(avance);
  if (!avanceNum || !radio || radio <= 0) return null;

  // Fórmula estándar ISO
  let ra_micrones = (Math.pow(avanceNum, 2) / (32 * radio)) * 1000;

  // Analizamos el rompevirutas
  const { esWiper } = analizarRompevirutas(codigoInserto);
  
  // LA MAGIA DEL WIPER: Si es Wiper, el acabado mejora drásticamente (dividimos el Ra aprox a la mitad)
  if (esWiper) {
    ra_micrones = ra_micrones / 2; 
  }

  return ra_micrones.toFixed(2);
};

// Analizador Inteligente para Plaquitas de Fresado
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

  if (grado.includes('PCD') && (material.includes('acero') || material.includes('fundicion'))) {
    return '❌ ERROR CRÍTICO: El PCD (Diamante) reacciona químicamente con el hierro a altas temperaturas. Solo usar en Aluminio, Plásticos o Titanio.';
  }

  if (grado.includes('PCBN') && material.includes('aluminio')) {
    return '⚠️ ALERTA DE COSTO: El PCBN es extremadamente caro y está diseñado para aceros templados >45HRC o fundición gris. Para aluminio, usa plaquitas no recubiertas (Ej: H15) o PCD.';
  }

  if ((grado.includes('MP15') || grado.includes('MK15')) && (material.includes('titanio') || material.includes('inconel'))) {
     return '💡 SUGERENCIA: Para Titanio se recomiendan calidades PVD (Ej: MS2050) por su tenacidad de filo, no CVD.';
  }

  return null;
};

const auditarBroca = (diametro?: number | "", profundidad?: number | ""): string | null => {
  if (!diametro || !profundidad) return null;
  const numDiametro = Number(diametro);
  const numProfundidad = Number(profundidad);
  if (numDiametro <= 0 || numProfundidad <= 0) return null;
  
  const ratioL_D = numProfundidad / numDiametro;
  
  if (ratioL_D > 8) {
    return '⚠️ Alerta de Profundidad (>8xD): Broca muy larga. Se requiere agujero piloto y reducir el avance (fn) un 20% al entrar para evitar que la broca flexe o se parta.';
  }
  return null;
};

export default function TaylorCurvePage() {
  const { user } = useUser();

  // --- ESTADO PARA LOGOS DEL PDF ---
  const [logos, setLogos] = useState({ company: '', brand: '' });

  // --- ESTADOS DEL FORMULARIO (Inician vacíos por requerimiento de UX) ---
  const [operationType, setOperationType] = useState<'turning' | 'milling' | 'drilling'>('turning');
  const [materialId, setMaterialId] = useState('Acero Medio Carbono (Ej: 1045, 4140)'); // El select sí tiene default
  const [machineCostHr, setMachineCostHr] = useState<number | "">("");
  const [toolChangeTime, setToolChangeTime] = useState<number | "">("");
  const [pieceName, setPieceName] = useState<string>("");
  const [machinePowerHP, setMachinePowerHP] = useState<number | "">(15); // Potencia del motor
  const [profundidadAgujero, setProfundidadAgujero] = useState<number | "">("");
  
  // Competidor
  const [toolNameCurrent, setToolNameCurrent] = useState<string>("");
  const [toolCostCurrent, setToolCostCurrent] = useState<number | "">("");
  const [apCurrent, setApCurrent] = useState<number | "">("");
  const [feedCurrent, setFeedCurrent] = useState<number | "">("");
  const [vcCurrent, setVcCurrent] = useState<number | "">("");
  const [pcsCurrent, setPcsCurrent] = useState<number | "">("");
  const [tcCurrentMin, setTcCurrentMin] = useState<number | "">("");
  const [tcCurrentSec, setTcCurrentSec] = useState<number | "">("");
  const [zCurrent, setZCurrent] = useState<number | "">("");
  const [edgesCurrent, setEdgesCurrent] = useState<number | "">("");
  const [dcCurrent, setDcCurrent] = useState<number | "">("");
  const [aeCurrent, setAeCurrent] = useState<number | "">("");
  
  // Premium
  const [toolNamePremium, setToolNamePremium] = useState<string>("");
  const [toolCostPremium, setToolCostPremium] = useState<number | "">("");
  const [apPremium, setApPremium] = useState<number | "">("");
  const [feedPremium, setFeedPremium] = useState<number | "">("");
  const [vcPremium, setVcPremium] = useState<number | "">("");
  const [pcsPremium, setPcsPremium] = useState<number | "">("");
  const [zPremium, setZPremium] = useState<number | "">("");
  const [edgesPremium, setEdgesPremium] = useState<number | "">("");
  const [dcPremium, setDcPremium] = useState<number | "">("");
  const [aePremium, setAePremium] = useState<number | "">("");

  // Volumen
  const [monthlyProduction, setMonthlyProduction] = useState<number | "">("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveCaseName, setSaveCaseName] = useState("");
  const [saveClientName, setSaveClientName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADOS DEL COPILOTO ---
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Hola, soy tu Copiloto Seco. Estoy analizando los parámetros de esta máquina. ¿En qué te ayudo?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- ESTADOS PARA SIMULADOR TAYLOR ---
  const [isTaylorModalOpen, setIsTaylorModalOpen] = useState(false);
  const [taylorBase, setTaylorBase] = useState({ vc: 0, feed: 0, pcs: 0, time: 0 });
  const [simulatedVc, setSimulatedVc] = useState(0);
  const [simulatedFeed, setSimulatedFeed] = useState(0);
  const [simulationResult, setSimulationResult] = useState<{ newPcs: number, newTime: number, newCost: number, newRa: string | null } | null>(null);
  const [taylorBaseCost, setTaylorBaseCost] = useState(0);
  const [targetSavings, setTargetSavings] = useState<number | ''>('');

  // --- Efecto para auto-calcular tiempo de corte en Taladrado ---
  useEffect(() => {
    if (operationType === 'drilling') {
      const vc = Number(vcCurrent);
      const d = Number(dcCurrent);
      const f = Number(feedCurrent);
      const l = Number(profundidadAgujero);

      if (vc > 0 && d > 0 && f > 0 && l > 0) {
        const rpm = (vc * 1000) / (Math.PI * d);
        const vf = f * rpm; // Velocidad de penetración (mm/min)
        const tiempoMinutosDecimal = l / vf;

        if (isFinite(tiempoMinutosDecimal)) {
          const min = Math.floor(tiempoMinutosDecimal);
          let seg = Math.round((tiempoMinutosDecimal - min) * 60);
          if (seg === 60) {
            setTcCurrentMin(min + 1);
            setTcCurrentSec(0);
          } else {
            setTcCurrentMin(min);
            setTcCurrentSec(seg);
          }
        }
      }
    }
  }, [operationType, vcCurrent, dcCurrent, feedCurrent, profundidadAgujero]);

  const raActual = calcularRaTeorico(feedCurrent, toolNameCurrent);
  const raPropuesta = calcularRaTeorico(feedPremium, toolNamePremium);

  const warningParamCurrent = auditarParametros(apCurrent, feedCurrent, toolNameCurrent);
  const warningAppCurrent = auditarAplicacion(apCurrent, toolNameCurrent);
  const chipbreakerAuditCurrent = useMemo(() => auditarLimitesRompevirutas(toolNameCurrent, feedCurrent, apCurrent), [toolNameCurrent, feedCurrent, apCurrent]);
  const warningCurrent = warningParamCurrent || warningAppCurrent;

  const warningParamPremium = auditarParametros(apPremium, feedPremium, toolNamePremium);
  const warningAppPremium = auditarAplicacion(apPremium, toolNamePremium);
  const chipbreakerAuditPremium = useMemo(() => auditarLimitesRompevirutas(toolNamePremium, feedPremium, apPremium), [toolNamePremium, feedPremium, apPremium]);
  const warningPremium = warningParamPremium || warningAppPremium;

  const analisisFresaCurrent = useMemo(() => analizarInsertoFresado(toolNameCurrent), [toolNameCurrent]);
  const alertaMaterialCurrent = useMemo(() => auditarMaterialFresado(toolNameCurrent, materialId), [toolNameCurrent, materialId]);
  const warningFresaCurrent = alertaMaterialCurrent || analisisFresaCurrent?.alertaGeometria;

  const analisisFresaPremium = useMemo(() => analizarInsertoFresado(toolNamePremium), [toolNamePremium]);
  const alertaMaterialPremium = useMemo(() => auditarMaterialFresado(toolNamePremium, materialId), [toolNamePremium, materialId]);
  const warningFresaPremium = alertaMaterialPremium || analisisFresaPremium?.alertaGeometria;
  
  const warningBrocaCurrent = useMemo(() => auditarBroca(dcCurrent, profundidadAgujero), [dcCurrent, profundidadAgujero]);
  const warningBrocaPremium = useMemo(() => auditarBroca(dcPremium, profundidadAgujero), [dcPremium, profundidadAgujero]);


  // --- Funciones de Cálculo ---
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

  const handleGeneratePDF = async (action: 'download' | 'share' | 'blob') => {
    setIsGenerating(true);
    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const a4Width = 210;

        // 1. CAPTURAR PÁGINA 1 (Tablas de Datos y Ahorros)
        const elementoPagina1 = document.getElementById('pdf-pagina-1');
        if (!elementoPagina1) throw new Error("Elemento 'pdf-pagina-1' no encontrado.");
        
        const canvas1 = await html2canvas(elementoPagina1, { scale: 2, useCORS: true, allowTaint: true });
        const imgData1 = canvas1.toDataURL('image/png');
        const imgHeight1 = (canvas1.height * a4Width) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', 0, 0, a4Width, imgHeight1);

        // 2. CREAR SALTO DE PÁGINA
        pdf.addPage();

        // 3. CAPTURAR PÁGINA 2 (Gráfica de Curva de Costos)
        const elementoPagina2 = document.getElementById('pdf-pagina-2');
        if (!elementoPagina2) throw new Error("Elemento 'pdf-pagina-2' no encontrado.");

        const canvas2 = await html2canvas(elementoPagina2, { scale: 2, useCORS: true, allowTaint: true });
        const imgData2 = canvas2.toDataURL('image/png');
        const imgHeight2 = (canvas2.height * a4Width) / canvas2.width;
        pdf.addImage(imgData2, 'PNG', 0, 0, a4Width, imgHeight2);

        // 4. DEVOLVER EL TIPO CORRECTO
        const fileName = `Reporte_Secocut_Analisis.pdf`;
        if (action === 'blob') {
          return pdf.output('blob');
        } else if (action === 'download') {
            pdf.save(fileName);
        } else { // share
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
      console.log("Enviando petición a /api/chat...", chatPayload);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload)
      });

      // Si la respuesta no es OK, forzamos a leer el error real
      if (!response.ok) {
        let errorMsg = `Error HTTP: ${response.status}`;
        try {
           const errData = await response.json();
           errorMsg = errData.error || errData.message || errorMsg;
        } catch(e) { /* ignorar si no es json */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      
    } catch (error) {
      console.error("Error capturado en frontend:", error);
      // AHORA IMPRIMIMOS EL ERROR REAL EN PANTALLA
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error de conexión: ${error instanceof Error ? error.message : 'Desconocido'}. (Dile al programador que revise la consola F12 o la terminal)` 
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
    const safeTcCurrent = (Number(tcCurrentMin) || 0) + ((Number(tcCurrentSec) || 0) / 60);
    const safeVcCurrent = Number(vcCurrent) || 0.0001;
    const mat = MATERIALS.find(m => m.nombre === materialId) || MATERIALS[1];
    const taylorProps = TAYLOR_CONSTANTS[mat.grupo as keyof typeof TAYLOR_CONSTANTS] || { n: 0.25, C: 250 };
    
    const n = taylorProps.n;

    // --- ANCLAJE COMPETIDOR (A) ---
    const T_A = (Number(pcsCurrent) || 1) * safeTcCurrent;
    const constante_C_Competidor = safeVcCurrent > 0 && T_A > 0 ? safeVcCurrent * Math.pow(T_A, n) : 0;
    
    // --- ANCLAJE SECOCUT (B) ---
    const vcPropuesta = Number(vcPremium) || 0.0001;
    const tcPremium_at_vcPremium = vcPropuesta > 0 
        ? safeTcCurrent * (safeVcCurrent / vcPropuesta) * ((Number(feedCurrent) || 0.0001) / (Number(feedPremium) || 0.0001)) * ((Number(apCurrent) || 0.0001) / (Number(apPremium) || 0.0001)) 
        : 0;
    const T_B = (Number(pcsPremium) || 1) * tcPremium_at_vcPremium;
    const constante_C_Seco = vcPropuesta > 0 && T_B > 0 ? vcPropuesta * Math.pow(T_B, n) : 0;

    const kc = mat.kc || 1500;
    const safeMachinePowerHP = Number(machinePowerHP) || 15;
    let tcPremium = 0, hpCurrent = 0, hpPremium = 0;
    const safeMonthlyProduction = Number(monthlyProduction) || 0;
    const safeEdgesCurrent = Number(edgesCurrent) || 1;
    const safeEdgesPremium = Number(edgesPremium) || 1;

    if (operationType === 'turning') {
        const safeFeedCurrent = Number(feedCurrent) || 0.0001, safeApCurrent = Number(apCurrent) || 0.0001;
        const safeVcPremium = Number(vcPremium) || 0.0001, safeFeedPremium = Number(feedPremium) || 0.0001, safeApPremium = Number(apPremium) || 0.0001;
        tcPremium = safeTcCurrent * (safeVcCurrent / safeVcPremium) * (safeFeedCurrent / safeFeedPremium) * (safeApCurrent / safeApPremium);
        const kwCurrent_base = (safeApCurrent * safeFeedCurrent * safeVcCurrent * kc) / 60000;
        hpCurrent = kwCurrent_base * 1.341 * obtenerFactorForma(toolNameCurrent) * obtenerFactorIncidencia(toolNameCurrent);
        const kwPremium_base = (safeApPremium * safeFeedPremium * safeVcPremium * kc) / 60000;
        hpPremium = kwPremium_base * 1.341 * obtenerFactorForma(toolNamePremium) * obtenerFactorIncidencia(toolNamePremium);
    } else if (operationType === 'milling') {
        const safeDcCurrent = Number(dcCurrent) || 0.0001, safeFzCurrent = Number(feedCurrent) || 0, safeZCurrentMilling = Number(zCurrent) || 1, safeApCurrent = Number(apCurrent) || 0, safeAeCurrent = Number(aeCurrent) || 0;
        const safeVcPremium = Number(vcPremium) || 0, safeDcPremium = Number(dcPremium) || 0.0001, safeFzPremium = Number(feedPremium) || 0, safeZPremiumMilling = Number(zPremium) || 1, safeApPremium = Number(apPremium) || 0, safeAePremium = Number(aePremium) || 0;
        const rpmCurrent = (safeVcCurrent * 1000) / (Math.PI * safeDcCurrent), vfCurrent = safeFzCurrent * safeZCurrentMilling * rpmCurrent;
        const rpmPremium = (safeVcPremium * 1000) / (Math.PI * safeDcPremium), vfPremium = safeFzPremium * safeZPremiumMilling * rpmPremium;
        tcPremium = vfPremium > 0 ? safeTcCurrent * (vfCurrent / vfPremium) : safeTcCurrent;
        const qCurrent = (safeApCurrent * safeAeCurrent * vfCurrent) / 1000, kwCurrent = (qCurrent * kc) / 60000;
        hpCurrent = (kwCurrent * 1.341) / 0.8;
        const qPremium = (safeApPremium * safeAePremium * vfPremium) / 1000, kwPremium = (qPremium * kc) / 60000;
        hpPremium = (kwPremium * 1.341) / 0.8;
    } else if (operationType === 'drilling') {
        const safeDcCurrent = Number(dcCurrent) || 0.0001, safeFnCurrent = Number(feedCurrent) || 0;
        const safeVcPremium = Number(vcPremium) || 0.0001, safeDcPremium = Number(dcPremium) || 0.0001, safeFnPremium = Number(feedPremium) || 0;
        const rpmCurrent = (safeVcCurrent * 1000) / (Math.PI * safeDcCurrent), vfCurrent = safeFnCurrent * rpmCurrent;
        const rpmPremium = (safeVcPremium * 1000) / (Math.PI * safeDcPremium), vfPremium = safeFnPremium * rpmPremium;
        tcPremium = vfPremium > 0 ? safeTcCurrent * (vfCurrent / vfPremium) : safeTcCurrent;
        const qCurrent = (Math.PI * Math.pow(safeDcCurrent, 2) / 4) * vfCurrent / 1000, kwCurrent = (qCurrent * kc) / 60000;
        hpCurrent = (kwCurrent * 1.341) / 0.8;
        const qPremium = (Math.PI * Math.pow(safeDcPremium, 2) / 4) * vfPremium / 1000, kwPremium = (qPremium * kc) / 60000;
        hpPremium = (kwPremium * 1.341) / 0.8;
    }
    const loadCurrent = (hpCurrent / safeMachinePowerHP) * 100, loadPremium = (hpPremium / safeMachinePowerHP) * 100;
    let effectivePcsCurrent = Number(pcsCurrent) || 1, effectivePcsPremium = Number(pcsPremium) || 1;
    if (operationType === 'milling') {
        effectivePcsCurrent = safeTcCurrent > 0 ? (Number(pcsCurrent) || 0) / safeTcCurrent : 0;
        effectivePcsPremium = tcPremium > 0 ? (Number(pcsPremium) || 0) / tcPremium : 0;
    }
    if (effectivePcsCurrent <= 0) effectivePcsCurrent = 1; if (effectivePcsPremium <= 0) effectivePcsPremium = 1;
    
    const calcCostWithBreakdown = (v: number, isPremium: boolean, feed: number) => {
        const C = isPremium ? constante_C_Seco : constante_C_Competidor;
        if (C <= 0 || v <= 0) return { costoTotal: 0, costoMaquina: 0, costoHerramienta: 0 };
        
        const toolPrice = isPremium ? safeToolCostPremium : safeToolCostCurrent;
        const z = isPremium ? (Number(zPremium) || 1) : (Number(zCurrent) || 1);
        const edges = isPremium ? safeEdgesPremium : safeEdgesCurrent;
        const ap = isPremium ? (Number(apPremium) || 0.0001) : (Number(apCurrent) || 0.0001);
        
        const tc = (safeTcCurrent * (safeVcCurrent / v) * ((Number(feedCurrent) || 0.0001) / feed) * ((Number(apCurrent) || 0.0001) / ap));
        const lifeMins = Math.pow((C / v), (1 / n));

        const costPorPunta = edges > 0 ? toolPrice / edges : 0;
        const costJuego = costPorPunta * z;
        
        const costoMaquina = safeMachineCostMin * tc;

        const costoHerrParte1 = costJuego;
        const costoHerrParte2 = safeMachineCostMin * safeToolChangeTime;
        const costoTotalHerramienta = lifeMins > 0 ? (costoHerrParte1 + costoHerrParte2) * (tc / lifeMins) : 0;

        const costoTotal = costoMaquina + costoTotalHerramienta;
        return { costoTotal, costoMaquina, costoHerramienta: costoTotalHerramienta };
    };

    const calcEmpiricalCost = (tc: number, toolPrice: number, pcsPerEdge: number, z: number, edges: number) => {
      const costCorte = safeMachineCostMin * tc;
      const costPorPunta = edges > 0 ? toolPrice / edges : 0;
      const costJuego = costPorPunta * z;
      const costHerr = pcsPerEdge > 0 ? costJuego / pcsPerEdge : 0;
      const costCambio = pcsPerEdge > 0 ? (safeMachineCostMin * safeToolChangeTime) / pcsPerEdge : 0;
      return costCorte + costHerr + costCambio;
    };

    const speedsSet = new Set<number>();
    const C_for_range = taylorProps.C;
    for (let v = 50; v <= C_for_range * 1.3; v += 10) { speedsSet.add(v); }
    if (Number(vcCurrent) > 0) speedsSet.add(Number(vcCurrent)); if (Number(vcPremium) > 0) speedsSet.add(Number(vcPremium));
    const sortedSpeeds = Array.from(speedsSet).sort((a, b) => a - b);
    
    let minPremiumCost = Infinity;
    let optimalSpeed = 0;

    const data = sortedSpeeds.map(v => {
        const resActual = calcCostWithBreakdown(v, false, Number(feedCurrent) || 0.0001);
        const resPremium = calcCostWithBreakdown(v, true, Number(feedPremium) || 0.0001);
        if (resPremium.costoTotal < minPremiumCost && resPremium.costoTotal > 0) { minPremiumCost = resPremium.costoTotal; optimalSpeed = v; }
        return { speed: v, costoActual: Number(resActual.costoTotal.toFixed(2)), costoPremium: Number(resPremium.costoTotal.toFixed(2)), costoMaquinaActual: resActual.costoMaquina, costoHerrActual: resActual.costoHerramienta, costoMaquinaPremium: resPremium.costoMaquina, costoHerrPremium: resPremium.costoHerramienta, };
    });
    
    const actualCostCurrent = calcEmpiricalCost(safeTcCurrent, safeToolCostCurrent, effectivePcsCurrent, (Number(zCurrent) || 1), safeEdgesCurrent);
    const actualCostPremium = calcEmpiricalCost(tcPremium, safeToolCostPremium, effectivePcsPremium, (Number(zPremium) || 1), safeEdgesPremium);
    const realAbsoluteSavings = actualCostCurrent - actualCostPremium;
    const realSavingsPercentage = actualCostCurrent > 0 ? (realAbsoluteSavings / actualCostCurrent) * 100 : 0;
    const monthlySavings = isFinite(realAbsoluteSavings) ? realAbsoluteSavings * safeMonthlyProduction : 0;

    return { data, actualCostCurrent, actualCostPremium, realAbsoluteSavings, realSavingsPercentage, tcPremium, monthlySavings, hpCurrent, hpPremium, loadCurrent, loadPremium, velocidadOptimaSeco: optimalSpeed, costoOptimoSeco: minPremiumCost };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, apCurrent, apPremium, feedCurrent, feedPremium, vcCurrent, vcPremium, pcsCurrent, pcsPremium, tcCurrentMin, tcCurrentSec, zCurrent, zPremium, edgesCurrent, edgesPremium, operationType, monthlyProduction, machinePowerHP, toolNameCurrent, toolNamePremium, dcCurrent, dcPremium, aeCurrent, aePremium, profundidadAgujero]);

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
        const costCorte = safeMachineCostMin * nuevoTiempoMin, costPorPunta = nuevasPzas > 0 ? safeToolCostPremium / safeEdgesPremium : 0, costJuego = costPorPunta * safeZPremium;
        const costHerr = nuevasPzas > 0 ? costJuego / nuevasPzas : 0, costCambio = nuevasPzas > 0 ? (safeMachineCostMin * safeToolChangeTime) / nuevasPzas : 0;
        const nuevoCosto = costCorte + costHerr + costCambio;
        const nuevoRa = calcularRaTeorico(simulatedFeed, toolNamePremium);
        setSimulationResult({ newPcs: nuevasPzas, newTime: nuevoTiempoMin, newCost: nuevoCosto, newRa: nuevoRa });
    }, [simulatedVc, simulatedFeed, taylorBase, isTaylorModalOpen, machineCostHr, toolCostPremium, toolChangeTime, operationType, zPremium, edgesPremium, toolNamePremium]);

    useEffect(() => {
        const percentage = Number(targetSavings);
        if (!percentage || percentage <= 0 || !isTaylorModalOpen || taylorBaseCost <= 0) return;

        const autoCalcularPorObjetivo = () => {
            const costoObjetivo = taylorBaseCost * (1 - (percentage / 100));
            let vcSimulada = taylorBase.vc, costoIterativo = taylorBaseCost;
            const limiteSeguridadVc = taylorBase.vc * 2;
            const safeMachineCostMin = (Number(machineCostHr) || 0) / 60, safeToolCostPremium = Number(toolCostPremium) || 0, safeToolChangeTime = Number(toolChangeTime) || 0, safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || 1), safeEdgesPremium = Number(edgesPremium) || 1;
            const costPorPunta = safeEdgesPremium > 0 ? safeToolCostPremium / safeEdgesPremium : 0, costJuego = costPorPunta * safeZPremium;
            
            while (costoIterativo > costoObjetivo && vcSimulada < limiteSeguridadVc) {
                vcSimulada++;
                const factorVelocidad = Math.pow((taylorBase.vc / vcSimulada), 3.0);
                const piezasTemp = taylorBase.pcs * factorVelocidad, tiempoTemp = taylorBase.time * (taylorBase.vc / vcSimulada);
                const costCorte = safeMachineCostMin * tiempoTemp, costHerr = piezasTemp > 0 ? costJuego / piezasTemp : 0, costCambio = piezasTemp > 0 ? (safeMachineCostMin * safeToolChangeTime) / piezasTemp : 0;
                costoIterativo = costCorte + costHerr + costCambio;
            }

            if (vcSimulada < limiteSeguridadVc) {
                setSimulatedVc(vcSimulada);
                setSimulatedFeed(taylorBase.feed);
            } else {
                alert("El porcentaje de ahorro deseado es físicamente imposible solo aumentando la velocidad. Intenta un objetivo más bajo o ajusta también el avance.");
            }
        };
        
        const debounceTimer = setTimeout(() => { autoCalcularPorObjetivo(); }, 500);
        return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetSavings, isTaylorModalOpen]);


  const premiumMins = Math.floor(curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0);
  const premiumSecs = Math.round(((curveDataInfo.tcPremium > 0 && curveDataInfo.tcPremium !== Infinity ? curveDataInfo.tcPremium : 0) - premiumMins) * 60);
  const porcentajeAhorro = curveDataInfo.realSavingsPercentage.toFixed(1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const { speed, costoMaquinaActual, costoHerrActual, costoMaquinaPremium, costoHerrPremium } = payload[0].payload;
        const costoTotalActual = payload.find(p => p.dataKey === 'costoActual')?.value;
        const costoTotalPremium = payload.find(p => p.dataKey === 'costoPremium')?.value;
        
        return (
            <div className="bg-white p-3 border shadow-lg rounded-md text-xs min-w-[220px]">
                <p className="font-bold border-b pb-1 mb-2">Vc: {speed} m/min</p>
                
                {costoTotalActual !== undefined && (
                    <div className="mb-2">
                        <p className="text-red-700 font-bold">
                            Competidor: {formatCurrency(costoTotalActual)}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-tight">
                            Máquina: {formatCurrency(costoMaquinaActual)} <br/>
                            Herramienta: {formatCurrency(costoHerrActual)}
                        </p>
                    </div>
                )}

                {costoTotalPremium !== undefined && (
                    <div>
                        <p className="text-green-700 font-bold">
                            SECOCUT: {formatCurrency(costoTotalPremium)}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-tight">
                            Máquina: {formatCurrency(costoMaquinaPremium)} <br/>
                            Herramienta: {formatCurrency(costoHerrPremium)}
                        </p>
                    </div>
                )}
            </div>
        );
    }
    return null;
  };

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

    const porcentajeAhorroSimulado = taylorBaseCost > 0 && simulationResult ? (((taylorBaseCost - simulationResult.newCost) / taylorBaseCost) * 100).toFixed(1) : "0.0";
    
    const insightText = useMemo(() => {
        const { velocidadOptimaSeco, costoOptimoSeco } = curveDataInfo;
        const numVcCurrent = Number(vcCurrent);
        if (!numVcCurrent || !velocidadOptimaSeco || !costoOptimoSeco) return null;
        
        if (numVcCurrent < velocidadOptimaSeco) {
            return `💡 Tu máquina está subutilizada. Si subimos la velocidad de ${numVcCurrent} a ${velocidadOptimaSeco} m/min con el inserto Seco, alcanzarás el costo mínimo absoluto de ${formatCurrency(costoOptimoSeco)} por pieza.`;
        } else if (numVcCurrent > velocidadOptimaSeco + 10) { // Added a small buffer
            return `⚠️ Estás quemando insertos. Bajando la velocidad a ${velocidadOptimaSeco} m/min con Seco, extenderás la vida útil drásticamente y bajarás tu costo a ${formatCurrency(costoOptimoSeco)}.`;
        } else {
            return `✅ ¡Estás muy cerca del punto óptimo! Mantener la velocidad alrededor de ${velocidadOptimaSeco} m/min te asegura la máxima eficiencia y rentabilidad.`;
        }
    }, [curveDataInfo, vcCurrent]);


  return (
    <>
      <div className={`container mx-auto space-y-8 pb-16 transition-all duration-300 ${isCopilotOpen ? 'pr-[320px]' : ''}`}>
      {/* HEADER Y BOTONES DE ACCIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-blue-600 h-7 w-7" />
            Análisis de Curva de Costos
          </h1>
          <p className="text-slate-500 text-sm mt-1">Compara la Vc actual vs. la propuesta para demostrar el ahorro real.</p>
        </div>

        {/* BOTONERA ESTILO "SIMULADOR PRINCIPAL" */}
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

      {/* LAYOUT PRINCIPAL: INPUTS ARRIBA, GRÁFICO ABAJO */}
      <div className="space-y-6">
        
        {/* PANEL DE INPUTS (Horizontal 3 Columnas Simétricas) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* 1. PARÁMETROS GENERALES (Ahora incluye Producción Mensual) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h2 className="font-black text-slate-800 text-sm uppercase border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              🏭 1. Parámetros del Taller
            </h2>
            
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mb-5">
              <button onClick={() => setOperationType('turning')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'turning' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>🔄 Torneado</button>
              <button onClick={() => setOperationType('milling')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'milling' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>⚙️ Fresado</button>
              <button onClick={() => setOperationType('drilling')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${operationType === 'drilling' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>🔩 Taladrado</button>
            </div>
            
            <div className="space-y-4 flex-grow">
              <div>
                <Label className="block text-xs font-bold text-slate-500 mb-1">Pieza / Operación</Label>
                <Input type="text" placeholder="Ej: Eje principal" className="w-full bg-slate-50" value={pieceName} onChange={e => setPieceName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="block text-xs font-bold text-slate-500 mb-1">Material</Label>
                  <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger className="w-full bg-slate-50"><SelectValue placeholder="Selecciona un material" /></SelectTrigger>
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
                        <Input type="number" value={profundidadAgujero} onChange={e => setProfundidadAgujero(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                )}
                <div>
                  <Label className="block text-xs font-bold text-blue-700 mb-1">Motor (HP)</Label>
                  <Input type="number" step="0.5" className="font-bold text-blue-700 bg-blue-50/50" value={machinePowerHP} onChange={e => setMachinePowerHP(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                 <div>
                  <Label className="block text-xs font-bold text-slate-500 mb-1">Costo Máq. ($/hr)</Label>
                  <Input type="number" value={machineCostHr} onChange={e => setMachineCostHr(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div>
                  <Label className="block text-xs font-bold text-slate-500 mb-1">Cambio (min)</Label>
                  <Input type="number" value={toolChangeTime} onChange={e => setToolChangeTime(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Escala Comercial integrada al fondo de esta tarjeta */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <Label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">📦 Escala Comercial</Label>
              <div className="relative">
                <Input type="number" placeholder="Ej: 1000" className="w-full text-lg font-black text-blue-700 pl-4 pr-16 h-12 bg-slate-50" value={monthlyProduction} onChange={e => setMonthlyProduction(e.target.value === "" ? "" : Number(e.target.value))} />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">pzs/mes</span>
              </div>
            </div>
          </div>

          {/* 2. SITUACIÓN ACTUAL (COMPETIDOR) */}
          <div className="bg-red-50/30 p-5 rounded-xl border border-red-100 flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>
            <h2 className="font-black text-red-700 text-sm uppercase mb-4 mt-1 flex items-center gap-2">🔴 Condición Actual</h2>
            
            <div className="grid grid-cols-2 gap-4 flex-grow">
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-800 mb-1 uppercase tracking-wider">Herramienta / Inserto Competencia</Label>
                <Input type="text" placeholder="Ej: CNMG 120408" className="border-red-200 bg-white" value={toolNameCurrent} onChange={e => setToolNameCurrent(e.target.value)} />
                {operationType === 'milling' && warningFresaCurrent && (
                    <div className={`mt-2 p-2 text-xs font-medium rounded-r-lg ${warningFresaCurrent.includes('ERROR') ? 'bg-red-100 border-l-4 border-red-500 text-red-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                        {warningFresaCurrent}
                    </div>
                )}
              </div>
              <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Costo Inserto ($)</Label><Input type="number" className="border-red-200 bg-white" value={toolCostCurrent} onChange={e => setToolCostCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Filos / Inserto</Label><Input type="number" placeholder="Ej: 4" className="border-red-200 bg-white" value={edgesCurrent} onChange={e => setEdgesCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              
              {operationType === 'milling' || operationType === 'drilling' ? (
                <div><Label className="block text-[10px] font-bold text-red-600 mb-1">{operationType === 'milling' ? 'Diámetro Fresa (Dc) mm' : 'Diámetro Broca (Dc) mm'}</Label><Input type="number" className="border-red-200 bg-white" value={dcCurrent} onChange={e => setDcCurrent(e.target.value === '' ? '' : Number(e.target.value))} /></div>
              ) : null}

              {operationType === 'milling' ? (
                <>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Ancho Corte (ae) mm</Label><Input type="number" step="0.1" className="border-red-200 bg-white" value={aeCurrent} onChange={e => setAeCurrent(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Prof. Corte (ap) mm</Label><Input type="number" step="0.1" className="border-red-200 bg-white" value={apCurrent} onChange={e => setApCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                  <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Cant. Dientes (Z)</Label><Input type="number" className="border-red-200 bg-white" value={zCurrent} onChange={e => setZCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                </>
              ) : operationType === 'turning' ? (
                 <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Prof. Corte (ap) mm</Label><Input type="number" step="0.1" className="border-red-200 bg-white" value={apCurrent} onChange={e => setApCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              ) : null}

              <div>
                  <Label className="block text-[10px] font-bold text-red-600 mb-1">{operationType === 'turning' ? 'Avance (mm/rev)' : operationType === 'milling' ? 'Avance (mm/z)' : 'Avance (mm/rev)'}</Label>
                  <Input type="number" step="0.01" className="border-red-200 bg-white" value={feedCurrent} onChange={e => setFeedCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
                  {operationType === 'turning' && raActual && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                          Acabado Teórico (Ra): <span className="text-red-600 font-bold">{raActual} µm</span>
                      </p>
                  )}
              </div>
              
              <div><Label className="block text-[10px] font-bold text-red-600 mb-1">Vc Actual (m/min)</Label><Input type="number" className="border-red-200 bg-white" value={vcCurrent} onChange={e => setVcCurrent(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-600 mb-1">{operationType === 'milling' ? 'Minutos / filo' : operationType === 'drilling' ? 'Agujeros / filo' : 'Pzas / filo'}</Label>
                <Input type="number" className="border-red-200 bg-white" placeholder={operationType === 'milling' ? 'Ej: 45' : operationType === 'drilling' ? 'Ej: 500' : 'Ej: 120'} value={pcsCurrent} onChange={e => setPcsCurrent(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-red-700 mb-1">Tiempo Actual (Corte)</Label>
                <div className="flex gap-2">
                  <div className="relative w-1/2"><Input type="number" className="pr-7 border-red-300 font-bold bg-white disabled:bg-slate-100" value={tcCurrentMin} onChange={e => setTcCurrentMin(e.target.value === "" ? "" : Number(e.target.value))} disabled={operationType === 'drilling'} /><span className="absolute right-2 top-2.5 text-[10px] font-bold text-red-400">min</span></div>
                  <div className="relative w-1/2"><Input type="number" className="pr-7 border-red-300 font-bold bg-white disabled:bg-slate-100" value={tcCurrentSec} onChange={e => setTcCurrentSec(e.target.value === "" ? "" : Number(e.target.value))} disabled={operationType === 'drilling'} /><span className="absolute right-2 top-2.5 text-[10px] font-bold text-red-400">seg</span></div>
                </div>
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
            {chipbreakerAuditCurrent && (
              <div className={`mt-4 p-3 text-xs font-medium rounded-lg ${chipbreakerAuditCurrent.includes('✅') ? 'bg-green-100 border-l-4 border-green-500 text-green-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                {chipbreakerAuditCurrent}
              </div>
            )}
            {/* Progress Bar alineada al fondo */}
            <div className="mt-6 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga Husillo</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    curveDataInfo.loadCurrent > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {curveDataInfo.loadCurrent.toFixed(1)}%
                  </span>
                </div>
                <span className={`text-xs font-black ${getLoadColor(curveDataInfo.loadCurrent).text}`}>⚡ {curveDataInfo.hpCurrent.toFixed(1)} HP</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden"><div className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(curveDataInfo.loadCurrent).bar}`} style={{ width: `${Math.min(curveDataInfo.loadCurrent, 100)}%` }}></div></div>
              <p className={`text-[9px] font-bold text-right uppercase ${getLoadColor(curveDataInfo.loadCurrent).text}`}>{getLoadColor(curveDataInfo.loadCurrent).label}</p>
            </div>
          </div>

          {/* 3. PROPUESTA PREMIUM */}
          <div className="bg-green-50/30 p-5 rounded-xl border border-green-200 flex flex-col h-full relative overflow-hidden shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>
            <h2 className="font-black text-green-700 text-sm uppercase mb-4 mt-1 flex items-center gap-2">🟢 Propuesta (Secocut)</h2>
            
            <div className="grid grid-cols-2 gap-4 flex-grow">
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1 uppercase tracking-wider">Herramienta / Inserto Seco</Label>
                <Input type="text" placeholder="Ej: CNMG 120408-M3W TP2501" className="border-green-300 bg-white shadow-inner font-bold text-green-900" value={toolNamePremium} onChange={e => setToolNamePremium(e.target.value)} />
                 {operationType === 'milling' && warningFresaPremium && (
                    <div className={`mt-2 p-2 text-xs font-medium rounded-r-lg ${warningFresaPremium.includes('ERROR') ? 'bg-red-100 border-l-4 border-red-500 text-red-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                        {warningFresaPremium}
                    </div>
                )}
              </div>
              <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Costo Inserto ($)</Label><Input type="number" className="border-green-200 bg-white" value={toolCostPremium} onChange={e => setToolCostPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Filos / Inserto</Label><Input type="number" placeholder="Ej: 8" className="border-green-200 bg-white" value={edgesPremium} onChange={e => setEdgesPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              
              {operationType === 'milling' || operationType === 'drilling' ? (
                <div><Label className="block text-[10px] font-bold text-green-700 mb-1">{operationType === 'milling' ? 'Diámetro Fresa (Dc) mm' : 'Diámetro Broca (Dc) mm'}</Label><Input type="number" className="border-green-200 bg-white" value={dcPremium} onChange={e => setDcPremium(e.target.value === '' ? '' : Number(e.target.value))} /></div>
              ) : null}

              {operationType === 'milling' ? (
                <>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Ancho Corte (ae) mm</Label><Input type="number" step="0.1" className="border-green-200 bg-white" value={aePremium} onChange={e => setAePremium(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Prof. Corte (ap) mm</Label><Input type="number" step="0.1" className="border-green-200 bg-white" value={apPremium} onChange={e => setApPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                  <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Cant. Dientes (Z)</Label><Input type="number" className="border-green-200 bg-white" value={zPremium} onChange={e => setZPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                </>
              ) : operationType === 'turning' ? (
                <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Prof. Corte (ap) mm</Label><Input type="number" step="0.1" className="border-green-200 bg-white" value={apPremium} onChange={e => setApPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              ) : null }

              <div>
                  <Label className="block text-[10px] font-bold text-green-700 mb-1">{operationType === 'turning' ? 'Avance (mm/rev)' : operationType === 'milling' ? 'Avance (mm/z)' : 'Avance (mm/rev)'}</Label>
                  <Input type="number" step="0.01" className="border-green-200 bg-white" value={feedPremium} onChange={e => setFeedPremium(e.target.value === "" ? "" : Number(e.target.value))} />
                  {operationType === 'turning' && raPropuesta && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                          Acabado Teórico (Ra): <span className="text-green-600 font-bold">{raPropuesta} µm</span>
                      </p>
                  )}
              </div>

              <div><Label className="block text-[10px] font-bold text-green-700 mb-1">Vc Propuesta</Label><Input type="number" className="border-green-200 bg-white" value={vcPremium} onChange={e => setVcPremium(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              
              <div className="col-span-2">
                 <Label className="block text-[10px] font-bold text-green-700 mb-1">{operationType === 'milling' ? 'Minutos / filo' : operationType === 'drilling' ? 'Agujeros / filo' : 'Pzas / filo'}</Label>
                <Input type="number" className="border-green-200 bg-white" placeholder={operationType === 'milling' ? 'Ej: 60' : operationType === 'drilling' ? 'Ej: 800' : 'Ej: 250'} value={pcsPremium} onChange={e => setPcsPremium(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              
              <div className="col-span-2">
                <Label className="block text-[10px] font-bold text-green-800 mb-1">Tiempo Deducido (Corte)</Label>
                <div className="w-full p-2 border-2 border-green-300 bg-green-100 text-green-800 rounded-md text-sm font-black flex items-center justify-center shadow-inner h-10">
                  {premiumMins} min {premiumSecs} seg
                </div>
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
            {chipbreakerAuditPremium && (
              <div className={`mt-4 p-3 text-xs font-medium rounded-lg ${chipbreakerAuditPremium.includes('✅') ? 'bg-green-100 border-l-4 border-green-500 text-green-800' : 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800'}`}>
                {chipbreakerAuditPremium}
              </div>
            )}
            {/* Progress Bar alineada al fondo */}
            <div className="mt-6 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Carga Husillo</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    curveDataInfo.loadPremium > 100 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {curveDataInfo.loadPremium.toFixed(1)}%
                  </span>
                </div>
                <span className={`text-xs font-black ${getLoadColor(curveDataInfo.loadPremium).text}`}>⚡ {curveDataInfo.hpPremium.toFixed(1)} HP</span>
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
                            setTargetSavings(''); // Reset target savings

                            // Calculate and set base cost
                            const safeMachineCostMin = (Number(machineCostHr) || 0) / 60;
                            const safeToolCostPremium = Number(toolCostPremium) || 0;
                            const safeToolChangeTime = Number(toolChangeTime) || 0;
                            const safeZPremium = operationType === 'turning' ? 1 : (Number(zPremium) || 1);
                            const safeEdgesPremium = Number(edgesPremium) || 1;
                            
                            const costCorte = safeMachineCostMin * base.time;
                            const costPorPunta = safeEdgesPremium > 0 ? safeToolCostPremium / safeEdgesPremium : 0;
                            const costJuego = costPorPunta * safeZPremium;
                            const costHerr = base.pcs > 0 ? costJuego / base.pcs : 0;
                            const costCambio = base.pcs > 0 ? (safeMachineCostMin * safeToolChangeTime) / base.pcs : 0;
                            const baseCost = costCorte + costHerr + costCambio;
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
        </div>

        {/* GRAFICO (Ancho Completo Abajo) */}
        <Card>
            <CardHeader>
                <CardTitle>Curva de Costo vs. Velocidad</CardTitle>
                <CardDescription>Los puntos marcan el costo operativo real en la Vc seleccionada.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curveDataInfo.data} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" dataKey="speed" domain={['dataMin', 'dataMax']} label={{ value: 'Velocidad de Corte Vc (m/min)', position: 'bottom', offset: 15 }} tick={{fontSize: 12}} />
                        <YAxis label={{ value: 'Costo Total Relativo', angle: -90, position: 'insideLeft', offset: 0 }} tick={{fontSize: 12}} tickFormatter={(value) => formatCurrency(value).replace('USD ', '$')} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }} />
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
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

       {/* EL GRAN REMATE VISUAL - AHORRO MENSUAL */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-8 text-center shadow-2xl relative overflow-hidden mt-6">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black opacity-10 rounded-full blur-2xl"></div>
        
        <p className="relative z-10 text-green-100 font-bold tracking-widest uppercase text-sm mb-2">💰 Impacto Financiero Proyectado</p>
        <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white drop-shadow-md mb-3">
          {formatCurrency(curveDataInfo.monthlySavings)}
        </h2>
        <p className="relative z-10 text-lg text-green-50 font-medium">
          Ahorro mensual neto al fabricar <span className="font-bold text-white bg-green-700 px-2 py-1 rounded">{formatNumber(Number(monthlyProduction))} piezas</span> con tecnología Secocut.
        </p>
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

      {/* BOTÓN FLOTANTE DEL COPILOTO */}
      <button
        onClick={() => setIsCopilotOpen(!isCopilotOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-50 border-2 border-slate-700"
      >
        <span className="text-2xl">🤖</span>
      </button>

      {/* DRAWER DEL COPILOTO */}
      <div className={`fixed top-0 right-0 h-full w-[320px] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col ${isCopilotOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header Drawer */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="font-black text-slate-800 tracking-tight">Copiloto Seco</h3>
          </div>
          <button onClick={() => setIsCopilotOpen(false)} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Zona de Mensajes */}
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

        {/* Input Footer */}
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

        {/* MODAL DE GUARDADO EN CRM */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 p-4">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                💾 Guardar Simulación
              </h3>
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
              <button 
                onClick={() => setIsSaveModalOpen(false)} 
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancelar
              </button>
              
              <button 
                onClick={async () => {
                  if (!saveClientName.trim() || !saveCaseName.trim()) {
                    alert("⚠️ Por favor, completa el nombre del Cliente y de la Operación para poder guardar.");
                    return;
                  }

                  if (!user) {
                      alert("Debes iniciar sesión para guardar este análisis.");
                      return;
                  }
                  
                  setIsSaving(true);
                  try {
                    console.log("1. Iniciando proceso de guardado...");
                    let pdfDownloadUrl = "";

                    // BLOQUE AISLADO PARA EL PDF (Si falla, no bloquea el guardado en BD)
                    try {
                      console.log("2. Generando PDF...");
                      const pdfBlob = await handleGeneratePDF('blob'); // Changed this
                      
                      if (pdfBlob && storage) {
                        console.log("3. Subiendo PDF a Storage...");
                        const safeFileName = (pieceName || 'Sin_Nombre').replace(/\s+/g, '_');
                        const fileName = `taylor_reports/Simulacion_${safeFileName}_${Date.now()}.pdf`;
                        const storageRef = ref(storage, fileName);
                        await uploadBytes(storageRef, pdfBlob);
                        pdfDownloadUrl = await getDownloadURL(storageRef);
                      }
                    } catch (pdfError) {
                      console.warn("⚠️ Advertencia: No se pudo generar o subir el PDF. Guardando solo los datos. Error:", pdfError);
                    }

                    console.log("4. Guardando en Firestore...");
                    const payload = {
                      clientName: saveClientName,
                      caseName: saveCaseName || pieceName || 'Análisis sin nombre',
                      status: 'pending', // <-- AHORA NACE COMO 'PENDING' PARA LA NUEVA TABLA
                      annualSavings: (curveDataInfo.realAbsoluteSavings * (Number(monthlyProduction)||0)) * 12,
                      pdfUrl: pdfDownloadUrl || "", // Puede estar vacío si el PDF falló
                      dateCreated: serverTimestamp(),
                      userId: user.uid, 
                      taylorInputs: { 
                        operationType,
                        materialId,
                        machineCostHr,
                        toolChangeTime,
                        pieceName,
                        machinePowerHP,
                        profundidadAgujero,
                        monthlyProduction,
                        // Current
                        toolNameCurrent,
                        toolCostCurrent,
                        apCurrent,
                        feedCurrent,
                        vcCurrent,
                        pcsCurrent,
                        tcCurrentMin,
                        tcCurrentSec,
                        zCurrent,
                        edgesCurrent,
                        dcCurrent,
                        aeCurrent,
                        // Premium
                        toolNamePremium,
                        toolCostPremium,
                        apPremium,
                        feedPremium,
                        vcPremium,
                        pcsPremium,
                        zPremium,
                        edgesPremium,
                        dcPremium,
                        aePremium,
                      }
                    };

                    await addDoc(collection(db, "analisis_costos"), payload);
                    
                    console.log("5. ¡Proceso completado con éxito!");
                    setIsSaveModalOpen(false);
                    alert("¡Análisis guardado exitosamente en el Historial!");
                  } catch (error) {
                    console.error("Error CRÍTICO al guardar en BD:", error);
                    alert(`Fallo al guardar en la base de datos. El sistema dice: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
                  } finally {
                    setIsSaving(false);
                  }
                }} 
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isSaving ? '⏳ Guardando...' : 'Guardar Análisis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SIMULADOR TAYLOR */}
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
                        id="target-savings"
                        type="number"
                        placeholder="Ej: 15"
                        value={targetSavings}
                        onChange={(e) => setTargetSavings(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full md:w-1/2 border-purple-300 focus-visible:ring-purple-500"
                    />
                    <p className="text-xs text-muted-foreground">Ingresa un % de ahorro y el simulador encontrará la Vc necesaria.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    {/* Controles */}
                    <div className="space-y-6">
                        <div>
                            <Label className="font-bold">Velocidad de Corte (Vc)</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    min={taylorBase.vc * 0.7}
                                    max={taylorBase.vc * 1.5}
                                    step={1}
                                    value={[simulatedVc]}
                                    onValueChange={(val) => setSimulatedVc(val[0])}
                                />
                                <span className="font-bold text-blue-600 w-24 text-center border rounded-md p-2">{simulatedVc.toFixed(0)} m/min</span>
                            </div>
                        </div>
                        <div>
                            <Label className="font-bold">Avance (f)</Label>
                             <div className="flex items-center gap-4">
                                <Slider
                                    min={taylorBase.feed * 0.7}
                                    max={taylorBase.feed * 1.5}
                                    step={0.01}
                                    value={[simulatedFeed]}
                                    onValueChange={(val) => setSimulatedFeed(val[0])}
                                />
                                <span className="font-bold text-blue-600 w-24 text-center border rounded-md p-2">{simulatedFeed.toFixed(2)} mm/rev</span>
                            </div>
                        </div>
                    </div>
                    {/* Resultados */}
                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
                        <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">⏱️ Nuevo Tiempo de Ciclo</p>
                            <p className="text-2xl font-black text-slate-800">{simulationResult ? formatoMinutosYSegundos(simulationResult.newTime) : '-'}</p>
                        </div>
                         <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">⚙️ Nueva Vida Útil</p>
                            <p className="text-2xl font-black text-slate-800">{simulationResult ? formatNumber(simulationResult.newPcs) : '-'} pzas/filo</p>
                        </div>
                         <div className="text-center p-3 border rounded-lg bg-white">
                            <p className="text-xs font-bold text-slate-500 uppercase">Acabado Teórico (Ra)</p>
                            <p className={`text-2xl font-black ${simulationResult && simulationResult.newRa && Number(simulationResult.newRa) > 3.2 ? 'text-red-500' : 'text-slate-800'}`}>
                                {simulationResult?.newRa ? `${simulationResult.newRa} µm` : '-'}
                            </p>
                        </div>
                         <div className="text-center p-3 border rounded-lg bg-white shadow-inner border-green-200">
                            <p className="text-xs font-bold text-green-700 uppercase">💰 Nuevo Costo por Pieza</p>
                            {simulationResult ? (
                                <div className="flex justify-center items-center gap-2 mt-1">
                                    <span className="font-black text-green-600 text-2xl">{formatCurrency(simulationResult.newCost)}</span>
                                    {taylorBaseCost > 0 && simulationResult.newCost < taylorBaseCost && parseFloat(porcentajeAhorroSimulado) > 0 && (
                                        <span className="bg-green-100 text-green-800 font-bold px-2 py-1 rounded-full text-sm">
                                            ↓ {porcentajeAhorroSimulado}%
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-2xl font-black text-green-600">-</p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsTaylorModalOpen(false)}>Cancelar</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                        if (simulationResult) {
                            const newTime = simulationResult.newTime;
                            const newTimeMin = Math.floor(newTime);
                            const newTimeSec = Math.round((newTime - newTimeMin) * 60);

                            setVcPremium(simulatedVc);
                            setFeedPremium(simulatedFeed);
                            setPcsPremium(simulationResult.newPcs);
                            // Este es el único lugar donde necesitamos escribir al form directamente
                            // ya que el estado local es la fuente de verdad.
                            // Para el resto de los campos usamos el estado local.
                            // Aquí usamos los equivalentes de la propuesta
                            // setTcPremiumMin(newTimeMin);
                            // setTcPremiumSec(newTimeSec);
                        }
                        setIsTaylorModalOpen(false);
                    }}>
                        Aplicar estos parámetros
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


        {/* PLANTILLA OCULTA PARA PDF (Renderizada fuera de pantalla para html2canvas) */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1 }}>
          <div id="pdf-pagina-1" className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans box-border flex flex-col">
            
            {/* HEADER DEL PDF CON LOGOS UNIFICADO */}
            <div className="relative mb-8 pb-4 border-b-2 border-slate-800">
              <div className="flex justify-between items-start mb-8 h-16">
                {logos.company ? (
                  <img src={logos.company} alt="Logo Empresa" crossOrigin="anonymous" className="h-full object-contain max-w-[250px] object-left" />
                ) : (
                  <div className="h-12 flex items-center justify-center bg-blue-600 text-white font-black px-4 rounded text-lg">SECOCUT</div>
                )}
                
                {logos.brand ? (
                  <img src={logos.brand} alt="Logo Marca" crossOrigin="anonymous" className="h-full object-contain max-w-[200px] object-right" />
                ) : (
                  <div className="h-12 flex items-center justify-center text-slate-800 font-black text-3xl">Seco</div>
                )}
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
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div><p className="text-slate-500">Material:</p><p className="font-bold">{materialId}</p></div>
                <div><p className="text-slate-500">Costo Máquina:</p><p className="font-bold">{formatCurrency(Number(machineCostHr))}</p></div>
                <div><p className="text-slate-500">Tiempo Cambio Herr.:</p><p className="font-bold">{toolChangeTime} min</p></div>
                <div><p className="text-slate-500">Producción Mensual:</p><p className="font-bold">{formatNumber(Number(monthlyProduction))} pzs/mes</p></div>
              </div>
            </div>

            <div className="mb-6">
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
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Incidencia (Holgura)</td>
                    <td className="p-2 border border-slate-300 text-center">{obtenerAnguloTexto(toolNameCurrent)}</td>
                    <td className="p-2 border border-slate-300 text-center bg-green-50 font-medium">{obtenerAnguloTexto(toolNamePremium)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Precio Inserto</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostCurrent))}</td>
                    <td className="p-2 border border-slate-300 text-center">{formatCurrency(Number(toolCostPremium))}</td>
                  </tr>
                   <tr>
                    <td className="p-2 border border-slate-300 font-bold">Profundidad de Corte (ap)</td>
                    <td className="p-2 border border-slate-300 text-center">{apCurrent} mm</td>
                    <td className="p-2 border border-slate-300 text-center">{apPremium} mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Tiempo de Corte (min)</td>
                    <td className="p-2 border border-slate-300 text-center">{`${tcCurrentMin || 0}m ${tcCurrentSec || 0}s`}</td>
                    <td className="p-2 border border-slate-300 text-center">{`${premiumMins}m ${premiumSecs}s`}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Velocidad de Corte (Vc)</td>
                    <td className="p-2 border border-slate-300 text-center">{vcCurrent} m/min</td>
                    <td className="p-2 border border-slate-300 text-center">{vcPremium} m/min</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Avance (f)</td>
                    <td className="p-2 border border-slate-300 text-center">{feedCurrent} {operationType === 'turning' ? 'mm/rev' : 'mm/z'}</td>
                    <td className="p-2 border border-slate-300 text-center">{feedPremium} {operationType === 'turning' ? 'mm/rev' : 'mm/z'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Rendimiento (Pzas/Filo)</td>
                    <td className="p-2 border border-slate-300 text-center">{pcsCurrent} pzs</td>
                    <td className="p-2 border border-slate-300 text-center">{pcsPremium} pzs</td>
                  </tr>
                   <tr className="bg-slate-100">
                    <td className="p-2 border border-slate-300 font-bold">Rugosidad Teórica (Ra)</td>
                    <td className="p-2 border border-slate-300 text-center">
                        {`${raActual ?? 'N/A'} µm`}
                    </td>
                    <td className="p-2 border border-slate-300 text-center bg-slate-50 font-medium">
                        {`${raPropuesta ?? 'N/A'} µm`}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">Consumo de Motor</td>
                    <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpCurrent.toFixed(1)} HP ({curveDataInfo.loadCurrent.toFixed(1)}%)</td>
                    <td className="p-2 border border-slate-300 text-center">{curveDataInfo.hpPremium.toFixed(1)} HP ({curveDataInfo.loadPremium.toFixed(1)}%)</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-300 font-bold text-slate-800">Costo Real por Pieza</td>
                    <td className="p-2 border border-slate-300 font-bold text-red-600 text-center">{isFinite(curveDataInfo.actualCostCurrent) ? formatCurrency(curveDataInfo.actualCostCurrent) : 'N/A'}</td>
                    <td className="p-2 border border-slate-300 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="font-bold text-green-600">{isFinite(curveDataInfo.actualCostPremium) ? formatCurrency(curveDataInfo.actualCostPremium) : 'N/A'}</span>
                        {curveDataInfo.realSavingsPercentage > 0.1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-green-700 font-bold text-xl">
                                    {isFinite(curveDataInfo.actualCostPremium) ? formatCurrency(curveDataInfo.actualCostPremium) : 'N/A'}
                                </span>
                                <span className="bg-green-100 text-green-800 font-bold px-2 py-1 rounded-full text-sm">
                                    ↓ {porcentajeAhorro}%
                                </span>
                            </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
              <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2 mt-2">Ahorro Mensual Proyectado</p>
              <p className="text-5xl font-black text-green-800 mb-2">
                {formatCurrency(curveDataInfo.monthlySavings)}
              </p>
              <div className="inline-block bg-green-100 px-4 py-2 rounded-full mt-2">
                <p className="text-sm font-bold text-green-800">
                  Basado en {formatNumber(Number(monthlyProduction))} piezas/mes • Ahorro unitario: {formatCurrency(curveDataInfo.realAbsoluteSavings)}
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
                </LineChart>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
              Documento generado automáticamente por Simulador de Competitividad Secocut SRL.
            </div>
          </div>
        </div>
    </>
  );
}
