"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { calcPlanta, type PiezaConResumen } from '@/lib/costos-mecanizado/calc';
import type { FilaPieza, RepositorioCostos, ResultadoRecalculo } from '@/lib/costos-mecanizado/firestore';
import { ETIQUETA_RUBRO, RUBROS } from '@/lib/costos-mecanizado/types';
import { FONDO_RUBRO } from './colores-rubro';
import { numero, porcentaje0, usd0 } from './formato';
import { resumenDesactualizado, tableroMejoras } from './planta-utils';
import TablaPiezas from './tabla-piezas';

const CLASE_TARJETA = 'rounded-xl border border-slate-200 bg-white p-5 space-y-3';
const CLASE_TITULO = 'text-base font-bold text-[#12305a]';
const CLASE_KPI = 'rounded-lg border border-slate-200 bg-white px-4 py-3';
const TOP_PIEZAS = 10;
/** ISO -> DD/MM/AAAA en hora local. */
const fechaDeISO = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const TEXTO_LOGRADO_NEGATIVO = 'text-red-700';
const TEXTO_LOGRADO_POSITIVO = 'text-emerald-700';

type RepoPlanta = Pick<RepositorioCostos, 'listarTodosLosResumenes' | 'listarMaquinas' | 'leerReglas' | 'recalcularResumenesDesactualizados'>;

export interface ResumenPlantaProps {
  empresaId: string;
  repo: RepoPlanta;
  /** Solo el admin SECOCUT ve "Recalcular resúmenes". */
  esAdmin: boolean;
}

interface Datos {
  filas: FilaPieza[];
  maquinas: Array<{ id: string; nombre: string }>;
  reglasVersion: number;
}

type Recalculo = { corriendo: boolean; resultado: ResultadoRecalculo | null; error: boolean };

/**
 * Resumen de planta: todo sale del campo `resumen` de cada pieza (una sola lectura de los resúmenes al entrar; no se recalculan las
 * piezas completas en el cliente). Al volver de una pieza esta pantalla se vuelve a montar y vuelve a leer, así que refleja lo guardado.
 */
