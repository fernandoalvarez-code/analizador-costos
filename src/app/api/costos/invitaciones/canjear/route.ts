import { postCanjear } from '@/lib/server/costos-handlers';

export const dynamic = 'force-dynamic';

export const POST = (req: Request) => postCanjear(req);
