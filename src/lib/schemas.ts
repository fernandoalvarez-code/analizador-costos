
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
  costoHoraMaquina: z.coerce.number().min(0, "El costo debe ser positivo."),
  piezasAlMes: z.coerce.number().min(0, "El valor debe ser positivo.").optional(),
  
  precioA: z.coerce.number().min(0, "El costo debe ser positivo.").optional(),
  filosA: z.coerce.number().min(1, "Debe tener al menos 1 filo.").optional(),
  pzsPorFiloA: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  cicloMinA: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  cicloSegA: z.coerce.number().min(0).max(59, "No puede exceder 59 segundos.").optional(),
  vcA: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),

  precioB: z.coerce.number().min(0, "El costo debe ser positivo.").optional(),
  
  // Paso 2: Ahorro Neto Real
  piezasMasReales: z.coerce.number().min(0, "Debe ser un valor positivo.").default(0),
  modoSimulacionTiempo: z.enum(['segundos', 'vc']).default('segundos'),
  segundosMenosReales: z.coerce.number().min(0, "Debe ser un valor positivo.").default(0),
  vcBReal: z.coerce.number().min(0, "Debe ser un valor positivo.").default(0),

  // Estos no son del form pero se usan en los calculos
  filosB: z.coerce.number().min(1, "Debe tener al menos 1 filo.").optional(),
  pzsPorFiloB: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  cicloMinB: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  cicloSegB: z.coerce.number().min(0).max(59, "No puede exceder 59 segundos.").optional(),
  vcB: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
});

export const DetailedReportSchema = z.object({
  // Datos del informe
  cliente: z.string().optional(),
  fecha: z.string().optional(),
  contacto: z.string().optional(),
  operacion: z.string().optional(),
  pieza: z.string().optional(),

  // Datos Generales
  machineHourlyRate: z.coerce.number().min(0, "La tarifa debe ser positiva."),
  piezasAlMes: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  tiempoParada: z.coerce.number().min(0, "Debe ser un valor positivo.").default(2),

  // Herramienta A
  descA: z.string().optional(),
  precioA: z.coerce.number().min(0, "El costo debe ser positivo.").optional(),
  filosA: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  cicloMinA: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  cicloSegA: z.coerce.number().min(0).max(59, "No puede exceder 59 segundos.").optional(),
  vcA: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  modoVidaA: z.enum(['piezas', 'minutos']).default('piezas'),
  piezasFiloA: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  minutosFiloA: z.coerce.number().min(0, "Debe ser un valor positivo."),
  notasA: z.string().optional(),

  // Herramienta B
  descB: z.string().optional(),
  precioB: z.coerce.number().min(0, "El costo debe ser positivo.").optional(),
  filosB: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  cicloMinB: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  cicloSegB: z.coerce.number().min(0).max(59, "No puede exceder 59 segundos.").optional(),
  vcB: z.coerce.number().min(0, "Debe ser un valor positivo.").optional(),
  modoVidaB: z.enum(['piezas', 'minutos']).default('piezas'),
  piezasFiloB: z.coerce.number().min(1, "Debe ser al menos 1.").optional(),
  minutosFiloB: z.coerce.number().min(0, "Debe ser un valor positivo."),
  notasB: z.string().optional(),
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


    