// TEMPORAL — BORRAR después de verificar emails del staff.
// Marca emailVerified=true para el usuario que llama (auth + dominio @secocut.com).
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

    await getAuth(adminApp).updateUser(decoded.uid, { emailVerified: true });

    return NextResponse.json({ success: true, message: `Email verificado para ${decoded.email}` });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
