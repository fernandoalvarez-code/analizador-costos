"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { avisoVidaUtilFilo, compararOpciones } from '@/lib/costos-mecanizado/calc';
import type { CostoHoraPorMaquina, OpcionHerramienta, Pieza, PosicionHerramienta } from '@/lib/costos-mecanizado/types';
import { CampoNumero, CampoTexto, CampoTiempo } from './campos';
import { conSigno, numero, usd2, usd4, usd0 } from './formato';
import { MENSAJE_COMPLETAR, opcionSinCompletar } from './opcion-completa';
import { opcionNueva, rutaOpcion, rutaPosicion } from './validar-pieza';
import { useCampo } from './validacion-context';

const CLASE_CAJA = 'rounded-lg border border-slate-200 bg-white p-3 space-y-3';
const CLASE_TH = 'p-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-left whitespace-nowrap';
const CLASE_TD = 'p-1.5 align-top';
const CLASE_EN_USO = 'bg-blue-50/50';
const CLASE_ROTURAS = 'rounded-md border px-2 py-1 text-xs font-bold whitespace-nowrap';
const CLASE_ROTURAS_CON = 'border-amber-300 bg-amber-50 text-amber-800';
const CLASE_ROTURAS_SIN = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50';
const CLASE_BAJA = 'font-bold text-emerald-700';
const CLASE_SUBE = 'font-bold text-red-600';
const CLASE_SIN_COMPLETAR = 'mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800';
const CLASE_AVISO_VIDA = 'mt-1 text-[10px] font-medium text-amber-700';
const CLASE_VIDA_VERIFICADA = 'mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-600 whitespace-nowrap';
const CLASE_MARCA_VERIFICADO = 'rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700';
const TEXTO_VIDA_VERIFICADA = 'Confirmo que la vida útil por filo es la medida en planta';

export interface PosicionHerramientaTableProps {
  opId: string;
  indice: number;
  pos: PosicionHerramienta;
  pieza: Pieza;
  costoHora: CostoHoraPorMaquina;
  onChange: (fn: (p: PosicionHerramienta) => PosicionHerramienta) => void;
  onQuitar: () => void;
  /** "Comparar alternativa" desde el diagnóstico: esta posición se muestra con la comparación abierta. `token` cambia en cada pedido. */
  foco?: { posicionId: string; token: number } | null;
}