export default function ResumenPlanta({ empresaId, repo, esAdmin }: ResumenPlantaProps) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [carga, setCarga] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [recalculo, setRecalculo] = useState<Recalculo>({ corriendo: false, resultado: null, error: false });
  const montado = useRef(true);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarga('cargando');
    try {
      const [filas, maquinas, reglas] = await Promise.all([repo.listarTodosLosResumenes(empresaId), repo.listarMaquinas(empresaId), repo.leerReglas()]);
      if (!montado.current) return;
      setDatos({ filas, maquinas: maquinas.map((m) => ({ id: m.id, nombre: m.nombre })), reglasVersion: reglas.reglasVersion });
      setCarga('ok');
    } catch (e) {
      console.error('[costos] No se pudo cargar el resumen de planta:', e);
      if (montado.current && !silencioso) setCarga('error');
    }
  }, [repo, empresaId]);

  useEffect(() => { montado.current = true; void cargar(); return () => { montado.current = false; }; }, [cargar]);

  const planta = useMemo(() => {
    const conResumen: PiezaConResumen[] = (datos?.filas ?? []).filter((f) => f.resumen).map((f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, volumenAnual: f.volumenAnual, resumen: f.resumen }));
    return calcPlanta(conResumen);
  }, [datos]);

  const nombreMaquina = useCallback((id: string) => datos?.maquinas.find((m) => m.id === id)?.nombre ?? `${id} (eliminada)`, [datos]);

  const recalcular = async () => {
    setRecalculo({ corriendo: true, resultado: null, error: false });
    try {
      const r = await repo.recalcularResumenesDesactualizados(empresaId);
      if (!montado.current) return;
      setRecalculo({ corriendo: false, resultado: r, error: false });
      await cargar(true); // se recarga la lista al terminar
    } catch (e) {
      console.error('[costos] No se pudieron recalcular los resúmenes:', e);
      if (montado.current) setRecalculo({ corriendo: false, resultado: null, error: true });
    }
  };

  if (carga === 'cargando') return <p role="status" data-testid="planta-cargando" className="text-sm text-slate-500">Cargando piezas…</p>;
  if (carga === 'error' || !datos) {
    return (
      <div role="alert" data-testid="planta-error" className="space-y-3 text-sm text-slate-600">
        <p>No se pudieron leer las piezas.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button>
      </div>
    );
  }
  if (datos.filas.length === 0) {
    return (
      <section className={`${CLASE_TARJETA} text-center`} data-testid="planta-vacia">
        <p className="text-sm text-slate-600">Todavía no cargaste piezas. Cargá la primera para ver dónde está tu mayor costo de mecanizado.</p>
        <Link href="/costos/piezas/nueva" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Nueva pieza</Link>
      </section>
    );
  }

  const total = planta.costoAnual;
  const tablero = tableroMejoras(datos.filas, datos.reglasVersion);
  const desactualizadas = datos.filas.filter((f) => resumenDesactualizado(f, datos.reglasVersion)).length;
  const top = planta.pareto.slice(0, TOP_PIEZAS);
  const filaDe = (id: string) => datos.filas.find((f) => f.id === id);
  const porMaquina = Object.entries(planta.porMaquinaAnual).sort((a, b) => b[1] - a[1]);
  const porRubro = [...RUBROS].sort((a, b) => planta.porRubroAnual[b] - planta.porRubroAnual[a]);
  const maxMaquina = porMaquina[0]?.[1] ?? 0;
  const maxRubro = planta.porRubroAnual[porRubro[0]] ?? 0;
  const maxTop = top[0]?.costoAnual ?? 0;
  const maquinaTope = planta.maquinaMayorCosto;
  const resultado = recalculo.resultado;

  return (
    <div className="space-y-6" data-testid="resumen-planta">
      {desactualizadas > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2" data-testid="aviso-desactualizadas">
          <p>
            <b>{desactualizadas} {desactualizadas === 1 ? 'pieza tiene' : 'piezas tienen'} el resumen calculado con reglas anteriores.</b>{' '}
            Los números de la planta usan lo guardado en cada resumen hasta que se recalculen.
          </p>
          {esAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline" disabled={recalculo.corriendo} onClick={() => void recalcular()}>
                {recalculo.corriendo ? 'Recalculando…' : 'Recalcular resúmenes'}
              </Button>
              {resultado && (
                <span data-testid="resultado-recalculo-planta">
                  {resultado.recalculadas === 1 ? 'Se recalculó 1 pieza' : `Se recalcularon ${resultado.recalculadas} piezas`}
                  {resultado.fallidas > 0 && <> · <b className="text-red-700">{resultado.fallidas} no se pudieron recalcular</b></>}
                </span>
              )}
              {recalculo.error && <span className="font-medium text-red-700" data-testid="error-recalculo-planta">No se pudo recalcular. Reintentá.</span>}
              {(recalculo.error || (resultado && resultado.fallidas > 0)) && (
                <Button type="button" size="sm" variant="outline" disabled={recalculo.corriendo} data-testid="reintentar-recalculo-planta" onClick={() => void recalcular()}>Reintentar</Button>
              )}
            </div>
          )}
        </div>
      )}
      {/* Si ya no quedan desactualizadas pero se acaba de recalcular, el resultado sigue visible */}
      {desactualizadas === 0 && esAdmin && resultado && (
        <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-900" data-testid="resultado-recalculo-planta">
          {resultado.recalculadas === 1 ? 'Se recalculó 1 pieza' : `Se recalcularon ${resultado.recalculadas} piezas`}
          {resultado.fallidas > 0 && ` · ${resultado.fallidas} no se pudieron recalcular`}
        </p>
      )}

      {/* 1. KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kpis-planta">
        <div className={CLASE_KPI} data-testid="kpi-piezas">
          <p className="text-xs text-slate-500">Piezas analizadas</p>
          <p className="text-xl font-extrabold">{numero(planta.piezasAnalizadas, 0)}</p>
        </div>
        <div className={CLASE_KPI} data-testid="kpi-costo-anual">
          <p className="text-xs text-slate-500">Costo anual de mecanizado</p>
          <p className="text-xl font-extrabold">{usd0(total)}</p>
        </div>
        <div className={CLASE_KPI} data-testid="kpi-pct-herramientas">
          <p className="text-xs text-slate-500">Herramientas en el mecanizado</p>
          <p className="text-xl font-extrabold">{porcentaje0(planta.pctHerramientas)}</p>
          <p className="text-[11px] text-slate-500">Incluye cambios</p>
        </div>
        <div className={CLASE_KPI} data-testid="kpi-ahorro">
          <p className="text-xs text-slate-500">Ahorro potencial estimado</p>
          <p className="text-xl font-extrabold text-emerald-700">{usd0(planta.ahorroPotencialAnual)}</p>
          <p className="text-[11px] text-slate-500">{porcentaje0(total > 0 ? planta.ahorroPotencialAnual / total : 0)} del costo · por año</p>
        </div>
      </div>

      {/* 1 bis. Mejoras realizadas vs potencial (solo piezas con resumen vigente) */}
      <section className={CLASE_TARJETA} aria-labelledby="titulo-mejoras-planta" data-testid="mejoras-realizadas-planta">
        <h3 id="titulo-mejoras-planta" className={CLASE_TITULO}>Mejoras realizadas vs potencial</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={CLASE_KPI} data-testid="tablero-logrado">
            <p className="text-xs text-slate-500">Logrado</p>
            <p className={`text-xl font-extrabold ${tablero.logrado < 0 ? TEXTO_LOGRADO_NEGATIVO : TEXTO_LOGRADO_POSITIVO}`}>{usd0(tablero.logrado)}</p>
            <p className="text-[11px] text-slate-500">por año · {numero(tablero.cantImplementadas, 0)} {tablero.cantImplementadas === 1 ? 'mejora implementada' : 'mejoras implementadas'}</p>
          </div>
          <div className={CLASE_KPI} data-testid="tablero-pendiente">
            <p className="text-xs text-slate-500">Pendiente</p>
            <p className="text-xl font-extrabold">{usd0(tablero.pendiente)}</p>
            <p className="text-[11px] text-slate-500">por año · mejoras activas</p>
          </div>
          <div className={CLASE_KPI} data-testid="tablero-potencial-total">
            <p className="text-xs text-slate-500">Potencial total</p>
            <p className="text-xl font-extrabold">{usd0(tablero.potencialTotal)}</p>
            <p className="text-[11px] text-slate-500">logrado + pendiente</p>
          </div>
          <div className={CLASE_KPI} data-testid="tablero-pct-logrado">
            <p className="text-xs text-slate-500">Logrado del potencial</p>
            <p className="text-xl font-extrabold">{porcentaje0(tablero.fraccionLograda)}</p>
            <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${tablero.fraccionLograda * 100}%` }} /></div>
          </div>
        </div>
        {tablero.logrado > 0 && tablero.cantImplementadas === 0 && (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900" data-testid="tablero-logrado-sin-mejoras">
            Hay ahorro sin mejoras registradas: puede ser una corrección de datos o falta registrar qué se cambió.
          </p>
        )}
        {tablero.ultimaMejora && (
          <p className="text-xs text-slate-600" data-testid="tablero-ultima-mejora">
            Última mejora de la planta: {fechaDeISO(tablero.ultimaMejora.fecha)}, {tablero.ultimaMejora.por}, pieza {tablero.ultimaMejora.codigo}
          </p>
        )}
        {tablero.sinLineaBase > 0 && (
          <p className="text-xs text-slate-600" data-testid="tablero-sin-linea-base">
            {tablero.sinLineaBase} {tablero.sinLineaBase === 1 ? 'pieza sin línea base' : 'piezas sin línea base'} (no {tablero.sinLineaBase === 1 ? 'suma' : 'suman'} al logrado).
          </p>
        )}
        {tablero.excluidas > 0 && (
          <p className="text-xs text-amber-800" data-testid="tablero-excluidas">
            No incluye {tablero.excluidas} {tablero.excluidas === 1 ? 'pieza con el resumen calculado' : 'piezas con el resumen calculado'} con reglas anteriores.
          </p>
        )}
      </section>

      {/* 2. Dónde está tu mayor costo */}
      <section className="rounded-xl border border-[#f3c4c4] bg-[#fdecec] p-5 space-y-1" aria-labelledby="titulo-mayor-planta" data-testid="mayor-costo-planta">
        <h3 id="titulo-mayor-planta" className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64545]">Dónde está tu mayor costo</h3>
        <ul className="space-y-1 text-sm text-slate-800">
          <li data-testid="linea-pareto"><b>{numero(planta.piezasPara80, 0)} de {numero(planta.piezasAnalizadas, 0)} piezas</b> = 80 % del costo de mecanizado.</li>
          {planta.piezaMasCara && (
            <li data-testid="linea-pieza-cara">
              Pieza más cara del año: <b>{planta.piezaMasCara.codigo} {planta.piezaMasCara.nombre}</b> · {usd0(planta.piezaMasCara.costoAnual)}/año.
            </li>
          )}
          {maquinaTope && (
            <li data-testid="linea-maquina">
              Máquina con más costo: <b>{nombreMaquina(maquinaTope.maquinaId)}</b> ({usd0(maquinaTope.costoAnual)}/año) · rubro principal de la planta: <b>{planta.rubroPrincipal ? ETIQUETA_RUBRO[planta.rubroPrincipal].toLowerCase() : '—'}</b>.
            </li>
          )}
        </ul>
      </section>

      {/* 3. Top 10 piezas */}
      <section className={CLASE_TARJETA} aria-labelledby="titulo-top">
        <h3 id="titulo-top" className={CLASE_TITULO}>Las {Math.min(TOP_PIEZAS, top.length)} piezas de mayor costo anual</h3>
        <ol className="space-y-3" data-testid="top-piezas">
          {top.map((p, i) => {
            const f = filaDe(p.id);
            const vol = Math.max(1, f?.volumenAnual ?? 1);
            return (
              <li key={p.id} data-testid="fila-top" className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
                <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                <div className="min-w-0">
                  <Link href={`/costos/piezas/${p.id}`} className="block truncate text-sm font-bold text-blue-700 hover:underline">{p.codigo} · {p.nombre}</Link>
                  <div className="mt-1 flex h-4 overflow-hidden rounded bg-slate-100" style={{ width: `${Math.max(3, maxTop > 0 ? (p.costoAnual / maxTop) * 100 : 0)}%` }} data-testid="barra-top">
                    {RUBROS.map((r) => {
                      const anual = (f?.resumen?.porRubroUsdPza?.[r] ?? 0) * vol;
                      const w = p.costoAnual > 0 ? (anual / p.costoAnual) * 100 : 0;
                      return w > 0.5 ? <div key={r} className={FONDO_RUBRO[r]} style={{ width: `${w}%` }} title={`${ETIQUETA_RUBRO[r]}: ${usd0(anual)}`} /> : null;
                    })}
                  </div>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <span className="font-bold">{usd0(p.costoAnual)}</span>
                  <span className="ml-2 text-xs text-slate-500" data-testid="acumulado-top">{numero(p.acumuladoPct, 1)} % acum.</span>
                </div>
              </li>
            );
          })}
        </ol>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" data-testid="leyenda-rubros-planta">
          {RUBROS.map((r) => <li key={r} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${FONDO_RUBRO[r]}`} />{ETIQUETA_RUBRO[r]}</li>)}
        </ul>
      </section>

      {/* 4. Costo anual por máquina y por rubro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={CLASE_TARJETA} aria-labelledby="titulo-por-maquina">
          <h3 id="titulo-por-maquina" className={CLASE_TITULO}>Costo anual por máquina</h3>
          <div className="space-y-3" data-testid="por-maquina">
            {porMaquina.map(([id, anual]) => (
              <div key={id} data-testid="barra-maquina">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold">{nombreMaquina(id)}</span>
                  <span className="tabular-nums">{usd0(anual)} <small className="text-slate-500">{porcentaje0(total > 0 ? anual / total : 0)}</small></span>
                </div>
                <div className="mt-1 h-3 rounded bg-slate-100"><div className="h-3 rounded bg-[#12305a]" style={{ width: `${maxMaquina > 0 ? (anual / maxMaquina) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className={CLASE_TARJETA} aria-labelledby="titulo-por-rubro">
          <h3 id="titulo-por-rubro" className={CLASE_TITULO}>Costo anual por rubro</h3>
          <div className="space-y-3" data-testid="por-rubro">
            {porRubro.map((r) => (
              <div key={r} data-testid="barra-rubro-planta" data-rubro={r}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold">{ETIQUETA_RUBRO[r]}</span>
                  <span className="tabular-nums">{usd0(planta.porRubroAnual[r])} <small className="text-slate-500">{porcentaje0(total > 0 ? planta.porRubroAnual[r] / total : 0)}</small></span>
                </div>
                <div className="mt-1 h-3 rounded bg-slate-100"><div className={`h-3 rounded ${FONDO_RUBRO[r]}`} style={{ width: `${maxRubro > 0 ? (planta.porRubroAnual[r] / maxRubro) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5. Tabla de todas las piezas */}
      <TablaPiezas filas={datos.filas} maquinas={datos.maquinas} reglasVersion={datos.reglasVersion} />
    </div>
  );
}
