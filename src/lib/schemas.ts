import * as z from "zod";

// --- AUTENTICACIÓN ---

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres"),
  name: z.string().min(2, "El nombre es requerido"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});


// --- APLICACIÓN ---

// Esquema para Guardar Casos (Nombre)
export const SaveCaseSchema = z.object({
  caseName: z.string().min(1, "El nombre del caso es obligatorio"),
});

// Esquema para Diagnóstico Rápido
export const QuickDiagnosisSchema = z.object({
  costoHoraMaquina: z.coerce.number().min(0.01, "Requerido"),
  piezasAlMes: z.coerce.number().min(1, "Requerido"),
  
  // Datos A
  precioA: z.coerce.number().min(0.01, "Requerido"),
  filosA: z.coerce.number().min(1, "Requerido"),
  pzsPorFiloA: z.coerce.number().min(0.1, "Requerido"),
  cicloMinA: z.coerce.number().min(0, "Requerido"),
  cicloSegA: z.coerce.number().min(0, "Requerido"),
  vcA: z.coerce.number().optional(),

  // Datos B
  precioB: z.coerce.number().min(0.01, "Requerido"),
  
  // Simulación
  piezasMasReales: z.coerce.number().optional(),
  modoSimulacionTiempo: z.enum(['segundos', 'vc']),
  segundosMenosReales: z.coerce.number().optional(),
  vcBReal: z.coerce.number().optional(),
});

// Esquema para Informe Detallado
export const DetailedReportSchema = z.object({
  // Encabezado
  cliente: z.string().optional(),
  fecha: z.string().optional(),
  contacto: z.string().optional(),
  operacion: z.string().optional(),
  pieza: z.string().optional(),
  material: z.string().optional(),
  status: z.string().optional(),
  technicalConclusion: z.string().optional(),

  // Generales
  machineHourlyRate: z.coerce.number().min(0.01, "Requerido"),
  piezasAlMes: z.coerce.number().min(1, "Requerido"),
  tiempoParada: z.coerce.number().optional(),
  costoImplementacion: z.coerce.number().optional().default(0),

  // Herramienta A
  descA: z.string().optional(),
  precioA: z.coerce.number().min(0, "Requerido"),
  insertosPorHerramientaA: z.coerce.number().min(1).default(1),
  filosA: z.coerce.number().min(1, "Requerido"),
  
  // LÓGICA CONDICIONAL A
  modoVidaA: z.enum(["piezas", "minutos"]).default("piezas"),
  piezasFiloA: z.coerce.number().optional(),
  minutosFiloA: z.coerce.number().optional(),
  
  cicloMinA: z.coerce.number().min(0),
  cicloSegA: z.coerce.number().min(0),
  vcA: z.coerce.number().optional(),
  notasA: z.string().optional(),

  // Herramienta B
  descB: z.string().optional(),
  precioB: z.coerce.number().min(0, "Requerido"),
  insertosPorHerramientaB: z.coerce.number().min(1).default(1),
  filosB: z.coerce.number().min(1, "Requerido"),

  // LÓGICA CONDICIONAL B
  modoVidaB: z.enum(["piezas", "minutos"]).default("piezas"),
  piezasFiloB: z.coerce.number().optional(),
  minutosFiloB: z.coerce.number().optional(),

  cicloMinB: z.coerce.number().min(0),
  cicloSegB: z.coerce.number().min(0),
  vcB: z.coerce.number().optional(),
  notasB: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validación condicional para A
  if (data.modoVidaA === 'piezas') {
    if (!data.piezasFiloA || data.piezasFiloA <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requerido",
        path: ["piezasFiloA"]
      });
    }
  } else {
    if (!data.minutosFiloA || data.minutosFiloA <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requerido",
        path: ["minutosFiloA"]
      });
    }
  }

  // Validación condicional para B
  if (data.modoVidaB === 'piezas') {
    if (!data.piezasFiloB || data.piezasFiloB <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requerido",
        path: ["piezasFiloB"]
      });
    }
  } else {
    if (!data.minutosFiloB || data.minutosFiloB <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requerido",
        path: ["minutosFiloB"]
      });
    }
  }
});

// Esquema para AI Savings Insights
export const SavingsInsightsSchema = z.object({
  currentTool: z.string().min(1, "Requerido"),
  currentToolCost: z.coerce.number().min(0.01, "Requerido"),
  proposedTool: z.string().min(1, "Requerido"),
  proposedToolCost: z.coerce.number().min(0.01, "Requerido"),
  cycleTimeReduction: z.coerce.number().min(0, "Requerido"),
  partsProducedPerShift: z.coerce.number().min(1, "Requerido"),
  shiftsPerDay: z.coerce.number().min(1, "Requerido"),
  daysPerWeek: z.coerce.number().min(1, "Requerido"),
  weeksPerYear: z.coerce.number().min(1, "Requerido"),
  machineHourlyRate: z.coerce.number().min(1, "Requerido"),
});