/** Una posición de herramienta: la opción EN USO y las alternativas, con "Comparar" (compararOpciones). */
export default function PosicionHerramientaTable({ opId, indice, pos, pieza, costoHora, onChange, onQuitar, foco }: PosicionHerramientaTableProps) {
  const [comparando, setComparando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (foco && foco.posicionId === pos.id) {
      setComparando(true);
      raiz.current?.scrollIntoView?.({ block: 'center' });
    }
    // solo cuando llega un pedido nuevo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.token, foco?.posicionId]);
  const [rotOpen, setRotOpen] = useState<ReadonlySet<string>>(new Set());
  const { error: errorPosicion } = useCampo(rutaPosicion(opId, pos.id));

  // Costo de cada opción con la cuenta completa del motor (la misma que usa el resumen).
  const comparacion = useMemo(() => compararOpciones(pieza, costoHora, opId, pos.id), [pieza, costoHora, opId, pos.id]);
  // Una opción sin completar (precio 0, corte 0:00 o nombre por defecto) no se compara: daría un costo cero y un "ahorro" falso.
  const incompletas = useMemo(() => new Set(pos.opciones.filter(opcionSinCompletar).map((o) => o.id)), [pos.opciones]);
  const enUsoSinCompletar = incompletas.has(pos.opciones[Math.min(Math.max(0, pos.seleccionada), pos.opciones.length - 1)]?.id ?? '');
  const porOpcion = useMemo(() => new Map(comparacion.map((c) => [c.opcionId, c])), [comparacion]);

  const cambiarOpcion = (optId: string, cambios: Partial<OpcionHerramienta>) =>
    onChange((p) => ({ ...p, opciones: p.opciones.map((o) => (o.id === optId ? { ...o, ...cambios } : o)) }));
  // Piezas por filo, corte por pieza y vida útil (que recalcula piezas por filo) cambian el dato de la vida: si cambia de verdad, la
  // marca "Dato verificado" se borra sola. Cualquier otro campo no la toca.
  const cambiarDatoDeVida = (optId: string, cambios: Pick<Partial<OpcionHerramienta>, 'piezasPorFilo' | 'cortePorPiezaMin'>) =>
    onChange((p) => ({
      ...p,
      opciones: p.opciones.map((o) => {
        if (o.id !== optId) return o;
        const nueva = { ...o, ...cambios };
        const cambio = nueva.piezasPorFilo !== o.piezasPorFilo || nueva.cortePorPiezaMin !== o.cortePorPiezaMin;
        if (cambio) delete nueva.vidaVerificada;
        return nueva;
      }),
    }));
  // Se guarda solo true: desmarcar quita el campo.
  const marcarVidaVerificada = (optId: string, verificada: boolean) =>
    onChange((p) => ({
      ...p,
      opciones: p.opciones.map((o) => {
        if (o.id !== optId) return o;
        const nueva = { ...o };
        if (verificada) nueva.vidaVerificada = true; else delete nueva.vidaVerificada;
        return nueva;
      }),
    }));
  const alternarRoturas = (optId: string) => setRotOpen((s) => { const n = new Set(s); if (n.has(optId)) n.delete(optId); else n.add(optId); return n; });

  return (
    <div ref={raiz} id={`posicion-${pos.id}`} className={CLASE_CAJA} data-testid="posicion-herramienta">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm text-slate-800">Herramienta {indice + 1}</b>
        <span className="text-xs text-slate-500">{pos.opciones.length} {pos.opciones.length === 1 ? 'opción' : 'opciones'}</span>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="outline" aria-pressed={comparando} onClick={() => setComparando((v) => !v)}>Comparar</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange((p) => ({ ...p, opciones: [...p.opciones, opcionNueva(`Alternativa ${p.opciones.length}`)] }))}>+ Opción</Button>
        <Button type="button" size="sm" variant="ghost" aria-label={`Quitar herramienta ${indice + 1}`} title="Quitar herramienta" onClick={onQuitar}>🗑️</Button>
      </div>
      {errorPosicion && <p role="alert" className="text-xs font-medium text-red-600">{errorPosicion}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>En uso</th><th className={`${CLASE_TH} min-w-[180px]`}>Opción</th><th className={CLASE_TH}>Precio USD</th>
              <th className={CLASE_TH}>Insertos/herr.</th><th className={CLASE_TH}>Filos/inserto</th><th className={CLASE_TH}>Piezas por filo</th>
              <th className={CLASE_TH}>Corte por pieza (mm:ss)</th><th className={CLASE_TH}>Vida útil por filo <span className="font-normal normal-case">(= piezas × corte)</span></th>
              <th className={CLASE_TH}>Cambio (mm:ss)</th><th className={CLASE_TH}>Roturas</th><th className={CLASE_TH}>USD/pza</th><th className={CLASE_TH} />
            </tr>
          </thead>
          <tbody>
            {pos.opciones.map((o, k) => {
              const enUso = k === Math.min(Math.max(0, pos.seleccionada), pos.opciones.length - 1);
              const r = (campo: string) => rutaOpcion(opId, pos.id, o.id, campo);
              const vida = (Number.isFinite(o.piezasPorFilo) ? o.piezasPorFilo : 0) * (Number.isFinite(o.cortePorPiezaMin) ? o.cortePorPiezaMin : 0);
              const aviso = o.cortePorPiezaMin > 0 && Number.isFinite(vida) ? avisoVidaUtilFilo(vida) : null;
              const tieneRoturas = (o.roturaPct ?? 0) > 0;
              return (
                <React.Fragment key={o.id}>
                  <tr className={enUso ? CLASE_EN_USO : ''} data-testid="opcion-herramienta" data-en-uso={enUso ? 'true' : 'false'}>
                    <td className={CLASE_TD}>
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                        <input type="radio" name={`en-uso-${opId}-${pos.id}`} aria-label={`En uso: ${o.nombre}`} checked={enUso} onChange={() => onChange((p) => ({ ...p, seleccionada: k }))} />
                        {enUso ? <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">En uso</span> : <span className="text-slate-400">Usar</span>}
                      </label>
                    </td>
                    <td className={CLASE_TD}>
                      <CampoTexto ruta={r('nombre')} nombre="Nombre de la opción" value={o.nombre} onChange={(v) => cambiarOpcion(o.id, { nombre: v })} />
                      {opcionSinCompletar(o) && <p className={CLASE_SIN_COMPLETAR} data-testid="sin-completar">Sin completar</p>}
                    </td>
                    <td className={CLASE_TD}><CampoNumero ruta={r('precio')} nombre="Precio USD" value={o.precio} onChange={(v) => cambiarOpcion(o.id, { precio: v })} /></td>
                    <td className={CLASE_TD}><CampoNumero ruta={r('insertosPorHerramienta')} nombre="Insertos por herramienta" value={o.insertosPorHerramienta} onChange={(v) => cambiarOpcion(o.id, { insertosPorHerramienta: v })} /></td>
                    <td className={CLASE_TD}><CampoNumero ruta={r('filosPorInserto')} nombre="Filos por inserto" value={o.filosPorInserto} onChange={(v) => cambiarOpcion(o.id, { filosPorInserto: v })} /></td>
                    <td className={CLASE_TD}><CampoNumero ruta={r('piezasPorFilo')} nombre="Piezas por filo" title="Piezas que hace cada filo antes del cambio (dato medido en planta)" value={o.piezasPorFilo} onChange={(v) => cambiarDatoDeVida(o.id, { piezasPorFilo: v })} /></td>
                    <td className={`${CLASE_TD} bg-blue-50/40`}><CampoTiempo ruta={r('cortePorPiezaMin')} nombre="Corte por pieza (mm:ss)" value={o.cortePorPiezaMin} onChange={(v) => cambiarDatoDeVida(o.id, { cortePorPiezaMin: v })} /></td>
                    <td className={CLASE_TD}>
                      {/* Editable: si se carga la vida en minutos (p. ej. de catálogo), se calculan las piezas por filo = vida / corte */}
                      <CampoTiempo ruta={r('vidaUtilFilo')} nombre="Vida útil por filo (mm:ss)" title="Podés editarla: si cargás la vida en minutos, la app calcula las piezas por filo" value={vida}
                        onChange={(v) => { if (o.cortePorPiezaMin > 0) cambiarDatoDeVida(o.id, { piezasPorFilo: v / o.cortePorPiezaMin }); }} />
                      {/* Fuera de 5–90 min: aviso, o —con "Dato verificado" marcado— solo la marca. Dentro de rango no se muestra nada (la marca guardada se conserva). */}
                      {aviso && !o.vidaVerificada && <p className={CLASE_AVISO_VIDA} data-testid="aviso-vida">⚠ {aviso}</p>}
                      {aviso && (
                        <div className={CLASE_VIDA_VERIFICADA}>
                          <label className="flex items-center gap-1 cursor-pointer" title={TEXTO_VIDA_VERIFICADA}>
                            <input type="checkbox" checked={o.vidaVerificada === true} onChange={(e) => marcarVidaVerificada(o.id, e.target.checked)} />
                            Dato verificado
                          </label>
                          {o.vidaVerificada && <span className={CLASE_MARCA_VERIFICADO} data-testid="vida-verificada">Verificado</span>}
                        </div>
                      )}
                    </td>
                    <td className={CLASE_TD}><CampoTiempo ruta={r('cambioMin')} nombre="Cambio (mm:ss)" value={o.cambioMin} onChange={(v) => cambiarOpcion(o.id, { cambioMin: v })} /></td>
                    <td className={CLASE_TD}>
                      <button type="button" className={`${CLASE_ROTURAS} ${tieneRoturas ? CLASE_ROTURAS_CON : CLASE_ROTURAS_SIN}`} aria-expanded={rotOpen.has(o.id)} onClick={() => alternarRoturas(o.id)}>
                        {tieneRoturas ? `⚠ ${numero(o.roturaPct ?? 0, 0)} %` : '+ Roturas'}
                      </button>
                    </td>
                    <td className={`${CLASE_TD} font-bold tabular-nums whitespace-nowrap`} data-testid="usd-opcion">{usd4(porOpcion.get(o.id)?.costoOpcion ?? 0)}</td>
                    <td className={CLASE_TD}>
                      {pos.opciones.length > 1 && !enUso && (
                        <Button type="button" size="sm" variant="ghost" aria-label={`Quitar la opción ${o.nombre}`} title="Quitar opción" onClick={() => onChange((p) => ({ ...p, opciones: p.opciones.filter((x) => x.id !== o.id), seleccionada: p.seleccionada > k ? p.seleccionada - 1 : p.seleccionada }))}>✕</Button>
                      )}
                    </td>
                  </tr>
                  {rotOpen.has(o.id) && (
                    <tr className={enUso ? CLASE_EN_USO : ''} data-testid="roturas-opcion">
                      <td />
                      <td colSpan={11} className="p-2">
                        <div className="flex flex-wrap items-end gap-4 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                          <b className="text-sm">Roturas de «{o.nombre}»</b>
                          <CampoNumero ruta={r('roturaPct')} etiqueta="% de los cambios que son por rotura" value={o.roturaPct ?? 0} placeholder="ej. 30" onChange={(v) => cambiarOpcion(o.id, { roturaPct: v })} />
                          <CampoTiempo ruta={r('roturaExtraMin')} etiqueta="Tiempo extra por rotura (mm:ss)" value={o.roturaExtraMin ?? 0} onChange={(v) => cambiarOpcion(o.id, { roturaExtraMin: v })} />
                          <CampoNumero ruta={r('roturaScrapPct')} etiqueta="% de roturas que tiran la pieza" value={o.roturaScrapPct ?? 0} placeholder="ej. 50" onChange={(v) => cambiarOpcion(o.id, { roturaScrapPct: v })} />
                          <span className="text-xs text-slate-500">Además del cambio normal: sacar el pedazo roto, revisar la pieza, rehacer.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {comparando && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="comparacion">
          <p className="font-bold text-slate-800 mb-2">Comparación con la opción en uso</p>
          {comparacion.length < 2 ? (
            <p className="text-slate-500">Cargá otra opción (+ Opción) para compararla con la que está en uso.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><th className={CLASE_TH}>Opción</th><th className={CLASE_TH}>USD/pza</th><th className={CLASE_TH}>vs. en uso (USD/pza)</th><th className={CLASE_TH}>vs. en uso (USD/año)</th><th className={CLASE_TH}>Precio máximo</th></tr></thead>
              <tbody>
                {comparacion.map((c) => (
                  <tr key={c.opcionId} data-testid="fila-comparacion">
                    <td className={CLASE_TD}>{c.nombre}{c.esEnUso && <span className="ml-1 text-xs text-slate-500">(en uso)</span>}</td>
                    <td className={`${CLASE_TD} tabular-nums`}>{usd4(c.costoOpcion)}</td>
                    {incompletas.has(c.opcionId) || enUsoSinCompletar ? (
                      <td colSpan={3} className={`${CLASE_TD} text-amber-700`} data-testid="completar-datos">{MENSAJE_COMPLETAR}</td>
                    ) : c.esEnUso ? (
                      <><td className={`${CLASE_TD} text-slate-500`}>base</td><td className={`${CLASE_TD} text-slate-500`}>base</td><td className={`${CLASE_TD} tabular-nums`}>{usd2(pos.opciones.find((x) => x.id === c.opcionId)?.precio ?? 0)}</td></>
                    ) : (
                      <>
                        <td className={`${CLASE_TD} tabular-nums ${Math.abs(c.deltaPorPieza) < 0.00005 ? 'text-slate-500' : c.deltaPorPieza < 0 ? CLASE_BAJA : CLASE_SUBE}`} data-testid="delta-pieza">
                          {Math.abs(c.deltaPorPieza) < 0.00005 ? 'igual' : `${conSigno(c.deltaPorPieza, 4)} USD/pza`}
                        </td>
                        <td className={`${CLASE_TD} tabular-nums ${Math.abs(c.deltaAnual) < 0.5 ? 'text-slate-500' : c.deltaAnual < 0 ? CLASE_BAJA : CLASE_SUBE}`} data-testid="delta-anual">
                          {Math.abs(c.deltaAnual) < 0.5 ? 'igual' : `${c.deltaAnual < 0 ? 'ahorra' : 'cuesta'} ${usd0(Math.abs(c.deltaAnual))}/año`}
                        </td>
                        <td className={`${CLASE_TD} tabular-nums`} data-testid="precio-maximo">
                          {c.precioMaximo !== null ? usd2(c.precioMaximo) : <span className="text-slate-500">no empata</span>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
