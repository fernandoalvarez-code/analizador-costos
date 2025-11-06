"use server";

import { suggestToolingChanges, SuggestToolingChangesInput, SuggestToolingChangesOutput } from '@/ai/flows/suggest-tooling-changes';
import { SavingsInsightsSchema } from './schemas';

type FormState = {
  message: string;
  data?: SuggestToolingChangesOutput;
  error?: boolean;
}

export async function getSavingsSuggestions(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validatedFields = SavingsInsightsSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return {
      message: "Error de validación. Por favor, revisa los campos.",
      error: true,
    };
  }

  try {
    const result = await suggestToolingChanges(validatedFields.data as SuggestToolingChangesInput);
    return {
      message: "Sugerencias generadas con éxito.",
      data: result,
      error: false,
    };
  } catch (e) {
    console.error(e);
    return {
      message: "Ha ocurrido un error al contactar la IA. Por favor, inténtalo de nuevo.",
      error: true,
    };
  }
}
