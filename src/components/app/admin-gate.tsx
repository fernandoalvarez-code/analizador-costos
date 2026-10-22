"use client";

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useSecocutAdminAccess } from '@/hooks/use-secocut-admin-access';

/**
 * Compuerta de las pantallas de administración de agentes y conocimiento. El contenido (y con él sus lecturas y botones)
 * solo se monta para un admin SECOCUT; mientras el perfil carga se ve un estado de carga y quien no cumple ve el aviso.
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const acceso = useSecocutAdminAccess();

  if (acceso === 'cargando') {
    return (
      <div data-testid="admin-cargando" role="status" className="flex items-center justify-center gap-2 h-64 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando permisos…
      </div>
    );
  }
  if (acceso === 'restringido') {
    return (
      <div data-testid="admin-acceso-restringido" role="alert" className="flex items-center justify-center h-64 text-gray-500 text-sm text-center px-4">
        Acceso restringido a administradores SECOCUT.
      </div>
    );
  }
  return <>{children}</>;
}
