import { requireVerifiedUser } from '@/lib/server/auth-guards';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { SavingsInsightsSchema } from '@/lib/schemas';
import { suggestToolingChanges } from '@/ai/flows/suggest-tooling-changes';

export const dynamic = 'force-dynamic';

// Reemplaza a la Server Action getSavingsSuggestions: una ruta /api puede recibir el ID token,
// verificar al usuario y responder 401/403/429.
export async function POST(req: Request) {
  const auth = await requireVerifiedUser(req);
  if (!auth.ok) return auth.response;

  const limit = await enforceRateLimit('savings-suggestions', auth.user.uid);
  if (!limit.ok) return limit.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const parsed = SavingsInsightsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Error de validación. Por favor, revisa los campos.' }, { status: 400 });
  }

  try {
    const result = await suggestToolingChanges(parsed.data);
    return Response.json({ data: result });
  } catch (e) {
    console.error('[savings-suggestions] error al contactar la IA:', e instanceof Error ? e.message : 'error');
    return Response.json({ error: 'Ha ocurrido un error al contactar la IA. Por favor, inténtalo de nuevo.' }, { status: 502 });
  }
}
