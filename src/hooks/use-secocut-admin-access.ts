"use client";

import { useEffect, useState } from 'react';
import { doc, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { isVerifiedSecocutUser } from '@/lib/client/secocut-user';

/** Tope de espera del perfil users/{uid}: pasado este tiempo sin respuesta se muestra el aviso de acceso restringido. */
export const PERFIL_TOPE_MS = 10_000;

export type AccesoAdmin = 'cargando' | 'permitido' | 'restringido';

/**
 * ¿Puede ver las pantallas de administración de agentes y conocimiento? Solo un admin SECOCUT:
 * users/{uid}.role === 'admin' Y email verificado @secocut.com (mismo criterio que isSecocutAdmin()
 * en firestore.rules). Solo gobierna qué se muestra; la protección real está en las reglas.
 *
 *  - Mientras el perfil no llegó (y no pasaron PERFIL_TOPE_MS): 'cargando'. Sin destello de aviso para un admin.
 *  - Perfil con error (permisos, red) o inexistente: 'restringido' en cuanto la lectura termina.
 *  - Perfil que no llega en PERFIL_TOPE_MS: 'restringido'. Si llega después y es admin SECOCUT se corrige solo
 *    ('permitido'); si no lo es, el aviso se mantiene.
 */
export function useSecocutAdminAccess(): AccesoAdmin {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: profile, isLoading: profileLoading } = useDoc<{ role?: string }>(profileRef);

  const [vencido, setVencido] = useState(false);
  const esperandoPerfil = !!user && profileLoading;
  useEffect(() => {
    if (!esperandoPerfil) return;
    const timer = setTimeout(() => setVencido(true), PERFIL_TOPE_MS);
    return () => clearTimeout(timer);
  }, [esperandoPerfil, user?.uid]);

  if (userLoading) return 'cargando';
  if (!user) return 'restringido';
  if (profile) return profile.role === 'admin' && isVerifiedSecocutUser(user) ? 'permitido' : 'restringido';
  // Sin perfil: la lectura terminó (error o inexistente) o sigue en curso.
  if (!profileLoading) return 'restringido';
  return vencido ? 'restringido' : 'cargando';
}
