import * as z from "zod";

export const SimulatorOptionSchema = z.object({
  priceUsd: z.number().min(0, "El precio no puede ser negativo"),
  pcsPerEdge: z.number().min(1, "Debe hacer al menos 1 pieza"),
  cycleMinPerPiece: z.number().min(0.01, "El ciclo debe ser mayor a 0"),
  pcsBetweenChanges: z.number().min(1, "Debe ser al menos 1"),
  scrapRate: z.number().min(0).max(1, "Debe ser entre 0 (0%) y 1 (100%)"),
});

export const SimulatorSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  material: z.string().optional(),
  operationType: z.string().optional(),
  machineUsdPerHour: z.number().min(1, "Costo de máquina obligatorio"),
  toolChangeMin: z.number().min(0, "No puede ser negativo"),
  scrapCostUsdPerPiece: z.number().min(0, "No puede ser negativo"),
  notes: z.string().optional(),
  china: SimulatorOptionSchema,
  premium: SimulatorOptionSchema,
});
