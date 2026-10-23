"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { llamarApiCostos } from '@/lib/client/costos-api';
import { useEmpresa } from './empresa-context';

const CLASE_AVISO = 'rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600';

interface InvitacionMia { invitacionId: string; empresaNombre: string; expiresAt: string }
type Fase =
  | { fase: 'cargando' }
  | { fase: 'sin-invitacion' }
  | { fase: 'con-invitacion'; invitacion: InvitacionMia }
  | { fase: 'aceptando'; invitacion: InvitacionMia }
  | { fase: 'error-aceptar'; invitacion: InvitacionMia }
  | { fase: 'aceptada' };

/**
 * Usuario sin empresaId en /costos: consulta si lo invitaron (GET /api/costos/invitaciones/mia) y permite aceptar (POST .../canjear).
 * Sin invitación muestra el mensaje de siempre. Con el email sin verificar no consulta: pide verificarlo.
 * El motivo interno de un rechazo nunca se muestra.
 */
export default function InvitacionPendiente() {
  const { user } = useUser();
  const { recargar } = useEmpresa();
  const [estado, setEstado] = useState<Fase>({ fase: 'cargando' });
  const verificado = user?.emailVerified === true;

  useEffect(() => {
    if (!user || !verificado) return;
    let cancelado = false;
    (async () => {
      const r = await llamarApiCostos<{ invitacion: InvitacionMia | null }>(user, '/api/costos/invitaciones/mia');
      if (cancelado) return;
      const inv = r.ok ? r.data?.invitacion : null;
      setEstado(inv ? { fase: 'con-invitacion', invitacion: inv } : { fase: 'sin-invitacion' });
    })();
    return () => { cancelado = true; };
  }, [user, verificado]);

  const aceptar = useCallback(async (invitacion: InvitacionMia) => {
    if (!user) return;
    setEstado({ fase: 'aceptando', invitacion });
    const r = await llamarApiCostos(user, '/api/costos/invitaciones/canjear', { method: 'POST', body: { invitacionId: invitacion.invitacionId } });
    if (!r.ok) { setEstado({ fase: 'error-aceptar', invitacion }); return; }
    // El perfil se actualiza solo (suscripción en vivo a users/{uid}); recargar vuelve a pedir la empresa.
    setEstado({ fase: 'aceptada' });
    recargar();
  }, [user, recargar]);

  if (!verificado) {
    return <div data-testid="costos-verificar-email" role="alert" className={CLASE_AVISO}>Verificá tu email para aceptar la invitación.</div>;
  }
  if (estado.fase === 'cargando') {
    return (
      <div data-testid="costos-cargando" role="status" className={`${CLASE_AVISO} flex items-center gap-2`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando tu invitación…
      </div>
    );
  }
  if (estado.fase === 'sin-invitacion') {
    return <div data-testid="costos-sin-empresa" role="alert" className={CLASE_AVISO}>No tenés empresa asignada.</div>;
  }
  if (estado.fase === 'aceptada') {
    return (
      <div data-testid="costos-invitacion-aceptada" role="status" className={`${CLASE_AVISO} flex items-center gap-2`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Invitación aceptada. Cargando tu empresa…
      </div>
    );
  }
  const { invitacion } = estado;
  const aceptando = estado.fase === 'aceptando';
  return (
    <div data-testid="costos-invitacion" className={`${CLASE_AVISO} space-y-4`}>
      <h2 className="text-lg font-bold text-slate-800">Te invitaron a {invitacion.empresaNombre}</h2>
      <p>Aceptá la invitación para ver el análisis de costos de mecanizado de la empresa.</p>
      {estado.fase === 'error-aceptar' && (
        <p data-testid="costos-invitacion-error" role="alert" className="font-medium text-red-700">
          No se pudo aceptar la invitación. Pedile a SECOCUT que te invite de nuevo.
        </p>
      )}
      <div className="flex gap-3">
        <Button type="button" disabled={aceptando} onClick={() => aceptar(invitacion)}>
          {aceptando ? 'Aceptando…' : 'Aceptar'}
        </Button>
        <Button type="button" variant="outline" disabled={aceptando} onClick={() => setEstado({ fase: 'sin-invitacion' })}>Ahora no</Button>
      </div>
    </div>
  );
}
