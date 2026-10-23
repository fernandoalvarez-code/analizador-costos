"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { PERFIL_TOPE_MS } from '@/hooks/use-secocut-admin-access';
import { crearRepositorioCostos, type EmpresaDoc, type RepositorioCostos } from '@/lib/costos-mecanizado/firestore';
import { resolverModo, type ModoEmpresa, type PerfilEmpresa } from './modo-empresa';

/**
 * Empresa con la que trabaja el módulo de costos:
 *  - cliente (users/{uid}.empresaId): empresa fija, sin selector.
 *  - vendedor (@secocut verificado con empresasAsignadas): elige entre las suyas.
 *  - admin: elige entre todas y puede crear nuevas.
 * El perfil se lee con el mismo patrón que header.tsx; mientras no llega NO se muestra contenido (estado 'cargando') y si no llega
 * en PERFIL_TOPE_MS (10 s) o falla, se avisa: sin spinner infinito.
 */
export type EstadoEmpresa = 'cargando' | 'listo' | 'sin-empresas' | 'sin-empresa' | 'error';

export interface ContextoEmpresa {
  estado: EstadoEmpresa;
  mensajeError: string | null;
  uid: string | null;
  modo: ModoEmpresa | null;
  empresa: EmpresaDoc | null;
  empresas: EmpresaDoc[];
  puedeElegir: boolean;
  puedeCrear: boolean;
  seleccionar: (empresaId: string) => void;
  /** Solo admin. Crea la empresa, la agrega a la lista y la selecciona. */
  crearEmpresa: (nombre: string, plantas: string[]) => Promise<void>;
  repo: RepositorioCostos | null;
  recargar: () => void;
}

const Contexto = createContext<ContextoEmpresa | null>(null);

export function useEmpresa(): ContextoEmpresa {
  const c = useContext(Contexto);
  if (!c) throw new Error('useEmpresa debe usarse dentro de <EmpresaProvider>.');
  return c;
}

const claveSeleccion = (uid: string) => `costos:empresa:${uid}`;
/** localStorage puede fallar o estar vacío (ventana privada, datos bloqueados): todo va en try/catch. */
function leerSeleccion(uid: string): string | null {
  try { return window.localStorage.getItem(claveSeleccion(uid)); } catch { return null; }
}
function guardarSeleccion(uid: string, empresaId: string): void {
  try { window.localStorage.setItem(claveSeleccion(uid), empresaId); } catch { /* sin persistencia: no pasa nada */ }
}

