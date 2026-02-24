
import { useMemo } from 'react';

export type OptionInputs = {
  priceUsd: number;
  pcsPerEdge: number;
  cycleMinPerPiece: number;
  pcsBetweenChanges: number;
  scrapRate: number;
};

export type CommonInputs = {
  machineUsdPerHour: number;
  toolChangeMin: number;
  scrapCostUsdPerPiece: number;
};

// Función segura para evitar divisiones por cero (Infinity / NaN)
const safeDiv = (num: number, den: number) => (den === 0 || isNaN(den) ? 0 : num / den);

export const useSimulatorCalc = (china: OptionInputs, premium: OptionInputs, common: CommonInputs) => {
  return useMemo(() => {
    const usdPerMin = safeDiv(common.machineUsdPerHour, 60);

    const calcOption = (opt: OptionInputs) => {
      const insertCostPerPiece = safeDiv(opt.priceUsd, opt.pcsPerEdge);
      const machineCostPerPiece = usdPerMin * opt.cycleMinPerPiece;
      const changeCostPerPiece = safeDiv(usdPerMin * common.toolChangeMin, opt.pcsBetweenChanges);
      const scrapCostPerPiece = opt.scrapRate * common.scrapCostUsdPerPiece;

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
    if (competitivenessIndex > 0 && competitivenessIndex < 0.95) {
      trafficLight = "green";
      const savingsPct = ((1 - competitivenessIndex) * 100).toFixed(1);
      argument = `¡Rentabilidad Absoluta! El inserto premium es indiscutiblemente superior. Aunque el precio de compra es de USD ${premium.priceUsd.toFixed(2)} vs USD ${china.priceUsd.toFixed(2)}, la reducción en tiempos de máquina y rechazos genera un ahorro real del ${savingsPct}% por cada pieza producida.`;
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
