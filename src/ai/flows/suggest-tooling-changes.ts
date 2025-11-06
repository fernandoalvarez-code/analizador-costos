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
  prompt: `You are an expert manufacturing consultant specializing in cutting tool optimization.

  Based on the following input parameters and your knowledge of historical case data, provide suggestions for tooling changes that could increase savings.

  Current Tool: {{{currentTool}}}
  Current Tool Cost: {{{currentToolCost}}}
  Proposed Tool: {{{proposedTool}}}
  Proposed Tool Cost: {{{proposedToolCost}}}
  Cycle Time Reduction: {{{cycleTimeReduction}}}%
  Parts Produced Per Shift: {{{partsProducedPerShift}}}
  Shifts Per Day: {{{shiftsPerDay}}}
  Days Per Week: {{{daysPerWeek}}}
  Weeks Per Year: {{{weeksPerYear}}}
  Machine Hourly Rate: {{{machineHourlyRate}}}

  Consider the following:
  - The potential for increased throughput due to reduced cycle time.
  - The cost savings associated with increased tool life.
  - The impact of tool changes on machine downtime.
  - The availability and cost of the proposed tool.
  - Case history from previous successful adoptions

  Provide specific, actionable recommendations.
  Highlight the potential ROI of the proposed changes.
  If the new tool is not a good choice, based on your experience, say so.
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