type CargaEmpresas = { estado: 'cargando' } | { estado: 'ok'; empresas: EmpresaDoc[] } | { estado: 'error'; mensaje: string };

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const perfilRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);
  const { data: perfil, isLoading: perfilLoading } = useDoc<PerfilEmpresa>(perfilRef);

  // Tope de espera del perfil
  const [vencido, setVencido] = useState(false);
  const esperandoPerfil = !!user && perfilLoading;
  useEffect(() => {
    if (!esperandoPerfil) return;
    const timer = setTimeout(() => setVencido(true), PERFIL_TOPE_MS);
    return () => clearTimeout(timer);
  }, [esperandoPerfil, user?.uid]);

  const uid = user?.uid ?? null;
  const repo = useMemo(() => (firestore && uid ? crearRepositorioCostos(firestore, uid) : null), [firestore, uid]);
  const modo = useMemo<ModoEmpresa | null>(() => (perfil ? resolverModo(user, perfil) : null), [perfil, user]);

  const [recarga, setRecarga] = useState(0);
  const recargar = useCallback(() => setRecarga((n) => n + 1), []);
  const [carga, setCarga] = useState<CargaEmpresas>({ estado: 'cargando' });
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const empresaIdCliente = perfil?.empresaId;
  const asignadas = perfil?.empresasAsignadas;
  const asignadasClave = Array.isArray(asignadas) ? asignadas.join('|') : '';

  // Carga de las empresas según el modo
  useEffect(() => {
    if (!repo || !modo || modo === 'sin-empresas' || modo === 'sin-empresa') return;
    let cancelado = false;
    setCarga({ estado: 'cargando' });
    (async () => {
      try {
        let empresas: EmpresaDoc[];
        if (modo === 'admin') {
          empresas = await repo.listarEmpresas();
        } else if (modo === 'cliente') {
          const e = await repo.obtenerEmpresa(empresaIdCliente as string);
          if (!e) throw new Error('La empresa asignada no existe.');
          empresas = [e];
        } else {
          const r = await Promise.allSettled((asignadas ?? []).map((id) => repo.obtenerEmpresa(id)));
          empresas = r.flatMap((x) => (x.status === 'fulfilled' && x.value ? [x.value] : []));
          if (empresas.length === 0 && r.some((x) => x.status === 'rejected')) throw new Error('No se pudieron leer tus empresas.');
        }
        if (!cancelado) setCarga({ estado: 'ok', empresas });
      } catch (e) {
        console.error('[costos] No se pudieron cargar las empresas:', e);
        if (!cancelado) setCarga({ estado: 'error', mensaje: 'No se pudo cargar la empresa. Revisá tu conexión y reintentá.' });
      }
    })();
    return () => { cancelado = true; };
    // asignadasClave resume el arreglo para no re-ejecutar por identidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, modo, empresaIdCliente, asignadasClave, recarga]);

  const empresas = carga.estado === 'ok' ? carga.empresas : [];

  // Selección: la elegida en esta sesión, si no la guardada (si sigue siendo válida) y si no la primera. Se deriva en el render
  // (no en un efecto) para que no haya un cuadro intermedio con "sin empresas".
  const empresa = useMemo(() => {
    if (empresas.length === 0) return null;
    const valida = (id: string | null | undefined) => (id ? empresas.find((e) => e.id === id) ?? null : null);
    return valida(seleccionId) ?? (uid ? valida(leerSeleccion(uid)) : null) ?? empresas[0];
  }, [empresas, seleccionId, uid]);

  const seleccionar = useCallback((empresaId: string) => {
    setSeleccionId(empresaId);
    if (uid) guardarSeleccion(uid, empresaId);
  }, [uid]);

  const crearEmpresa = useCallback(async (nombre: string, plantas: string[]) => {
    if (!repo || modo !== 'admin') throw new Error('Solo un admin SECOCUT puede crear empresas.');
    const id = await repo.crearEmpresa({ nombre, plantas });
    const nueva: EmpresaDoc = { id, nombre, plantas };
    setCarga((c) => (c.estado === 'ok' ? { estado: 'ok', empresas: [...c.empresas, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)) } : c));
    setSeleccionId(id);
    if (uid) guardarSeleccion(uid, id);
  }, [repo, modo, uid]);

  // Estado resultante
  let estado: EstadoEmpresa;
  let mensajeError: string | null = null;
  if (userLoading) estado = 'cargando';
  else if (!user) { estado = 'error'; mensajeError = 'Iniciá sesión para usar el módulo.'; }
  else if (!perfil) {
    if (perfilLoading && !vencido) estado = 'cargando';
    else { estado = 'error'; mensajeError = 'No pudimos cargar tu perfil. Reintentá en unos minutos.'; }
  } else if (modo === 'sin-empresas') estado = 'sin-empresas';
  else if (modo === 'sin-empresa') estado = 'sin-empresa';
  else if (carga.estado === 'cargando') estado = 'cargando';
  else if (carga.estado === 'error') { estado = 'error'; mensajeError = carga.mensaje; }
  else if (empresa) estado = 'listo';
  else estado = 'sin-empresas'; // admin sin empresas todavía, o vendedor cuyas empresas asignadas no existen

  const valor = useMemo<ContextoEmpresa>(() => ({
    estado, mensajeError, uid, modo, empresa, empresas,
    puedeElegir: modo === 'admin' || modo === 'vendedor',
    puedeCrear: modo === 'admin',
    seleccionar, crearEmpresa, repo, recargar,
  }), [estado, mensajeError, uid, modo, empresa, empresas, seleccionar, crearEmpresa, repo, recargar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
