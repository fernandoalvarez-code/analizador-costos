'use server';
/**
 * @fileOverview Copiloto Seco AI assistant flow.
 * Este flujo recibe el contexto de la pantalla del simulador y un mensaje del usuario,
 * y devuelve una recomendación técnica como un Ingeniero de Aplicaciones Senior.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Esquema del contexto de la pantalla que se envía desde el frontend
const ScreenContextSchema = z.object({
  operationType: z.enum(['turning', 'milling']),
  material: z.string(),
  machine: z.object({
    powerHP: z.number(),
  }),
  currentProcess: z.object({
    tool: z.string(),
    ap: z.number(),
    vc: z.number(),
    feed: z.number(),
    geometry: z.enum(['positive', 'negative']),
    hpLoad: z.number(),
    costPerPiece: z.number(),
  }),
  premiumProposal: z.object({
    tool: z.string(),
    vc: z.number(),
    feed: z.number(),
    geometry: z.enum(['positive', 'negative']),
    hpLoad: z.number(),
    costPerPiece: z.number(),
  }),
});

// Esquema de entrada completo para el flujo
const CopilotInputSchema = z.object({
  userMessage: z.string().describe('El mensaje o pregunta del usuario.'),
  screenContext: ScreenContextSchema.describe('El estado actual de todos los parámetros en la pantalla del simulador.'),
});
export type CopilotInput = z.infer<typeof CopilotInputSchema>;

// Esquema de salida
const CopilotOutputSchema = z.object({
  response: z.string().describe('La respuesta generada por el asistente de IA.'),
});
export type CopilotOutput = z.infer<typeof CopilotOutputSchema>;

/**
 * Función exportada que el frontend llamará.
 * @param input Los datos de entrada que cumplen con CopilotInputSchema.
 * @returns Una promesa que resuelve con la respuesta de la IA.
 */
export async function askCopilot(input: CopilotInput): Promise<CopilotOutput> {
  return copilotFlow(input);
}

// Definición del Prompt de Genkit
const copilotPrompt = ai.definePrompt({
  name: 'copilotPrompt',
  // La personalidad y las reglas de oro del Ingeniero de Aplicaciones Senior
  system: `Eres el Ingeniero de Aplicaciones Senior de Secocut SRL. Tu misión absoluta es ayudar al usuario a sacar el máximo rendimiento de las herramientas Seco Tools, garantizando SIEMPRE dos cosas: 
1) La protección del husillo y la máquina del cliente (evitando sobrecargas y vibraciones). 
2) La integridad y calidad superficial de la pieza mecanizada.

Tienes acceso al screenContext que te envía el usuario, el cual contiene los parámetros actuales y los de la propuesta Seco.

=== TUS REGLAS DE ORO (GUARDRAILS) ===

1. SEGURIDAD DE MÁQUINA PRIMERO: 
Monitorea siempre el valor de hpLoad. Si la propuesta excede el 90% de la capacidad del motor (HP), o si el usuario menciona voladizos largos/inestabilidad, TU PRIMERA INSTRUCCIÓN debe ser reducir la Profundidad de Corte (ap) o sugerir cambiar a una geometría más positiva. NUNCA sacrifiques la máquina por ganar unos segundos de ciclo.

2. CUIDADO DE LA PIEZA Y VIRUTA: 
Si el problema reportado es mal acabado superficial o tolerancias sueltas, enfócate en el control de viruta. Sugiere aumentar la Velocidad de Corte (Vc) para evitar el filo aportado (BUE - Built-Up Edge), o recomienda cambiar a insertos con tecnología Wiper para mejorar el acabado sin sacrificar el avance (f).

3. EL "SWEET SPOT" DE SECO TOOLS: 
Educa al usuario demostrando que la rentabilidad no está en que el inserto dure meses. Enséñales a encontrar el equilibrio perfecto donde el inserto trabaje a su máxima capacidad térmica (especialmente nombrando los recubrimientos Duratomic o CVD de Seco) para reducir el Tiempo de Máquina drásticamente.

4. CERO COMPETENCIA (REGLA ESTRICTA): 
NUNCA menciones, compares, ni valides nombres de otras marcas de la competencia. Si el usuario menciona un inserto competidor, ignora el nombre de la marca. Enfócate PURAMENTE en la geometría, el grado y los parámetros de corte actuales para proponer cómo la tecnología de Seco mejorará el tiempo o la estabilidad del proceso.

=== ACTITUD DE DIAGNÓSTICO (TRIAGE) ===
Antes de dar una "receta" o parámetro final, analiza el screenContext. Si notas que falta información crítica para una recomendación segura (ej. ¿La sujeción es firme? ¿Tienen refrigerante a alta presión?), haz la pregunta primero. Sé analítico, profesional y muy técnico.

=== INTERACCIÓN CON LA INTERFAZ (DEEP LINKING) ===
Puedes controlar la pantalla del usuario emitiendo comandos especiales en tu respuesta. Si calculas que una nueva Velocidad de Corte (Vc) o Avance (f) es ideal, INCLUYE SIEMPRE al final de tu texto el comando en este formato exacto para que el sistema genere un botón:
[SET_PREMIUM_VC: valor]
[SET_PREMIUM_FEED: valor]
Ejemplo: "Te sugiero subir la velocidad para aprovechar el recubrimiento Duratomic. [SET_PREMIUM_VC: 280]"`,
  
  input: { schema: CopilotInputSchema },
  output: { schema: CopilotOutputSchema },

  // El prompt que se envía al modelo, usando la sintaxis de handlebars
  prompt: `Analiza el siguiente contexto de la pantalla y el mensaje del usuario para dar tu recomendación como Ingeniero de Aplicaciones Senior.

CONTEXTO DE PANTALLA:
- Operación: {{{screenContext.operationType}}}
- Material: {{{screenContext.material}}}
- Potencia Máquina: {{{screenContext.machine.powerHP}}} HP

PROCESO ACTUAL:
- Herramienta: {{{screenContext.currentProcess.tool}}}
- Profundidad de Corte (ap): {{{screenContext.currentProcess.ap}}} mm
- Velocidad de Corte (Vc): {{{screenContext.currentProcess.vc}}} m/min
- Avance: {{{screenContext.currentProcess.feed}}} mm
- Geometría: {{{screenContext.currentProcess.geometry}}}
- Carga de Husillo: {{{screenContext.currentProcess.hpLoad}}}%
- Costo por Pieza: \${{{screenContext.currentProcess.costPerPiece}}}

PROPUESTA SECO:
- Herramienta: {{{screenContext.premiumProposal.tool}}}
- Velocidad de Corte (Vc): {{{screenContext.premiumProposal.vc}}} m/min
- Avance: {{{screenContext.premiumProposal.feed}}} mm
- Geometría: {{{screenContext.premiumProposal.geometry}}}
- Carga de Husillo: {{{screenContext.premiumProposal.hpLoad}}}%
- Costo por Pieza: \${{{screenContext.premiumProposal.costPerPiece}}}

MENSAJE DEL USUARIO:
"{{{userMessage}}}"
`,
});

// Definición del Flujo de Genkit
const copilotFlow = ai.defineFlow(
  {
    name: 'copilotFlow',
    inputSchema: CopilotInputSchema,
    outputSchema: CopilotOutputSchema,
  },
  async (input) => {
    const result = await copilotPrompt(input);
    // Genkit v1.x devuelve el output directamente en la propiedad `output`
    return result.output!;
  }
);
