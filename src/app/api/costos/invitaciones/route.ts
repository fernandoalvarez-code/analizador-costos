import { getInvitaciones, postInvitacion } from '@/lib/server/costos-handlers';

export const dynamic = 'force-dynamic';

export const POST = (req: Request) => postInvitacion(req);
export const GET = (req: Request) => getInvitaciones(req);
