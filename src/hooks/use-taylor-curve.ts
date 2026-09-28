/**
 * use-taylor-curve.ts
 * Hook con los cálculos derivados del análisis de curva de Taylor: curva de costo
 * vs. velocidad, capacidad de máquina liberada, viabilidad física, alertas de
 * taladrado/refrigerante, límites de máquina y las auditorías de inserto/broca.
 *
 * Extraído de taylor-curve/page.tsx y taylor-curve/[id]/edit/page.tsx, que tenían
 * estos mismos useMemo duplicados de forma idéntica.
 *
 * Diferencia de dominio resuelta con el usuario (capacityCheck / horasDisponibles):
 * page.tsx calculaba horasDisponibles a partir de los inputs horasPorTurno y
 * turnosPorDia que carga el usuario; edit/page.tsx no tenía esos campos y usaba
 * 8h x 1 turno fijos. Para no cambiar el resultado de ninguna de las dos páginas,
 * el hook recibe horasPorTurno/turnosPorDia como parámetros — taylor-curve/page.tsx
 * le pasa sus inputs reales y edit/page.tsx le pasa 8 y 1 fijos.
 */

import { useMemo } from 'react';
import {
  calcRPM, calcVf, calcPc, calcMc, calcMcDrilling, calcPcDrilling, checkViability,
} from '@/lib/machining-physics';
import { MATERIALS_ISO } from '@/lib/materials-iso';
import { getDrillingAlert } from '@/lib/drilling-alerts';
import { getCoolantConcentration } from '@/lib/coolant-concentration';
import { formatCurrency } from '@/lib/formatters';
import { MATERIALS, TAYLOR_CONSTANTS, type LifeMode } from '@/lib/taylor-data';
import {
  calcularVfLineal, calcularVidaMinutos, calcularQ, calcularEspesorViruta,
  analizarInsertoFresado, auditarMaterialFresado, auditarBroca,
  obtenerFactorForma, obtenerFactorIncidencia,
} from '@/lib/taylor-helpers';

export interface UseTaylorCurveInputs {
  operationType: 'turning' | 'milling' | 'drilling';
  materialId: string;

  machineCostHr: string | number;
  toolChangeTime: string | number;
  machinePowerHP: string | number;
  maxTorque: string | number;
  machineEfficiency: string | number;
  coolantInternal: boolean;
  drillingOrientation: 'vertical' | 'horizontal';
  profundidadAgujero: string | number;
  monthlyProduction: string | number;
  horasPorTurno: string | number;
  turnosPorDia: string | number;
  isStressTestActive: boolean;

  toolNameCurrent: string;
  toolCostCurrent: string | number;
  apCurrent: string | number;
  feedCurrent: string | number;
  vcCurrent: string | number;
  pcsCurrent: string | number;
  tcCurrent: string | number;
  zCurrent: string | number;
  edgesCurrent: string | number;
  dcCurrent: string | number;
  aeCurrent: string | number;
  lifeModeCurrent: LifeMode;

  toolNamePremium: string;
  toolCostPremium: string | number;
  apPremium: string | number;
  feedPremium: string | number;
  vcPremium: string | number;
  pcsPremium: string | number;
  tcPremiumInput: string | number;
  zPremium: string | number;
  edgesPremium: string | number;
  dcPremium: string | number;
  aePremium: string | number;
  lifeModePremium: LifeMode;
}

