/**
 * taylor-helpers.ts
 * Funciones puras de cálculo y auditoría usadas por la curva de Taylor —
 * geometría de insertos, viabilidad de parámetros, avance lineal, Taylor inverso
 * (vida en minutos), remoción de material y espesor de viruta.
 * Extraído de taylor-curve/page.tsx y taylor-curve/[id]/edit/page.tsx, que las
 * tenían duplicadas de forma idéntica (o con diferencias solo de formato).
 *
 * Excepción de dominio: auditarMaterialFresado difería entre los dos archivos
 * ('MP'/'MK' con match parcial en page.tsx vs 'MP15'/'MK15' exacto en edit/page.tsx).
 * Se confirmó con el usuario que no existe una lista real de grados PVD en el código
 * (CALIDADES_SECO solo tiene "MS2050" y no se usa para validar esto — codigoGrado es
 * texto libre que tipea el usuario). Se mantiene la versión de page.tsx: match parcial
 * 'MP'/'MK' y el texto con dos ejemplos ("MS2050 o F15M").
 */

import { MATERIALS, dataDoubleTurbo, type LifeMode } from './taylor-data';

export const calcularFzSugerido = (ae: number | string, dc: number | string, materialSMG: string, rompeviruta: string) => {
  const ratio = (Number(ae) / Number(dc));
  if (isNaN(ratio) || ratio <= 0) return null;

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

export const extraerRadioISO = (codigoInserto: string): number | null => {
  if (!codigoInserto) return null;
  const partePrincipal = codigoInserto.split('-')[0];
  const soloNumeros = partePrincipal.replace(/\D/g, '');
  if (soloNumeros.length >= 2) return parseInt(soloNumeros.slice(-2), 10) / 10;
  return null;
};

export const analizarRompevirutas = (codigoInserto: string): { esWiper: boolean; tipoCorte: string; sufijo: string } => {
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

export const auditarParametros = (ap: number | string, avance: number | string, codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  if (!radio || !ap || !avance) return null;
  const apNum = Number(ap);
  const avanceNum = Number(avance);
  if (apNum < radio) return `⚠️ Riesgo de Vibración: Tu ap (${apNum}mm) es menor al radio del inserto (${radio}mm). Las fuerzas radiales empujarán la pieza.`;
  if (avanceNum > (radio * 0.5)) return `⚠️ Avance Excesivo: Un avance de ${avanceNum} mm/rev es muy alto para un radio de ${radio}mm. Límite sugerido: ${(radio*0.5).toFixed(2)} mm/rev.`;
  return null;
};

export const auditarAplicacion = (ap: number | string, codigoInserto: string): string | null => {
  if (!ap || !codigoInserto) return null;
  const { tipoCorte } = analizarRompevirutas(codigoInserto);
  const apNum = Number(ap);
  if (tipoCorte === 'Terminacion' && apNum > 1.5) return `⚠️ Cuidado: Estás usando un rompevirutas de Terminación con un ap de ${apNum}mm. La viruta se va a atascar y romperá el filo.`;
  if (tipoCorte === 'Desbaste' && apNum < 1.0) return `⚠️ Cuidado: Estás usando un rompevirutas de Desbaste Pesado para un corte muy fino (${apNum}mm). La viruta no va a romper y saldrá en hilos largos.`;
  return null;
};

export const calcularRaTeorico = (avance: number | string, codigoInserto: string): string | null => {
  const radio = extraerRadioISO(codigoInserto);
  const avanceNum = Number(avance);
  if (!avanceNum || !radio || radio <= 0) return null;
  let ra_micrones = (Math.pow(avanceNum, 2) / (32 * radio)) * 1000;
  const { esWiper } = analizarRompevirutas(codigoInserto);
  if (esWiper) ra_micrones = ra_micrones / 2;
  return ra_micrones.toFixed(2);
};

export const analizarInsertoFresado = (codigoInserto: string): { formaPlaquita: string, incidenciaPlaquita: string, geometriaFilo: string, alertaGeometria: string | null } | null => {
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

export const auditarMaterialFresado = (codigoGrado: string, materialSeleccionado: string): string | null => {
  if (!codigoGrado || !materialSeleccionado) return null;
  const grado = codigoGrado.toUpperCase();
  const material = materialSeleccionado.toLowerCase();
  if (grado.includes('PCD') && (material.includes('acero') || material.includes('fundicion'))) return '❌ ERROR CRÍTICO: El PCD (Diamante) reacciona químicamente con el hierro a altas temperaturas. Solo usar en Aluminio, Plásticos o Titanio.';
  if (grado.includes('PCBN') && material.includes('aluminio')) return '⚠️ ALERTA DE COSTO: El PCBN es extremadamente caro y está diseñado para aceros templados >45HRC o fundición gris. Para aluminio, usa plaquitas no recubiertas (Ej: H15) o PCD.';
  if ((grado.includes('MP') || grado.includes('MK')) && (material.includes('titanio') || material.includes('inconel'))) return '💡 SUGERENCIA: Para Titanio se recomiendan calidades PVD (Ej: MS2050 o F15M) por su tenacidad de filo, no CVD.';
  return null;
};

export const auditarBroca = (diametro?: number | string, profundidad?: number | string): string | null => {
  if (!diametro || !profundidad) return null;
  const numDiametro = Number(diametro);
  const numProfundidad = Number(profundidad);
  if (numDiametro <= 0 || numProfundidad <= 0) return null;
  const ratioL_D = numProfundidad / numDiametro;
  if (ratioL_D > 8) return '⚠️ Alerta de Profundidad (>8xD): Broca muy larga. Se requiere agujero piloto y reducir el avance (fn) un 20% al entrar para evitar que la broca flexe o se parta.';
  return null;
};

export const calcularVf = (f: number | string, vc: number | string, d: number | string): number => {
    const numF = Number(f); const numVc = Number(vc); const numD = Number(d);
    if (numF <= 0 || numVc <= 0 || numD <= 0) return 0;
    const rpm = (numVc * 1000) / (Math.PI * numD);
    return numF * rpm;
};

// Avance lineal real de la herramienta (mm/min), usado para convertir una vida medida
// en mm de recorrido a minutos. En fresado el avance es por diente (fz), por eso se
// multiplica por z; en torneado y taladrado ya es por vuelta (fn). El diámetro sale de
// Dc: Ø de la fresa, Ø de la broca, o Ø de la pieza en torneado.
export const calcularVfLineal = (opType: string, f: number | string, vc: number | string, d: number | string, z: number | string): number => {
    const numF = Number(f); const numVc = Number(vc); const numD = Number(d);
    if (numF <= 0 || numVc <= 0 || numD <= 0) return 0;
    const rpm = (numVc * 1000) / (Math.PI * numD);
    if (opType === 'milling') return numF * (Number(z) || 1) * rpm;
    return numF * rpm;
};

// Traduce el campo "Rendimiento" al lenguaje interno del modelo: vida del filo en minutos.
export const calcularVidaMinutos = (mode: LifeMode, valor: number | string, tc: number, vf: number): number => {
    if (mode === 'minutos') return Number(valor) || 1;
    if (mode === 'mm') { const mm = Number(valor) || 0; return mm > 0 && vf > 0 ? mm / vf : 0; }
    return (Number(valor) || 1) * tc;
};

export const calcularQ = (opType: string, ap: string | number, ae: string | number, f: string | number, vc: string | number, dc: string | number, z: string | number) => {
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

export const calcularEspesorViruta = (opType: string, f: string | number, ae: string | number, dc: string | number, ap: string | number, toolCode: string) => {
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

export function getDrillingVcRange(isoGroup: string): { min: number; max: number } {
  const group = isoGroup.replace(/^ISO\s+/i, '').trim();
  const MAP: Record<string, { min: number; max: number }> = {
    P:  { min: 80,  max: 200 },
    M:  { min: 30,  max: 80  },
    M2: { min: 30,  max: 80  },
    K:  { min: 60,  max: 150 },
    N:  { min: 100, max: 300 },
    S:  { min: 20,  max: 50  },
    S2: { min: 20,  max: 50  },
    H:  { min: 40,  max: 80  },
  };
  return MAP[group] ?? { min: 60, max: 200 };
}

export const obtenerFactorIncidencia = (codigoInserto: string): number => {
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

export const obtenerAnguloTexto = (codigoInserto: string): string => {
  if (!codigoInserto || codigoInserto.length < 2) return 'N/A';
  const segundaLetra = codigoInserto.charAt(1).toUpperCase();
  const angulos: Record<string, string> = {
    'N': '0° (Negativo)', 'A': '3°', 'B': '5°', 'C': '7°', 'P': '11°', 'D': '15°', 'E': '20°', 'F': '25°', 'G': '30°'
  };
  return angulos[segundaLetra] || 'Desconocido';
};

export const obtenerFactorForma = (codigoInserto: string): number => {
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

export const getLoadColor = (load: number) => {
    if (load < 20) return { bar: 'bg-red-500', text: 'text-red-700', label: 'Subutilizado (Sube Avance)' };
    if (load <= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Óptimo / Seguro' };
    if (load <= 95) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Desbaste Pesado' };
    return { bar: 'bg-red-600 animate-pulse', text: 'text-red-800 font-black', label: '¡PELIGRO: Sobrecarga!' };
};

export const getHmColorClass = (hm: number) => {
  if (hm < 0.05) return "text-orange-500";
  if (hm > 0.25) return "text-red-600";
  return "text-emerald-600";
};

export const calculateIncidence = (partCost: number, totalCost: number) => {
  if (!totalCost || totalCost === 0 || isNaN(partCost) || isNaN(totalCost)) return "0.0";
  return ((partCost / totalCost) * 100).toFixed(1);
};
