"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calcPieza } from '@/lib/costos-mecanizado/calc';
import type { FilaPieza, PiezaDoc, RepositorioCostos } from '@/lib/costos-mecanizado/firestore';
import { mejoras, mejorasDescartadas } from '@/lib/costos-mecanizado/mejoras';
import { toMmss } from '@/lib/costos-mecanizado/time';
import type { Implementacion, LineaBase, MejoraCosto, MotivoDescarteTipo, Operacion, Pieza, ReglasCostos } from '@/lib/costos-mecanizado/types';
import DatosPiezaForm from './datos-pieza-form';
import DiagnosticoPieza from './diagnostico-pieza';
import { numero, usd0, usd4 } from './formato';
import type { BaseOperacion } from './incidencia-herramientas-table';
import RutaOperaciones from './ruta-operaciones';
import { useAvisoSalida } from './use-aviso-salida';
import { ValidacionProvider } from './validacion-context';
import { nuevoId, operacionNueva, piezaNueva, validarPieza } from './validar-pieza';

/** Espera sin escribir antes de guardar automáticamente. */
export const DEBOUNCE_GUARDADO_PIEZA_MS = 1000;

export type EstadoGuardado = 'sinCambios' | 'pendiente' | 'invalida' | 'guardando' | 'guardado' | 'error' | 'conflicto';

const ETIQUETA_ESTADO: Record<EstadoGuardado, string> = {
  sinCambios: '',
  pendiente: 'Cambios sin guardar',
  invalida: 'Corregí los datos marcados para guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  error: 'No se pudo guardar.',
  conflicto: 'Otro usuario modificó esta pieza',
};
const CLASE_ESTADO: Record<EstadoGuardado, string> = {
  sinCambios: 'text-xs text-slate-400',
  pendiente: 'text-xs text-slate-500',
  invalida: 'text-xs font-medium text-amber-700',
  guardando: 'text-xs font-medium text-blue-700',
  guardado: 'text-xs font-bold text-emerald-700',
  error: 'text-xs font-bold text-red-600',
  conflicto: 'text-xs font-bold text-red-600',
};
const CLASE_PESTANA = 'px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors';
const CLASE_PESTANA_ACTIVA = 'border-blue-600 text-blue-700';
const CLASE_PESTANA_INACTIVA = 'border-transparent text-slate-500 hover:text-slate-800';
/** Estados en los que lo que se ve en pantalla todavía no está guardado en Firestore. */
const SIN_GUARDAR: ReadonlySet<EstadoGuardado> = new Set(['pendiente', 'guardando', 'invalida', 'error', 'conflicto']);

type RepoPieza = Pick<RepositorioCostos, 'crearPieza' | 'actualizarPieza' | 'duplicarPieza' | 'listarTodosLosResumenes' | 'obtenerPieza'>;

export interface PiezaEditorProps {
  empresaId: string;
  repo: RepoPieza;
  /** Pieza guardada (o null para una nueva: se crea en el primer guardado válido). */
  inicial: PiezaDoc | null;
  maquinas: Array<{ id: string; nombre: string; costoHora: number }>;
  reglas: ReglasCostos;
  /** Quien edita: queda en el registro de las mejoras que descarta. Sin él no se ofrece "Descartar". */
  usuario?: { uid: string; email: string };
}

/** La pieza sin los campos que no se editan (id, resumen y auditoría). */
function aPieza(d: PiezaDoc | null): Pieza {
  if (!d) return piezaNueva();
  const { id: _id, resumen: _r, createdAt: _a, createdBy: _b, updatedAt: _c, updatedBy: _d, ...resto } = d;
  void _id; void _r; void _a; void _b; void _c; void _d;
  return resto as Pieza;
}

/** Marca de tiempo de Firestore (o número) en milisegundos; null si no hay. */
export function marcaMs(t: unknown): number | null {
  if (t && typeof t === 'object' && typeof (t as { toMillis?: unknown }).toMillis === 'function') return (t as { toMillis: () => number }).toMillis();
  return typeof t === 'number' ? t : null;
}

