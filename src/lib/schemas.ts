import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

export const SignupSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});


export const QuickDiagnosisSchema = z.object({
  currentToolCost: z.coerce.number().min(0, "El costo debe ser positivo."),
  proposedToolCost: z.coerce.number().min(0, "El costo debe ser positivo."),
  cycleTimeReduction: z.coerce.number().min(0, "La reducción no puede ser negativa.").max(100, "La reducción no puede ser mayor a 100%."),
});

export const DetailedReportSchema = QuickDiagnosisSchema.extend({
  partsProducedPerShift: z.coerce.number().min(1, "Debe ser al menos 1."),
  shiftsPerDay: z.coerce.number().min(1, "Debe ser al menos 1."),
  daysPerWeek: z.coerce.number().min(1, "Debe ser al menos 1."),
  weeksPerYear: z.coerce.number().min(1, "Debe ser al menos 1."),
  machineHourlyRate: z.coerce.number().min(0, "La tarifa debe ser positiva."),
  currentTool: z.string().min(1, "El nombre de la herramienta es requerido."),
  proposedTool: z.string().min(1, "El nombre de la herramienta es requerido."),
});

export const SavingsInsightsSchema = z.object({
  currentTool: z.string().min(1, "El nombre de la herramienta actual es requerido."),
  currentToolCost: z.coerce.number().positive("El costo debe ser un número positivo."),
  proposedTool: z.string().min(1, "El nombre de la herramienta propuesta es requerido."),
  proposedToolCost: z.coerce.number().positive("El costo debe ser un número positivo."),
  cycleTimeReduction: z.coerce.number().min(0, "La reducción no puede ser negativa.").max(100, "La reducción no puede superar el 100%."),
  partsProducedPerShift: z.coerce.number().int().positive("Debe ser un entero positivo."),
  shiftsPerDay: z.coerce.number().int().positive("Debe ser un entero positivo."),
  daysPerWeek: z.coerce.number().int().positive("Debe ser un entero positivo."),
  weeksPerYear: z.coerce.number().int().positive("Debe ser un entero positivo."),
  machineHourlyRate: z.coerce.number().positive("La tarifa horaria debe ser un número positivo."),
});
