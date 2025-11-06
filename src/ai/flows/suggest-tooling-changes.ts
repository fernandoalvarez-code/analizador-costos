'use server';

/**
 * @fileOverview An AI agent that suggests tooling changes to increase savings.
 *
 * - suggestToolingChanges - A function that suggests tooling changes based on historical case data and input parameters.
 * - SuggestToolingChangesInput - The input type for the suggestToolingChanges function.
 * - SuggestToolingChangesOutput - The return type for the suggestToolingChanges function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestToolingChangesInputSchema = z.object({
  currentTool: z.string().describe('The current cutting tool being used.'),
  currentToolCost: z.number().describe('The cost of the current cutting tool.'),
  proposedTool: z.string().describe('The proposed cutting tool to be used.'),
  proposedToolCost: z.number().describe('The cost of the proposed cutting tool.'),
  cycleTimeReduction: z.number().describe('The expected reduction in cycle time if the proposed tool is used, as a percentage.'),
  partsProducedPerShift: z.number().describe('The number of parts produced per shift using the current tool.'),
  shiftsPerDay: z.number().describe('The number of shifts per day.'),
  daysPerWeek: z.number().describe('The number of working days per week.'),
  weeksPerYear: z.number().describe('The number of working weeks per year.'),
  machineHourlyRate: z.number().describe('The hourly rate of the machine being used.'),
});
export type SuggestToolingChangesInput = z.infer<typeof SuggestToolingChangesInputSchema>;

const SuggestToolingChangesOutputSchema = z.object({
  suggestions: z.string().describe('Suggestions for tooling changes to increase savings, based on the input parameters and historical case data.'),
});
export type SuggestToolingChangesOutput = z.infer<typeof SuggestToolingChangesOutputSchema>;

export async function suggestToolingChanges(input: SuggestToolingChangesInput): Promise<SuggestToolingChangesOutput> {
  return suggestToolingChangesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestToolingChangesPrompt',
  input: {schema: SuggestToolingChangesInputSchema},
  output: {schema: SuggestToolingChangesOutputSchema},
  prompt: `Eres un consultor experto en manufactura, especializado en la optimización de herramientas de corte. Tu respuesta DEBE ser en español.

  Basándote en los siguientes parámetros de entrada y tu conocimiento de datos históricos de casos, proporciona sugerencias sobre cambios de herramientas que podrían aumentar los ahorros.

  Herramienta Actual: {{{currentTool}}}
  Costo Herramienta Actual: {{{currentToolCost}}}
  Herramienta Propuesta: {{{proposedTool}}}
  Costo Herramienta Propuesta: {{{proposedToolCost}}}
  Reducción de Tiempo de Ciclo: {{{cycleTimeReduction}}}%
  Piezas Producidas por Turno: {{{partsProducedPerShift}}}
  Turnos por Día: {{{shiftsPerDay}}}
  Días por Semana: {{{daysPerWeek}}}
  Semanas por Año: {{{weeksPerYear}}}
  Costo Horario de Máquina: {{{machineHourlyRate}}}

  Considera lo siguiente:
  - El potencial de aumento de producción debido a la reducción del tiempo de ciclo.
  - Los ahorros de costos asociados con una mayor vida útil de la herramienta.
  - El impacto de los cambios de herramienta en el tiempo de inactividad de la máquina.
  - La disponibilidad y el costo de la herramienta propuesta.
  - Historial de casos de adopciones exitosas previas.

  Tu respuesta debe estar estructurada con los siguientes bloques, en este orden:

  ### Análisis General
  Una evaluación inicial de la propuesta, comentando la relación costo/beneficio.

  ### Recomendación
  Una conclusión clara y directa: ¿Es una buena opción el cambio? ¿Sí, no, o depende?

  ### Puntos Clave a Favor
  Un listado de los beneficios más importantes de la propuesta.

  ### Potencial de Ahorro y ROI
  Una estimación del retorno de la inversión (ROI) y el potencial de ahorro.

  ### Consideraciones Adicionales
  Posibles riesgos, puntos a verificar (ej. compatibilidad, entrenamiento) o sugerencias alternativas.

  Si la nueva herramienta no es una buena opción según tu experiencia, dilo claramente en la recomendación y explica por qué en las consideraciones.
  `,
});

const suggestToolingChangesFlow = ai.defineFlow(
  {
    name: 'suggestToolingChangesFlow',
    inputSchema: SuggestToolingChangesInputSchema,
    outputSchema: SuggestToolingChangesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