/** Buscador para cambiar de pieza (usa la lista de resúmenes del editor, cargada una sola vez). */
function BuscadorPiezas({ resumenes, cargarResumenes, actualId, onIr }: { resumenes: FilaPieza[] | null; cargarResumenes: () => void; actualId: string | null; onIr: (id: string) => void }) {
  const [texto, setTexto] = useState('');
  const q = texto.trim().toLowerCase();
  const resultados = q && resumenes ? resumenes.filter((p) => p.id !== actualId && `${p.codigo} ${p.nombre}`.toLowerCase().includes(q)).slice(0, 8) : [];
  return (
    <div className="relative">
      <Input aria-label="Buscar pieza" placeholder="Buscar otra pieza…" value={texto} className="h-9 w-56 bg-white" onFocus={cargarResumenes} onChange={(e) => setTexto(e.target.value)} />
      {q && (
        <ul className="absolute z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white shadow-lg text-sm" data-testid="resultados-buscador">
          {resultados.length === 0 && <li className="px-3 py-2 text-slate-500">{resumenes ? 'Ninguna pieza coincide.' : 'Cargando…'}</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => onIr(p.id)}>
                <b>{p.codigo}</b> {p.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PiezaEditor({ empresaId, repo, inicial, maquinas, reglas, usuario }: PiezaEditorProps) {
  const router = useRouter();
  const [pieza, setPieza] = useState<Pieza>(() => aPieza(inicial));
  const [id, setId] = useState<string | null>(inicial?.id ?? null);
  const [estado, setEstado] = useState<EstadoGuardado>('sinCambios');
  // Una pieza guardada abre en "Diagnóstico"; una nueva, en "Cargar / editar datos".
  const [pestana, setPestana] = useState<'diagnostico' | 'datos'>(inicial ? 'diagnostico' : 'datos');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [base, setBase] = useState<BaseOperacion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ posicionId: string; token: number } | null>(null);
  const [resumenes, setResumenes] = useState<FilaPieza[] | null>(null);
  const [conflicto, setConflicto] = useState<PiezaDoc | null>(null);
  // Reglas con las que se calculó el resumen guardado (solo informativo: insignia "calculado con reglas anteriores").
  const [reglasVersionPieza, setReglasVersionPieza] = useState<number | null>(inicial?.resumen?.reglasVersion ?? null);

  const costoHora = useMemo(() => Object.fromEntries(maquinas.map((m) => [m.id, m.costoHora])), [maquinas]);
  const maquinaIds = useMemo(() => maquinas.map((m) => m.id), [maquinas]);
  const contexto = useMemo(() => ({ costoHora, reglas }), [costoHora, reglas]);

  // Recalcula en vivo con el motor; el estado es local, así que los campos no se vuelven a montar ni pierden el foco.
  const resultado = useMemo(() => calcPieza(pieza, costoHora), [pieza, costoHora]);
  const errores = useMemo(() => validarPieza(pieza, maquinaIds), [pieza, maquinaIds]);
  const listaMejoras = useMemo(() => mejoras(resultado, pieza, reglas), [resultado, pieza, reglas]);
  const listaDescartadas = useMemo(() => mejorasDescartadas(resultado, pieza, reglas), [resultado, pieza, reglas]);

  const hayCambiosSinGuardar = SIN_GUARDAR.has(estado);
  const confirmarSalida = useAvisoSalida(hayCambiosSinGuardar);
  const irA = useCallback((ruta: string) => { if (confirmarSalida()) router.push(ruta); }, [confirmarSalida, router]);

  // ── Lista de códigos existentes: se carga UNA vez (al enfocar el buscador o al editar el código), no por tecla ────────
  const cargandoResumenes = useRef(false);
  const cargarResumenes = useCallback(() => {
    if (cargandoResumenes.current) return;
    cargandoResumenes.current = true;
    repo.listarTodosLosResumenes(empresaId).then(setResumenes).catch((e) => { console.error('[costos] No se pudo cargar la lista de piezas:', e); cargandoResumenes.current = false; });
  }, [repo, empresaId]);
  const avisoCodigo = useMemo(() => {
    const codigo = pieza.codigo.trim().toLowerCase();
    if (!codigo || !resumenes) return null;
    return resumenes.some((f) => f.id !== id && f.codigo.trim().toLowerCase() === codigo) ? 'Ya existe otra pieza con este código en la empresa.' : null;
  }, [pieza.codigo, resumenes, id]);

  // ── Guardado automático: debounce de 1 s y tres estados reales ─────────────────────────────────────────────────────
  const piezaRef = useRef(pieza); piezaRef.current = pieza;
  const idRef = useRef<string | null>(id);
  const revRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVuelo = useRef(false);
  const repetir = useRef(false);
  const guardarRef = useRef<() => Promise<void>>(async () => {});
  // updatedAt de la pieza en Firestore tal como la conoce esta pantalla (para detectar que otro usuario la modificó)
  const marcaBase = useRef<number | null>(marcaMs(inicial?.updatedAt));
  const sobrescribir = useRef(false);

  const refrescarMarca = async (piezaId: string) => {
    try { marcaBase.current = marcaMs((await repo.obtenerPieza(empresaId, piezaId))?.updatedAt); } catch { marcaBase.current = null; }
  };

  guardarRef.current = async () => {
    if (enVuelo.current) { repetir.current = true; return; }
    const p = piezaRef.current;
    if (Object.keys(validarPieza(p, maquinaIds)).length > 0) { setEstado('invalida'); return; }
    const rev = revRef.current;
    enVuelo.current = true;
    setEstado('guardando');
    try {
      if (idRef.current) {
        // Edición simultánea: si la pieza cambió en Firestore desde que esta pantalla la cargó, no se pisa sin confirmar.
        // (La lectura previa no es atómica con la escritura: reduce la ventana, no la elimina.)
        if (!sobrescribir.current) {
          const remota = await repo.obtenerPieza(empresaId, idRef.current);
          const marcaRemota = marcaMs(remota?.updatedAt);
          if (remota && marcaBase.current !== null && marcaRemota !== null && marcaRemota !== marcaBase.current) {
            enVuelo.current = false;
            repetir.current = false;
            setConflicto(remota);
            setEstado('conflicto');
            return;
          }
        }
        sobrescribir.current = false;
        await repo.actualizarPieza(empresaId, idRef.current, p, contexto);
        await refrescarMarca(idRef.current);
      } else {
        const nuevoId = await repo.crearPieza(empresaId, p, contexto);
        idRef.current = nuevoId;
        setId(nuevoId);
        await refrescarMarca(nuevoId);
        // La URL pasa a la de la pieza guardada sin volver a montar la pantalla (se conserva el foco).
        try { window.history.replaceState(window.history.state, '', `/costos/piezas/${nuevoId}`); } catch { /* sin historial: no pasa nada */ }
      }
      setConflicto(null);
      setReglasVersionPieza(reglas.reglasVersion); // el resumen se escribió con las reglas actuales
      enVuelo.current = false;
      const editada = revRef.current !== rev;
      setEstado(editada ? 'pendiente' : 'guardado'); // "Guardado" solo con la confirmación de Firestore y sin cambios posteriores
      const enCola = repetir.current;
      repetir.current = false;
      if ((enCola || editada) && !timer.current) void guardarRef.current();
    } catch (e) {
      console.error('[costos] No se pudo guardar la pieza:', e);
      enVuelo.current = false;
      repetir.current = false;
      setEstado('error');
    }
  };

  const programar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void guardarRef.current(); }, DEBOUNCE_GUARDADO_PIEZA_MS);
  }, []);

  /** Cualquier cambio de la pieza pasa por acá: recalcula en vivo y programa el guardado. */
  const editar = useCallback((fn: (p: Pieza) => Pieza) => {
    setPieza(fn);
    revRef.current += 1;
    setMensaje(null);
    setEstado('pendiente');
    programar();
  }, [programar]);

  // Al salir de la pantalla con un cambio pendiente, se guarda sin esperar (salvo que haya un conflicto sin resolver).
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; void guardarRef.current(); }
  }, []);

  const cargarVersionNueva = () => {
    if (!conflicto) return;
    if (!window.confirm('Vas a descartar tus cambios sin guardar y cargar la versión nueva. ¿Continuar?')) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPieza(aPieza(conflicto));
    marcaBase.current = marcaMs(conflicto.updatedAt);
    setReglasVersionPieza(conflicto.resumen?.reglasVersion ?? null);
    setConflicto(null);
    setEstado('sinCambios');
    setAbierta(null);
    setBase(null);
  };
  const sobrescribirConMisCambios = () => {
    if (!conflicto) return;
    if (!window.confirm('Vas a sobrescribir los cambios del otro usuario con los tuyos. ¿Continuar?')) return;
    marcaBase.current = marcaMs(conflicto.updatedAt);
    sobrescribir.current = true;
    setConflicto(null);
    setEstado('pendiente');
    void guardarRef.current();
  };

  // ── Operaciones ────────────────────────────────────────────────────────────────────────────────────────────────────
  const fijarBase = useCallback((opId: string) => {
    const r = calcPieza(piezaRef.current, costoHora);
    const res = r.operaciones.find((o) => o.opId === opId);
    if (!res) { setBase(null); return; }
    setBase({ opId, totalOp: res.totalOp, totalPieza: r.costoPieza, porPosicion: Object.fromEntries(res.herramientasDetalle.map((h) => [h.posicionId, h.costoHerr])) });
  }, [costoHora]);

  const abrir = (opId: string | null) => { setAbierta(opId); if (opId) fijarBase(opId); else setBase(null); };
  const cambiarOp = (opId: string, fn: (op: Operacion) => Operacion) => editar((p) => ({ ...p, operaciones: p.operaciones.map((o) => (o.id === opId ? fn(o) : o)) }));
  const eliminarOp = (opId: string) => {
    const op = piezaRef.current.operaciones.find((o) => o.id === opId);
    if (!window.confirm(`¿Eliminar la operación "${op?.nombre ?? ''}"? Esta acción no se puede deshacer.`)) return;
    if (abierta === opId) { setAbierta(null); setBase(null); }
    editar((p) => ({ ...p, operaciones: p.operaciones.filter((o) => o.id !== opId) }));
  };
  const agregarOp = () => {
    const op = operacionNueva(maquinaIds[0] ?? '');
    editar((p) => ({ ...p, operaciones: [...p.operaciones, op] }));
    setAbierta(op.id);
    setBase(null);
  };

  /** "Comparar alternativa" desde el diagnóstico: va a "Cargar / editar datos" con la operación abierta y la posición a la vista. */
  const compararAlternativa = (m: MejoraCosto) => {
    const op = piezaRef.current.operaciones.find((o) => o.id === m.opId);
    const posicionId = m.posicionId ?? op?.herramientas[0]?.id;
    setPestana('datos');
    abrir(m.opId);
    if (posicionId) setFoco({ posicionId, token: Date.now() });
  };

  /** Descarta una mejora con motivo: se guarda en la pieza por el mismo camino de siempre (guardado automático y detección de conflicto). */
  const descartarMejora = (m: MejoraCosto, tipo: MotivoDescarteTipo, motivo: string) => {
    if (!usuario) return;
    editar((p) => ({
      ...p,
      mejorasDescartadas: {
        ...(p.mejorasDescartadas ?? {}),
        [m.clave]: { motivoTipo: tipo, motivo, por: usuario.uid, porEmail: usuario.email, fecha: new Date().toISOString(), ahorroAnualAlDescartar: m.ahorroAnual },
      },
    }));
  };
  /**
   * Registra una mejora como implementada (hito del historial: fecha, nota y autor). No exige la pieza guardada: el ahorro logrado no sale de acá,
   * sino de la línea base. La mejora sigue en la lista hasta que los datos nuevos dejen de dispararla. `costoPiezaAntes` queda como dato histórico.
   */
  const marcarImplementada = (m: MejoraCosto, fecha: string, nota: string) => {
    if (!usuario) return;
    editar((p) => {
      const op = p.operaciones.find((o) => o.id === m.opId);
      const costoPiezaAntes = calcPieza(p, costoHora).costoPieza;
      const nueva: Implementacion = {
        id: nuevoId('i'), categoria: m.categoria, opId: m.opId, opNombre: op?.nombre ?? m.opNombre, ...(m.posicionId ? { posicionId: m.posicionId } : {}),
        claveMejora: m.clave, titulo: m.titulo, fecha, nota, por: usuario.uid, porEmail: usuario.email, registradaEn: new Date().toISOString(),
        costoPiezaAntes, ahorroEstimadoAnual: m.ahorroAnual,
      };
      return { ...p, implementaciones: [...(p.implementaciones ?? []), nueva] };
    });
  };
  /**
   * Fija (o rehace) la línea base: el costo de la pieza en este momento. El botón solo se habilita con la pieza guardada y sin cambios pendientes,
   * así que coincide con lo guardado. Al rehacerla, la anterior pasa a `lineasBaseAnteriores` (historial de solo lectura).
   */
  const fijarLineaBase = (nota: string) => {
    if (!usuario) return;
    editar((p) => {
      const r = calcPieza(p, costoHora);
      const nueva: LineaBase = {
        costoPiezaBase: r.costoPieza, fecha: new Date().toISOString(), por: usuario.uid, porEmail: usuario.email, volumenAnualBase: r.volumenAnual,
        ...(nota ? { nota } : {}),
      };
      return { ...p, ...(p.lineaBase ? { lineasBaseAnteriores: [...(p.lineasBaseAnteriores ?? []), p.lineaBase] } : {}), lineaBase: nueva };
    });
  };
  /** Anula un registro (corregir un error): quita la entrada; el campo queda como [] para que la actualización reemplace el arreglo. */
  const anularImplementacion = (implId: string) => {
    editar((p) => ({ ...p, implementaciones: (p.implementaciones ?? []).filter((x) => x.id !== implId) }));
  };
  /** Reactiva: quita la entrada. Si era la última queda `{}` (no se borra el campo: la actualización en Firestore reemplaza el mapa). */
  const reactivarMejora = (clave: string) => {
    editar((p) => {
      const resto = { ...(p.mejorasDescartadas ?? {}) };
      delete resto[clave];
      return { ...p, mejorasDescartadas: resto };
    });
  };

  const duplicar = async () => {
    if (!id) return;
    try {
      const nuevo = await repo.duplicarPieza(empresaId, id);
      router.push(`/costos/piezas/${nuevo}`);
    } catch (e) {
      console.error('[costos] No se pudo duplicar la pieza:', e);
      setMensaje('No se pudo duplicar la pieza. Reintentá.');
    }
  };

  const hayOperaciones = pieza.operaciones.length > 0;
  const reglasDesactualizadas = !!id && reglasVersionPieza !== null && reglasVersionPieza !== reglas.reglasVersion;

  return (
    <div className="space-y-4" data-testid="pieza-editor">
      {/* Barra superior */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-4" data-testid="barra-pieza">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-800 truncate" data-testid="nombre-pieza">{pieza.nombre || (id ? 'Sin nombre' : 'Nueva pieza')}</h2>
          <p className="text-sm text-slate-600" data-testid="meta-pieza">
            {hayOperaciones
              ? <><b>{usd4(resultado.costoPieza)} por pieza</b> · <b>{usd0(resultado.costoAnual)} por año</b> · {numero(resultado.volumenAnual, 0)} piezas · {toMmss(resultado.minutosPieza)} min por pieza</>
              : 'Sin operaciones cargadas'}
          </p>
        </div>
        <div aria-live="polite" className="flex items-center gap-2" data-testid="estado-guardado-pieza">
          {ETIQUETA_ESTADO[estado] && <span className={CLASE_ESTADO[estado]} data-testid="estado-pieza">{ETIQUETA_ESTADO[estado]}</span>}
          {estado === 'error' && <Button type="button" size="sm" variant="outline" data-testid="reintentar-guardado-pieza" onClick={() => void guardarRef.current()}>Reintentar</Button>}
        </div>
        <BuscadorPiezas resumenes={resumenes} cargarResumenes={cargarResumenes} actualId={id} onIr={(destino) => irA(`/costos/piezas/${destino}`)} />
        <Button type="button" variant="outline" size="sm" disabled={!id || hayCambiosSinGuardar} title={!id ? 'Guardá la pieza para poder duplicarla' : hayCambiosSinGuardar ? 'Esperá a que se guarde' : undefined} onClick={() => void duplicar()}>Duplicar</Button>
        <Link href="/costos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Resumen de planta</Link>
      </div>
      {mensaje && <p role="alert" className="text-sm font-medium text-red-600">{mensaje}</p>}

      {conflicto && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 space-y-3" data-testid="aviso-conflicto">
          <p><b>Otro usuario modificó esta pieza</b> mientras la tenías abierta. Tus cambios todavía no se guardaron, para no pisar los suyos.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={cargarVersionNueva}>Cargar la versión nueva</Button>
            <Button type="button" size="sm" variant="outline" className="text-red-700" onClick={sobrescribirConMisCambios}>Sobrescribir con mis cambios</Button>
          </div>
        </div>
      )}

      {/* Sub-pestañas */}
      <div role="tablist" aria-label="Secciones de la pieza" className="flex gap-1 border-b border-slate-200">
        <button type="button" role="tab" aria-selected={pestana === 'diagnostico'} className={`${CLASE_PESTANA} ${pestana === 'diagnostico' ? CLASE_PESTANA_ACTIVA : CLASE_PESTANA_INACTIVA}`} onClick={() => setPestana('diagnostico')}>Diagnóstico</button>
        <button type="button" role="tab" aria-selected={pestana === 'datos'} className={`${CLASE_PESTANA} ${pestana === 'datos' ? CLASE_PESTANA_ACTIVA : CLASE_PESTANA_INACTIVA}`} onClick={() => setPestana('datos')}>Cargar / editar datos</button>
      </div>

      {pestana === 'diagnostico' && (
        <DiagnosticoPieza
          pieza={pieza} resultado={resultado} mejorasLista={listaMejoras} reglasDesactualizadas={reglasDesactualizadas} onCompararAlternativa={compararAlternativa}
          descartadas={listaDescartadas} onDescartar={usuario ? descartarMejora : undefined} onReactivar={usuario ? reactivarMejora : undefined}
          onMarcarImplementada={usuario ? marcarImplementada : undefined} onAnularImplementacion={usuario ? anularImplementacion : undefined}
          onFijarLineaBase={usuario ? fijarLineaBase : undefined} puedeFijarLineaBase={!!id && !hayCambiosSinGuardar}
        />
      )}

      {pestana === 'datos' && (
        <ValidacionProvider errores={errores} mostrarTodos={!!id}>
          <div role="tabpanel" className="space-y-6">
            <DatosPiezaForm pieza={pieza} onChange={editar} avisoCodigo={avisoCodigo} onCodigoEditado={cargarResumenes} />
            <RutaOperaciones
              pieza={pieza} resultado={resultado} maquinas={maquinas} costoHora={costoHora} abierta={abierta} base={base} foco={foco}
              onAbrir={abrir} onFijarBase={() => abierta && fijarBase(abierta)} onCambiarOp={cambiarOp} onEliminarOp={eliminarOp} onAgregarOp={agregarOp}
            />
          </div>
        </ValidacionProvider>
      )}
    </div>
  );
}
