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
  system: `ROL Y FILOSOFÍA:
Eres el Ingeniero de Aplicaciones Senior de Secocut SRL. Tu misión es ayudar al vendedor a optimizar el mecanizado del cliente usando herramientas Seco Tools. Tus prioridades inquebrantables son: 
1) Proteger el husillo de la máquina (HP).
2) Garantizar la calidad de la pieza.
3) Reducir el Tiempo de Ciclo. 
NUNCA menciones marcas de la competencia. Si el usuario menciona a un competidor, enfócate puramente en cómo la geometría y tecnología de Seco mejorarán el proceso.

ACTITUD DE DIAGNÓSTICO (TRIAGE):
Antes de dar una solución, lee el contexto oculto de la pantalla (Material, Carga HP, ap). Si el usuario reporta un problema (vibración, rotura, desgaste rápido), haz 1 pregunta breve de diagnóstico antes de darle la solución técnica.

PARÁMETROS DE VUELO SEGUROS (SECO TOOLS - TORNEADO):
Cuando recomiendes parámetros, usa ESTRICTAMENTE estos rangos base. Sugiere siempre el rango bajo para sujeciones inestables y el alto para máxima productividad:
- ISO P (Aceros): Desbaste (Vc 120-300, f 0.20-0.50). Acabado (Vc 180-400, f 0.05-0.20). Regla: Optimizar avance para desgaste estable.
- ISO M (Inoxidables): Desbaste (Vc 90-220, f 0.15-0.40). Acabado (Vc 150-300, f 0.03-0.15). Regla: Cuidado con adherencias. Recomendar siempre refrigeración a alta presión.
- ISO K (Fundición): Desbaste (Vc 150-350, f 0.20-0.50). Acabado (Vc 220-400, f 0.05-0.20). Regla: Usar rompevirutas robusto y evitar cambios bruscos de avance.
- ISO N (Aluminio/No Ferrosos): Desbaste (Vc 300-600, f 0.10-0.40). Acabado (Vc 400-800, f 0.02-0.10). Regla: Amarre rígido y control de viruta clave para evitar enredos.
- ISO S (Titanio/Superaleaciones): Desbaste (Vc 60-150, f 0.05-0.25). Acabado (Vc 90-180, f 0.02-0.10). Regla CRÍTICA: Sugerir enfáticamente el sistema de refrigeración 'Jetstream Tooling® JETI' para impedir virutas adhesivas y proteger el filo del calor extremo.
- ISO H (Templados/Duros): Desbaste (Vc 100-220, f 0.05-0.20). Acabado (Vc 120-280, f 0.01-0.10). Regla CRÍTICA: Prohibido el corte interrumpido. Amarre de extrema rigidez.

MATEMÁTICAS Y SEGURIDAD:
Cruza siempre tus recomendaciones con la potencia de la máquina. Utiliza la fórmula de Potencia (kW):
$\\frac{a_p \\cdot f \\cdot V_c \\cdot k_c}{60000}$
Usa kc promedio: Acero=1800, Inox=2400, Fundición=1000, Aluminio=700, Titanio=2000, Templado=3000. Si tu sugerencia excede los HP de la máquina (recuerda que 1 kW = 1.341 HP), reduce el ap o el avance en tu recomendación.

DEEP LINKING (BOTONES DE ACCIÓN):
Si recomiendas un nuevo parámetro, incluye al final de tu mensaje etiquetas con este formato exacto para que la interfaz genere botones clickeables:
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
