"use client";

import { useCallback, useEffect } from 'react';

export const MENSAJE_SALIDA = 'Hay cambios sin guardar. Si salís ahora se pueden perder. ¿Salir igual?';

/**
 * Avisa antes de salir de la pantalla mientras hay cambios sin guardar:
 *  - beforeunload (cerrar la pestaña, recargar, escribir otra URL);
 *  - navegación interna: un clic en un enlace a otra página pide confirmación (se intercepta en la fase de captura, antes del router).
 * Devuelve `confirmarSalida`, para los cambios de página hechos por código (router.push).
 * El botón "atrás" del navegador no se puede bloquear en el router de Next: ahí rige el guardado al desmontar.
 */
export function useAvisoSalida(activo: boolean): () => boolean {
  useEffect(() => {
    if (!activo) return;
    const alCerrar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const ancla = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!ancla || ancla.target === '_blank' || ancla.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(ancla.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // mismo lugar (#ancla)
      if (!window.confirm(MENSAJE_SALIDA)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', alCerrar);
    document.addEventListener('click', alHacerClic, true);
    return () => { window.removeEventListener('beforeunload', alCerrar); document.removeEventListener('click', alHacerClic, true); };
  }, [activo]);

  return useCallback(() => !activo || window.confirm(MENSAJE_SALIDA), [activo]);
}
