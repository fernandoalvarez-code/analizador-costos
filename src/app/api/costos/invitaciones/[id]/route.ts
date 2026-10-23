import { deleteInvitacion } from '@/lib/server/costos-handlers';

export const dynamic = 'force-dynamic';

export const DELETE = (req: Request, ctx: { params: { id: string } }) => deleteInvitacion(req, ctx.params.id);