export function useTaylorCurve(inputs: UseTaylorCurveInputs) {
  const {
    operationType, materialId,
    machineCostHr, toolChangeTime, machinePowerHP, maxTorque, machineEfficiency,
    coolantInternal, drillingOrientation, profundidadAgujero, monthlyProduction,
    horasPorTurno, turnosPorDia, isStressTestActive,
    toolNameCurrent, toolCostCurrent, apCurrent, feedCurrent, vcCurrent, pcsCurrent,
    tcCurrent, zCurrent, edgesCurrent, dcCurrent, aeCurrent, lifeModeCurrent,
    toolNamePremium, toolCostPremium, apPremium, feedPremium, vcPremium, pcsPremium,
    tcPremiumInput, zPremium, edgesPremium, dcPremium, aePremium, lifeModePremium,
  } = inputs;

  const analisisFresaCurrent = useMemo(() => analizarInsertoFresado(toolNameCurrent), [toolNameCurrent]);
  const alertaMaterialCurrent = useMemo(() => auditarMaterialFresado(toolNameCurrent, materialId), [toolNameCurrent, materialId]);

  const analisisFresaPremium = useMemo(() => analizarInsertoFresado(toolNamePremium), [toolNamePremium]);
  const alertaMaterialPremium = useMemo(() => auditarMaterialFresado(toolNamePremium, materialId), [toolNamePremium, materialId]);

  const warningBrocaCurrent = useMemo(() => auditarBroca(dcCurrent, profundidadAgujero), [dcCurrent, profundidadAgujero]);
  const warningBrocaPremium = useMemo(() => auditarBroca(dcPremium, profundidadAgujero), [dcPremium, profundidadAgujero]);

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

    const vfLinealCurrent = calcularVfLineal(operationType, feedCurrent, vcCurrent, dcCurrent, zCurrent);
    const vfLinealPremium = calcularVfLineal(operationType, feedPremium, vcPremium, dcPremium, zPremium);

    const vidaMinutosCompetidor = calcularVidaMinutos(lifeModeCurrent, pcsCurrent, safeTcCurrent, vfLinealCurrent);
    const constante_C_Competidor = safeVcCurrent > 0 && vidaMinutosCompetidor > 0 ? safeVcCurrent * Math.pow(vidaMinutosCompetidor, n) : 0;

    const vidaMinutosSeco = calcularVidaMinutos(lifeModePremium, pcsPremium, safeTcPremium, vfLinealPremium);
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

    let effectivePcsCurrent = lifeModeCurrent === 'piezas'
        ? (Number(pcsCurrent) || 1)
        : lifeModeCurrent === 'mm'
            ? (safeTcCurrent > 0 ? vidaMinutosCompetidor / safeTcCurrent : 0)
            : (safeTcCurrent > 0 ? (Number(pcsCurrent) || 0) / safeTcCurrent : 0);
    let effectivePcsPremium = lifeModePremium === 'piezas'
        ? (Number(pcsPremium) || 1)
        : lifeModePremium === 'mm'
            ? (safeTcPremium > 0 ? vidaMinutosSeco / safeTcPremium : 0)
            : (safeTcPremium > 0 ? (Number(pcsPremium) || 0) / safeTcPremium : 0);
    if (effectivePcsCurrent <= 0) effectivePcsCurrent = 1;
    if (effectivePcsPremium <= 0) effectivePcsPremium = 1;

    const calcCostWithBreakdown = (v: number, isPremium: boolean, feed: number) => {
        const C = isPremium ? constante_C_Seco : constante_C_Competidor;
        if (C <= 0 || v <= 0) return { costoTotal: 0, costoMaquina: 0, costoInsertoPuro: 0, costoParada: 0, lifeMins: 0, lifePcs: 0, hpReq: 0 };

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

        return { costoTotal, costoMaquina, costoInsertoPuro, costoParada, lifeMins, lifePcs: piecesPerToolLife, hpReq };
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
          // Vida del filo derivada del mismo Taylor inverso que ya alimenta el costo
          // (C = Vc·T^n despejado del dato de referencia que cargó el usuario), no
          // un dato medido ni un criterio de desgaste (VB) — ver useTaylorCurve.
          lifeMinsActual: resActual.lifeMins,
          lifeMinsPremium: resPremium.lifeMins,
          lifePcsActual: resActual.lifePcs,
          lifePcsPremium: resPremium.lifePcs,
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
        loteContinuo: effectivePcsCurrent > 0 ? (safeMonthlyProduction * (operationType === 'milling' ? (Number(zCurrent)||1) : 1)) / (effectivePcsCurrent * safeEdgesCurrent) : 0,
    };

    const desglosePremiumReal = {
        maquina: safeMachineCostMin * safeTcPremium,
        inserto: effectivePcsPremium > 0 ? ((safeToolCostPremium / safeEdgesPremium) * (operationType === 'milling' ? (Number(zPremium)||1) : 1)) / effectivePcsPremium : 0,
        parada: effectivePcsPremium > 0 ? (safeToolChangeTime * safeMachineCostMin) / effectivePcsPremium : 0,
        lote: effectivePcsPremium > 0 ? Math.ceil(safeMonthlyProduction / (effectivePcsPremium * safeEdgesPremium)) * (operationType === 'milling' ? (Number(zPremium)||1) : 1) : 0,
        loteContinuo: effectivePcsPremium > 0 ? (safeMonthlyProduction * (operationType === 'milling' ? (Number(zPremium)||1) : 1)) / (effectivePcsPremium * safeEdgesPremium) : 0,
    };

    const realAbsoluteSavings = actualCostCurrent - actualCostPremium;
    const realSavingsPercentage = actualCostCurrent > 0 ? (realAbsoluteSavings / actualCostCurrent) * 100 : 0;
    const monthlySavings = isFinite(realAbsoluteSavings) ? realAbsoluteSavings * safeMonthlyProduction : 0;

    const qCurrent = calcularQ(operationType, apCurrent, aeCurrent, feedCurrent, vcCurrent, dcCurrent, zCurrent);
    const qPremium = calcularQ(operationType, apPremium, aePremium, feedPremium, vcPremium, dcPremium, zPremium);
    const hmCurrent = calcularEspesorViruta(operationType, feedCurrent, aeCurrent, dcCurrent, apCurrent, toolNameCurrent);
    const hmPremium = calcularEspesorViruta(operationType, feedPremium, aePremium, dcPremium, apPremium, toolNamePremium);

    return { data, actualCostCurrent, actualCostPremium, realAbsoluteSavings, realSavingsPercentage, tcPremium: safeTcPremium, monthlySavings, hpCurrent, hpPremium, loadCurrent, loadPremium, velocidadOptimaSeco: optimalSpeed, costoOptimoSeco: minPremiumCost, limitHpAlert: hpLimitReached, desgloseActualReal, desglosePremiumReal, qCurrent, qPremium, hmCurrent, hmPremium, limiteTermicoActual, effectivePcsCurrent, effectivePcsPremium };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineCostHr, toolCostCurrent, toolCostPremium, toolChangeTime, materialId, apCurrent, apPremium, feedCurrent, feedPremium, vcCurrent, vcPremium, pcsCurrent, pcsPremium, tcCurrent, zCurrent, zPremium, edgesCurrent, edgesPremium, operationType, monthlyProduction, machinePowerHP, toolNameCurrent, toolNamePremium, dcCurrent, dcPremium, aeCurrent, aePremium, profundidadAgujero, lifeModeCurrent, lifeModePremium, tcPremiumInput, isStressTestActive]);

  const capacityCheck = useMemo(() => {
    const vol = Number(monthlyProduction) || 0;
    const tcComp = Number(tcCurrent) || 0;
    const tcSeco = Number(tcPremiumInput) || 0;
    if (vol <= 0 || tcComp <= 0 || tcSeco <= 0) return null;
    // ciclo efectivo por condición: misma fuente que MonthlySavingsSummary / sección 3
    const changeComp = (curveDataInfo?.effectivePcsCurrent ?? 0) > 0
      ? (Number(toolChangeTime) || 0) / curveDataInfo.effectivePcsCurrent : 0;
    const changeSeco = (curveDataInfo?.effectivePcsPremium ?? 0) > 0
      ? (Number(toolChangeTime) || 0) / curveDataInfo.effectivePcsPremium : 0;
    const hrsComp = (vol * (tcComp + changeComp)) / 60;
    const hrsSeco = (vol * (tcSeco + changeSeco)) / 60;
    const hrsDisponibles = (Number(horasPorTurno) || 8) * (Number(turnosPorDia) || 1) * 22; // 22 días hábiles
    return {
      hrsComp: Math.round(hrsComp),
      hrsSeco: Math.round(hrsSeco),
      hrsLiberadas: Math.round(hrsComp - hrsSeco),
      maqComp: hrsDisponibles > 0 ? hrsComp / hrsDisponibles : 0,
      maqSeco: hrsDisponibles > 0 ? hrsSeco / hrsDisponibles : 0,
    };
  }, [monthlyProduction, tcCurrent, tcPremiumInput, toolChangeTime, horasPorTurno, turnosPorDia, curveDataInfo]);

  const viabilityCheck = useMemo(() => {
    const mat = MATERIALS.find(m => m.nombre === materialId);
    // Cada operación arranca viruta distinto, así que cada una tiene su propio kc.
    const kcField = operationType === 'milling' ? 'kc_milling'
      : operationType === 'drilling' ? 'kc_drilling'
      : 'kc_turning';
    // El array local rotula el grupo como "ISO M"; MATERIALS_ISO lo subdivide en
    // M y M2 (y S en S y S2). Se matchea por la letra base para que el grupo
    // incluya sus subgrupos, y se promedia igual que hacía fresado.
    const group = (mat?.grupo || '').replace(/^ISO\s+/i, '').charAt(0).toUpperCase();
    const isoMatches = group ? MATERIALS_ISO.filter(m => m.isoGroup.charAt(0) === group) : [];
    // Un material que apunta a una entrada ISO concreta usa su kc exacto: promediar
    // el grupo lo diluiría con los demás aceros de la familia.
    const isoExact = mat?.isoId ? MATERIALS_ISO.find(m => m.id === mat.isoId) : undefined;
    const kc = isoExact
      ? isoExact[kcField]
      : isoMatches.length
        ? Math.round(isoMatches.reduce((s, m) => s + m[kcField], 0) / isoMatches.length)
        : (mat?.kc ?? 1800);
    const vc = Number(vcCurrent);
    const fn = Number(feedCurrent);
    const ap = Number(apCurrent);
    const dc = Number(dcCurrent) || 0;
    const eff = Number(machineEfficiency) || 0.85;
    const pw = (Number(machinePowerHP) || 15) * 0.7457;
    const tq = Number(maxTorque) || 200;
    if (vc <= 0 || fn <= 0) return null;
    if (operationType === 'drilling') {
      // Taladrado tiene su propia física: Mc crece con D² y Pc sale del torque y
      // las rpm, no de ap. Por eso no exige ap, que en taladrado nunca se carga.
      // Sin Ø no hay rpm ni Mc, así que se pide el dato en vez de juzgar sin él.
      if (dc <= 0) return { viable: true, reason: null, pc: null, mc: null };
      const rpm = calcRPM(vc, dc);
      const mc = calcMcDrilling(kc, fn, dc);
      const pc = calcPcDrilling(mc, rpm);
      return { ...checkViability(pc, mc, pw, tq), pc, mc };
    }
    if (ap <= 0) return null;
    if (operationType === 'milling') {
      if (dc <= 0) return null;
      const rpm = calcRPM(vc, dc);
      const vf = calcVf(rpm, fn) * (Number(zCurrent) || 1);
      const Q = (ap * (Number(aeCurrent) || 0) * vf) / 1000;
      if (Q <= 0) return null;
      const pcMilling = (Q * kc) / 60000;
      const mc = calcMc(kc, ap, fn, dc);
      return { ...checkViability(pcMilling, mc, pw, tq), pc: pcMilling, mc };
    }
    const pc = calcPc(kc, ap, fn, vc, eff);
    // El torque depende linealmente del diámetro: sin un Ø real cargado no se calcula
    // ni se juzga, en vez de asumir un valor por defecto que daría un veredicto falso.
    const mc = dc > 0 ? calcMc(kc, ap, fn, dc) : null;
    return { ...checkViability(pc, mc ?? 0, pw, mc === null ? 0 : tq), pc, mc };
  }, [vcCurrent, feedCurrent, apCurrent, dcCurrent, materialId, machinePowerHP, maxTorque, machineEfficiency, operationType, zCurrent, aeCurrent]);

  const drillingAlert = useMemo(() => {
    if (operationType !== 'drilling') return null;
    const depth = Number(profundidadAgujero);
    const diam = Number(dcCurrent);
    if (!depth || !diam) return null;
    return getDrillingAlert({
      coolantInternal,
      depth,
      diameter: diam,
      materialIsoGroup: MATERIALS.find(m => m.nombre === materialId)?.grupo || '',
      orientation: drillingOrientation,
    });
  }, [operationType, coolantInternal, profundidadAgujero, dcCurrent, materialId, drillingOrientation]);

  const coolantInfo = useMemo(() => {
    if (operationType !== 'drilling') return null;
    const grupo = MATERIALS.find(m => m.nombre === materialId)?.grupo || '';
    const conc = getCoolantConcentration(grupo);
    if (!conc) return null;
    return { ...conc, group: grupo.replace(/^ISO\s+/i, '') };
  }, [operationType, materialId]);

  const vcLimitMachine = useMemo(() => {
    if (operationType === 'milling') return null;
    const maxPowerKw = (Number(machinePowerHP) || 15) * 0.7457;
    const kc = MATERIALS.find(m => m.nombre === materialId)?.kc || 1800;
    const ap = Number(apCurrent) || 1;
    const fn = Number(feedCurrent) || 0.1;
    const eta = Number(machineEfficiency) || 0.85;
    const vcLimit = (maxPowerKw * 60000 * eta) / (kc * ap * fn);
    return Math.round(vcLimit);
  }, [operationType, machinePowerHP, materialId, apCurrent, feedCurrent, machineEfficiency]);

  const vfLimitMachine = useMemo(() => {
    if (operationType !== 'milling') return null;
    const maxPowerKw = (Number(machinePowerHP) || 15) * 0.7457;
    const mat = MATERIALS.find(m => m.nombre === materialId);
    const group = (mat?.grupo || '').replace(/^ISO\s+/i, '');
    const kcIsoMilling = MATERIALS_ISO.filter(m => m.isoGroup === group);
    const kc = kcIsoMilling.length
      ? Math.round(kcIsoMilling.reduce((s, m) => s + m.kc_milling, 0) / kcIsoMilling.length)
      : (mat?.kc ?? 1800);
    const ap = Number(apCurrent) || 1;
    const ae = Number(aeCurrent) || 1;
    const eta = Number(machineEfficiency) || 0.85;
    const vfMax = (maxPowerKw * 60000 * eta * 1000) / (kc * ap * ae);
    return Math.round(vfMax);
  }, [operationType, machinePowerHP, materialId, apCurrent, aeCurrent, machineEfficiency]);

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

  return {
    curveDataInfo,
    capacityCheck,
    viabilityCheck,
    drillingAlert,
    coolantInfo,
    vcLimitMachine,
    vfLimitMachine,
    insightText,
    analisisFresaCurrent,
    alertaMaterialCurrent,
    analisisFresaPremium,
    alertaMaterialPremium,
    warningBrocaCurrent,
    warningBrocaPremium,
  };
}
