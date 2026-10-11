import { NextRequest, NextResponse } from 'next/server';

// Descarte rápido de requests sin header Authorization. NO valida el token: la validación real
// (token + email verificado + dominio) la hacen requireVerifiedUser/requireSecucutUser en cada ruta.
export function middleware(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/chat', '/api/suggest-cutting-data'],
};
