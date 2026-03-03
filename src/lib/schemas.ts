import * as z from "zod";

// Esquema para el login de usuario
export const LoginSchema = z.object({
  email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
  password: z.string().min(1, { message: "La contraseña es obligatoria." }),
});

// Esquema para el registro de usuario
export const RegisterSchema = z.object({
    name: z.string().min(1, { message: "El nombre es obligatorio." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
    password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

// Esquema para guardar un caso
export const SaveCaseSchema = z.object({
  caseName: z.string().min(3, { message: "El nombre del caso debe tener al menos 3 caracteres." }),
});

// Esquema para el formulario de diagnóstico rápido
export const QuickDiagnosisSchema = z.object({
  costoHoraMaquina: z.number().positive("Debe ser un valor positivo"),
  piezasAlMes: z.number().int().positive("Debe ser un valor positivo"),
  precioA: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number({ required_error: "Campo requerido" }).positive("Debe ser positivo")
  ),
  filosA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Campo requerido" }).int().positive("Debe ser positivo")
  ),
  pzsPorFiloA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Campo requerido" }).int().positive("Debe ser positivo")
  ),
  cicloMinA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Campo requerido" }).int().nonnegative("No puede ser negativo")
  ),
  cicloSegA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Campo requerido" }).int().nonnegative("No puede ser negativo").max(59, "No puede ser mayor a 59")
  ),
  vcA: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number().optional()
  ),
  precioB: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number({ required_error: "Campo requerido" }).positive("Debe ser positivo")
  ),
  piezasMasReales: z.number().int().nonnegative(),
  modoSimulacionTiempo: z.enum(['segundos', 'vc']),
  segundosMenosReales: z.number().nonnegative(),
  vcBReal: z.number().nonnegative(),
});

// Esquema para el formulario de informe detallado
export const DetailedReportSchema = z.object({
  cliente: z.string().min(1, "El nombre del cliente es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  contacto: z.string().optional(),
  operacion: z.string().min(1, "La operación es requerida"),
  pieza: z.string().optional(),
  material: z.string().min(1, "El material es requerido"),
  status: z.enum(["Pendiente", "Exitoso", "No Exitoso"]),
  machineHourlyRate: z.number().min(0),
  eficienciaOEE: z.number().min(1).max(100).default(80),
  piezasAlMes: z.number().int().min(0),
  tiempoParada: z.number().nonnegative(),
  costoImplementacion: z.number().nonnegative().optional(),

  // Herramienta A
  descA: z.string().optional(),
  precioA: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number({ required_error: "Precio requerido" }).positive()
  ),
  insertosPorHerramientaA: z.number().int().positive(),
  filosA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Filos requeridos" }).int().positive()
  ),
  cicloMinA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Minutos requeridos" }).int().nonnegative()
  ),
  cicloSegA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Segundos requeridos" }).int().nonnegative().max(59)
  ),
  vcA: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number().optional()
  ),
  modoVidaA: z.enum(['piezas', 'minutos']),
  piezasFiloA: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number().optional()
  ),
  minutosFiloA: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number().optional()
  ),
  tiempoCorteA: z.number().nonnegative().optional(),
  notasA: z.string().optional(),

  // Herramienta B
  descB: z.string().optional(),
  precioB: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number({ required_error: "Precio requerido" }).positive()
  ),
  insertosPorHerramientaB: z.number().int().positive(),
  filosB: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Filos requeridos" }).int().positive()
  ),
  cicloMinB: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Minutos requeridos" }).int().nonnegative()
  ),
  cicloSegB: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number({ required_error: "Segundos requeridos" }).int().nonnegative().max(59)
  ),
  vcB: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number().optional()
  ),
  modoVidaB: z.enum(['piezas', 'minutos']),
  piezasFiloB: z.preprocess(
    (val) => (val === "" ? undefined : parseInt(String(val), 10)),
    z.number().optional()
  ),
  minutosFiloB: z.preprocess(
    (val) => (val === "" ? undefined : parseFloat(String(val))),
    z.number().optional()
  ),
  tiempoCorteB: z.number().nonnegative().optional(),
  notasB: z.string().optional(),
  
  technicalConclusion: z.string().optional(),
});


// Esquema para el formulario de perspectivas de ahorro con IA
export const SavingsInsightsSchema = z.object({
  currentTool: z.string().min(1, "Campo requerido"),
  currentToolCost: z.coerce.number().positive(),
  proposedTool: z.string().min(1, "Campo requerido"),
  proposedToolCost: z.coerce.number().positive(),
  cycleTimeReduction: z.coerce.number(),
  partsProducedPerShift: z.coerce.number().int().positive(),
  shiftsPerDay: z.coerce.number().int().positive(),
  daysPerWeek: z.coerce.number().int().positive(),
  weeksPerYear: z.coerce.number().int().positive(),
  machineHourlyRate: z.coerce.number().positive(),
});

// --- Esquemas para el nuevo Simulador de Competitividad ---

export const SimulatorOptionSchema = z.object({
  priceUsd: z.coerce.number().min(0, "El precio no puede ser negativo"),
  pcsPerEdge: z.coerce.number().min(1, "Debe hacer al menos 1 pieza"),
  cycleMin: z.coerce.number().min(0, "Mínimo 0"),
  cycleSec: z.coerce.number().min(0, "No puede ser negativo").max(59, "Máximo 59"),
  pcsBetweenChanges: z.coerce.number().min(1, "Debe ser al menos 1"),
  scrapRate: z.coerce.number().min(0, "Debe ser entre 0 y 1").max(1, "Debe ser entre 0 y 1"),
});

export const SimulatorSchema = z.object({
  clientName: z.string().optional(),
  material: z.string().optional(),
  operationType: z.string().optional(),
  machineUsdPerHour: z.coerce.number().min(1, "Costo de máquina obligatorio"),
  toolChangeMin: z.coerce.number().min(0, "No puede ser negativo"),
  scrapCostUsdPerPiece: z.coerce.number().min(0, "No puede ser negativo"),
  notes: z.string().optional(),
  china: SimulatorOptionSchema,
  premium: SimulatorOptionSchema,
});
