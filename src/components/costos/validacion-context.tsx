"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ErroresPieza } from './validar-pieza';

interface ContextoValidacion {
  /** Mensaje visible del campo (solo después de que se tocó, o siempre en una pieza ya guardada). */
  error: (ruta: string) => string | undefined;
  tocar: (ruta: string) => void;
}

const Contexto = createContext<ContextoValidacion>({ error: () => undefined, tocar: () => {} });

/**
 * Muestra el error de un campo solo cuando el usuario ya lo tocó (así una pieza nueva no arranca llena de mensajes rojos),
 * o siempre si `mostrarTodos` (pieza ya guardada).
 */
export function ValidacionProvider({ errores, mostrarTodos, children }: { errores: ErroresPieza; mostrarTodos: boolean; children: React.ReactNode }) {
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set());
  const tocar = useCallback((ruta: string) => setTocados((s) => (s.has(ruta) ? s : new Set(s).add(ruta))), []);
  const valor = useMemo<ContextoValidacion>(() => ({
    error: (ruta) => (mostrarTodos || tocados.has(ruta) ? errores[ruta] : undefined),
    tocar,
  }), [errores, mostrarTodos, tocados, tocar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCampo(ruta: string) {
  const c = useContext(Contexto);
  return { error: c.error(ruta), tocar: () => c.tocar(ruta) };
}
