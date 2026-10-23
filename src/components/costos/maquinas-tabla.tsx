"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaquinaEnUsoError, type MaquinaDoc, type RepositorioCostos, type ResultadoRecalculo } from '@/lib/costos-mecanizado/firestore';

/** Espera sin escribir antes de guardar automáticamente. */
export const DEBOUNCE_GUARDADO_MS = 1000;

export type EstadoFila = 'sinCambios' | 'pendiente' | 'invalida' | 'guardando' | 'guardado' | 'error';

interface Fila {
  /** Clave local (las filas nuevas todavía no tienen id de Firestore). */
  key: string;
  id?: string;
  nombre: string;
  costoHora: string;
  tocada: boolean;
  estado: EstadoFila;
  /** Se incrementa en cada edición: un guardado viejo no pisa lo que se escribió después. */
  rev: number;
  recalculo: ResultadoRecalculo | null;
  reintentandoRecalculo: boolean;
  mensaje: string | null;
}

export interface ErroresFila { nombre?: string; costoHora?: string }

/** Costo hora: acepta coma decimal. Devuelve null si no es un número válido. */
export function parsearCostoHora(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Validación visible (ADDENDUM punto 5): nombre obligatorio y costo hora número ≥ 0. */
export function validarFila(nombre: string, costoHora: string): ErroresFila {
  const e: ErroresFila = {};
  if (nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  if (parsearCostoHora(costoHora) === null) e.costoHora = 'El costo hora debe ser un número mayor o igual a 0.';
  return e;
}

const CLASE_INPUT = 'h-10 bg-white text-slate-900 font-medium';
const CLASE_INPUT_INVALIDO = 'border-red-500';
const CLASE_TABLA = 'w-full text-left text-sm';
const CLASE_TH = 'p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500';
const CLASE_CELDA = 'p-3 align-top';
const CLASE_ERROR_CAMPO = 'mt-1 text-xs font-medium text-red-600';
const CLASE_ESTADO: Record<EstadoFila, string> = {
  sinCambios: 'text-xs text-slate-400',
  pendiente: 'text-xs text-slate-500',
  invalida: 'text-xs font-medium text-amber-700',
  guardando: 'text-xs font-medium text-blue-700',
  guardado: 'text-xs font-bold text-emerald-700',
  error: 'text-xs font-bold text-red-600',
};
const ETIQUETA_ESTADO: Record<EstadoFila, string> = {
  sinCambios: '',
  pendiente: 'Cambios sin guardar',
  invalida: 'Corregí los datos para guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  error: 'No se pudo guardar.',
};

let contador = 0;
const nuevaClave = () => `fila-${++contador}`;

const aFila = (m: MaquinaDoc): Fila => ({
  key: nuevaClave(), id: m.id, nombre: m.nombre, costoHora: String(m.costoHora), tocada: false,
  estado: 'sinCambios', rev: 0, recalculo: null, reintentandoRecalculo: false, mensaje: null,
});

export function textoRecalculo(n: number): string {
  return n === 1 ? 'Se recalculó 1 pieza' : `Se recalcularon ${n} piezas`;
}

type RepoMaquinas = Pick<RepositorioCostos, 'listarMaquinas' | 'crearMaquina' | 'actualizarMaquina' | 'eliminarMaquina' | 'recalcularResumenesPorMaquina'>;

export interface MaquinasTablaProps {
  empresaId: string;
  repo: RepoMaquinas;
}

/**
 * Tabla editable de máquinas (nombre + costo hora en USD/h). Guarda solo cada fila, automáticamente 1 s después de dejar de escribir
 * (o al salir del campo). Estados reales de guardado: "Guardando…", "Guardado" (SOLO cuando Firestore confirmó) y
 * "No se pudo guardar. Reintentar".
 */
export default function MaquinasTabla({ empresaId, repo }: MaquinasTablaProps) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [carga, setCarga] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const filasRef = useRef<Fila[]>([]);
  filasRef.current = filas;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const enVuelo = useRef(new Set<string>());
  const repetir = useRef(new Set<string>());
  const montado = useRef(true);

  const cambiar = useCallback((key: string, cambios: Partial<Fila> | ((f: Fila) => Partial<Fila>)) => {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...(typeof cambios === 'function' ? cambios(f) : cambios) } : f)));
  }, []);

  const cargar = useCallback(async () => {
    setCarga('cargando');
    try {
      const lista = await repo.listarMaquinas(empresaId);
      if (!montado.current) return;
      setFilas(lista.map(aFila));
      setCarga('ok');
    } catch (e) {
      console.error('[costos] No se pudieron leer las máquinas:', e);
      if (montado.current) setCarga('error');
    }
  }, [repo, empresaId]);

  useEffect(() => {
    montado.current = true;
    const t = timers.current;
    void cargar();
    return () => { montado.current = false; t.forEach((x) => clearTimeout(x)); t.clear(); };
  }, [cargar]);

  const guardar = useCallback(async (key: string): Promise<void> => {
    const fila = filasRef.current.find((f) => f.key === key);
    if (!fila) return;
    if (enVuelo.current.has(key)) { repetir.current.add(key); return; } // se vuelve a guardar apenas termine el anterior
    const errores = validarFila(fila.nombre, fila.costoHora);
    if (errores.nombre || errores.costoHora) { cambiar(key, { estado: 'invalida' }); return; }
    const costoHora = parsearCostoHora(fila.costoHora) as number;
    const nombre = fila.nombre.trim();
    const rev = fila.rev;

    enVuelo.current.add(key);
    cambiar(key, { estado: 'guardando', mensaje: null });
    try {
      let id = fila.id;
      let recalculo: ResultadoRecalculo | null = null;
      if (id) recalculo = (await repo.actualizarMaquina(empresaId, id, { nombre, costoHora })).recalculo;
      else id = await repo.crearMaquina(empresaId, { nombre, costoHora });
      if (!montado.current) return;
      enVuelo.current.delete(key);
      const actual = filasRef.current.find((f) => f.key === key);
      const editadaMientras = !!actual && actual.rev !== rev;
      cambiar(key, (f) => ({
        id,
        // "Guardado" solo si Firestore confirmó Y no se escribió algo nuevo mientras tanto
        estado: editadaMientras ? 'pendiente' : 'guardado',
        recalculo: recalculo ?? f.recalculo,
      }));
      // Si se escribió algo mientras guardaba: lo guarda el temporizador pendiente; si ya venció (y quedó en cola), se guarda ahora.
      const enCola = repetir.current.delete(key);
      if ((enCola || editadaMientras) && !timers.current.has(key)) void guardar(key);
    } catch (e) {
      console.error('[costos] No se pudo guardar la máquina:', e);
      enVuelo.current.delete(key);
      repetir.current.delete(key);
      if (montado.current) cambiar(key, { estado: 'error' });
    }
  }, [repo, empresaId, cambiar]);

  const programar = useCallback((key: string) => {
    const previo = timers.current.get(key);
    if (previo) clearTimeout(previo);
    timers.current.set(key, setTimeout(() => { timers.current.delete(key); void guardar(key); }, DEBOUNCE_GUARDADO_MS));
  }, [guardar]);

  const editar = (key: string, campo: 'nombre' | 'costoHora', valor: string) => {
    // El aviso de recálculo se limpia al seguir editando, salvo que haya piezas sin recalcular: eso queda visible hasta reintentar.
    cambiar(key, (f) => ({
      [campo]: valor, tocada: true, estado: 'pendiente', rev: f.rev + 1, mensaje: null,
      recalculo: f.recalculo && f.recalculo.fallidas > 0 ? f.recalculo : null,
    }) as Partial<Fila>);
    programar(key);
  };

  /** Al salir del campo se guarda sin esperar el segundo. */
  const alSalir = (key: string) => {
    const t = timers.current.get(key);
    if (!t) return;
    clearTimeout(t);
    timers.current.delete(key);
    void guardar(key);
  };

  const agregar = () => {
    setFilas((fs) => [...fs, {
      key: nuevaClave(), nombre: '', costoHora: '', tocada: false, estado: 'sinCambios', rev: 0, recalculo: null, reintentandoRecalculo: false, mensaje: null,
    }]);
  };

  const reintentarRecalculo = async (key: string) => {
    const fila = filasRef.current.find((f) => f.key === key);
    if (!fila?.id) return;
    cambiar(key, { reintentandoRecalculo: true });
    try {
      const r = await repo.recalcularResumenesPorMaquina(empresaId, fila.id);
      if (montado.current) cambiar(key, { recalculo: r, reintentandoRecalculo: false });
    } catch (e) {
      console.error('[costos] No se pudo reintentar el recálculo:', e);
      if (montado.current) cambiar(key, (f) => ({ reintentandoRecalculo: false, recalculo: { recalculadas: f.recalculo?.recalculadas ?? 0, fallidas: Math.max(1, f.recalculo?.fallidas ?? 0) } }));
    }
  };

  const eliminar = async (key: string) => {
    const fila = filasRef.current.find((f) => f.key === key);
    if (!fila) return;
    if (!fila.id) { // borrador sin guardar: se descarta sin confirmar
      const t = timers.current.get(key);
      if (t) { clearTimeout(t); timers.current.delete(key); }
      setFilas((fs) => fs.filter((f) => f.key !== key));
      return;
    }
    if (!window.confirm(`¿Eliminar la máquina "${fila.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await repo.eliminarMaquina(empresaId, fila.id);
      if (montado.current) setFilas((fs) => fs.filter((f) => f.key !== key));
    } catch (e) {
      if (!montado.current) return;
      if (e instanceof MaquinaEnUsoError || (e as Error)?.name === 'MaquinaEnUsoError') {
        cambiar(key, { mensaje: 'La máquina está en uso por al menos una pieza' });
      } else {
        console.error('[costos] No se pudo eliminar la máquina:', e);
        cambiar(key, { mensaje: 'No se pudo eliminar la máquina. Reintentá.' });
      }
    }
  };

  if (carga === 'cargando') return <p role="status" className="text-sm text-slate-500">Cargando máquinas…</p>;
  if (carga === 'error') {
    return (
      <div role="alert" className="space-y-3 text-sm text-slate-600">
        <p>No se pudieron leer las máquinas.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="maquinas-tabla">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className={CLASE_TABLA}>
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={CLASE_TH}>Nombre</th>
              <th className={CLASE_TH}>Costo hora (USD/h)</th>
              <th className={CLASE_TH}>Estado</th>
              <th className={`${CLASE_TH} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-slate-500">Todavía no cargaste máquinas. Agregá la primera.</td></tr>
            )}
            {filas.map((f) => {
              const errores = f.tocada || f.id ? validarFila(f.nombre, f.costoHora) : {};
              return (
                <tr key={f.key} data-testid="fila-maquina">
                  <td className={CLASE_CELDA}>
                    <Input
                      aria-label="Nombre de la máquina" value={f.nombre} className={`${CLASE_INPUT} ${errores.nombre ? CLASE_INPUT_INVALIDO : ''}`}
                      aria-invalid={errores.nombre ? true : undefined} placeholder="Ej: Centro vertical 1"
                      onChange={(e) => editar(f.key, 'nombre', e.target.value)} onBlur={() => alSalir(f.key)}
                    />
                    {errores.nombre && <p className={CLASE_ERROR_CAMPO} data-testid="error-nombre">{errores.nombre}</p>}
                  </td>
                  <td className={CLASE_CELDA}>
                    <Input
                      aria-label="Costo hora en USD por hora" inputMode="decimal" value={f.costoHora} className={`${CLASE_INPUT} ${errores.costoHora ? CLASE_INPUT_INVALIDO : ''}`}
                      aria-invalid={errores.costoHora ? true : undefined} placeholder="0"
                      onChange={(e) => editar(f.key, 'costoHora', e.target.value)} onBlur={() => alSalir(f.key)}
                    />
                    {errores.costoHora && <p className={CLASE_ERROR_CAMPO} data-testid="error-costo-hora">{errores.costoHora}</p>}
                  </td>
                  <td className={CLASE_CELDA}>
                    <div aria-live="polite">
                      {ETIQUETA_ESTADO[f.estado] && <span className={CLASE_ESTADO[f.estado]} data-testid="estado-fila">{ETIQUETA_ESTADO[f.estado]}</span>}
                      {f.estado === 'error' && (
                        <Button type="button" variant="outline" size="sm" className="ml-2 h-7" data-testid="reintentar-guardado" onClick={() => void guardar(f.key)}>Reintentar</Button>
                      )}
                    </div>
                    {f.recalculo && (
                      <div className="mt-1 text-xs text-slate-600" data-testid="resultado-recalculo">
                        <p>{textoRecalculo(f.recalculo.recalculadas)}</p>
                        {f.recalculo.fallidas > 0 && (
                          <p className="font-medium text-red-600">
                            {f.recalculo.fallidas} no se pudieron recalcular{' '}
                            <Button type="button" variant="outline" size="sm" className="ml-1 h-6" data-testid="reintentar-recalculo" disabled={f.reintentandoRecalculo} onClick={() => void reintentarRecalculo(f.key)}>
                              {f.reintentandoRecalculo ? 'Reintentando…' : 'Reintentar'}
                            </Button>
                          </p>
                        )}
                      </div>
                    )}
                    {f.mensaje && <p role="alert" className="mt-1 text-xs font-medium text-red-600" data-testid="mensaje-fila">{f.mensaje}</p>}
                  </td>
                  <td className={`${CLASE_CELDA} text-right`}>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${f.nombre || 'máquina'}`} onClick={() => void eliminar(f.key)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" onClick={agregar}><Plus className="mr-2 h-4 w-4" /> Agregar máquina</Button>
    </div>
  );
}
