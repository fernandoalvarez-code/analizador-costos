// TEMPORAL — BORRAR después de verificar emails del staff.
// Verifica (emailVerified=true) a TODOS los usuarios @secocut.com de una vez.
// Solo accesible con un token @secocut.com válido.
import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const adminApp = await initializeAdminApp();
    const decoded = await getAuth(adminApp).verifyIdToken(token);

    if (!decoded.email?.endsWith('@secocut.com')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Listar todos los usuarios y verificar los @secocut.com
    const auth = getAuth(adminApp);
    const listResult = await auth.listUsers(1000);
    const secocutUsers = listResult.users.filter((u) => u.email?.endsWith('@secocut.com'));

    const results = [];
    for (const user of secocutUsers) {
      if (!user.emailVerified) {
        await auth.updateUser(user.uid, { emailVerified: true });
        results.push({ email: user.email, status: 'verificado ahora' });
      } else {
        results.push({ email: user.email, status: 'ya estaba verificado' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
