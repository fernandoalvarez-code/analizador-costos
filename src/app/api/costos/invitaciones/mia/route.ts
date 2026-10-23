import { getInvitacionMia } from '@/lib/server/costos-handlers';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => getInvitacionMia(req);
