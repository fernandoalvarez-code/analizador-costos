
import { useMemo } from 'react';

export type OptionInputs = {
  priceUsd: number | string;
  pcsPerEdge: number | string;
  cycleMin: number | string;
  cycleSec: number | string;
  pcsBetweenChanges: number | string;
  scrapRate: number | string;
};

export type CommonInputs = {
  machineUsdPerHour: number | string;
  toolChangeMin: number | string;
  scrapCostUsdPerPiece: number | string;
};

// Función segura para evitar divisiones por cero (Infinity / NaN)
const safeDiv = (num: number, den: number) => (den === 0 || isNaN(den) ? 0 : num / den);

export const useSimulatorCalc = (china: OptionInputs, premium: OptionInputs, common: CommonInputs) => {
  return useMemo(() => {
    const machineUsdPerHour = Number(common.machineUsdPerHour) || 0;
    const toolChangeMin = Number(common.toolChangeMin) || 0;
    const scrapCostUsdPerPiece = Number(common.scrapCostUsdPerPiece) || 0;
    
    const usdPerMin = safeDiv(machineUsdPerHour, 60);

    const calcOption = (opt: OptionInputs) => {
      const priceUsd = Number(opt.priceUsd) || 0;
      const pcsPerEdge = Number(opt.pcsPerEdge) || 0;
      const cycleMin = Number(opt.cycleMin) || 0;
      const cycleSec = Number(opt.cycleSec) || 0;
      const pcsBetweenChanges = Number(opt.pcsBetweenChanges) || 0;
      const scrapRate = Number(opt.scrapRate) || 0;
      
      const cycleDecimal = cycleMin + safeDiv(cycleSec, 60);
      const insertCostPerPiece = safeDiv(priceUsd, pcsPerEdge);
      const machineCostPerPiece = usdPerMin * cycleDecimal;
      const changeCostPerPiece = safeDiv(usdPerMin * toolChangeMin, pcsBetweenChanges);
      const scrapCostPerPiece = scrapRate * scrapCostUsdPerPiece;

      return {
        insertCostPerPiece,
        machineCostPerPiece,
        changeCostPerPiece,
        scrapCostPerPiece,
        totalCostPerPiece: insertCostPerPiece + machineCostPerPiece + changeCostPerPiece + scrapCostPerPiece
      };
    };

    const chinaCalc = calcOption(china);
    const premiumCalc = calcOption(premium);

    const competitivenessIndex = safeDiv(premiumCalc.totalCostPerPiece, chinaCalc.totalCostPerPiece);

    let trafficLight: "green" | "yellow" | "red" = "red";
    let argument = "";

    // Semáforo y Argumentos Comerciales
    if (chinaCalc.totalCostPerPiece === 0) {
        argument = "Complete los campos del competidor para iniciar el análisis.";
        trafficLight = "yellow";
    } else if (competitivenessIndex > 0 && competitivenessIndex < 0.95) {
      trafficLight = "green";
      const savingsPct = ((1 - competitivenessIndex) * 100).toFixed(1);
      argument = `¡Rentabilidad Absoluta! El inserto premium es indiscutiblemente superior. Aunque el precio de compra es de USD ${premium.priceUsd.toString()} vs USD ${china.priceUsd.toString()}, la reducción en tiempos de máquina y rechazos genera un ahorro real del ${savingsPct}% por cada pieza producida.`;
    } else if (competitivenessIndex >= 0.95 && competitivenessIndex <= 1.05) {
      trafficLight = "yellow";
      argument = `Empate Técnico en costos operativos. La ventaja clave aquí es la confiabilidad: nuestro inserto premium estabiliza el proceso, reduce roturas imprevistas y elimina dolores de cabeza para el operario, obteniendo una pieza de mayor calidad por el mismo costo final.`;
    } else {
      trafficLight = "red";
      argument = `Proceso de Baja Exigencia. El inserto actual cumple su función a muy bajo costo. Se recomienda usar nuestro inserto premium únicamente si existen problemas severos de rugosidad o tolerancias que el inserto actual no pueda cumplir.`;
    }

    return { chinaCalc, premiumCalc, competitivenessIndex, trafficLight, argument };
  }, [china, premium, common]);
};
