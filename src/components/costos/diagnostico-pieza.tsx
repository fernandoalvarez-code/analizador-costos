"use client";

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { materialEfectivo } from '@/lib/costos-mecanizado/calc';
import { logroPorImplementacion } from '@/lib/costos-mecanizado/implementaciones';
import { toMmss } from '@/lib/costos-mecanizado/time';
import type { MejoraDescartadaVista } from '@/lib/costos-mecanizado/mejoras';
import { ETIQUETA_MOTIVO_DESCARTE, ETIQUETA_RUBRO, RUBROS, type Implementacion, type MejoraCosto, type MotivoDescarteTipo, type Pieza, type ResultadoPieza, type Rubro } from '@/lib/costos-mecanizado/types';
import DescartarMejoraDialog from './descartar-mejora-dialog';
import { AnularImplementacionDialog, MarcarImplementadaDialog } from './implementaciones-dialogs';
import { ETIQUETA_CORTA_RUBRO, FONDO_CATEGORIA, FONDO_RUBRO, TEXTO_SOBRE_RUBRO } from './colores-rubro';
import { numero, porcentaje0, usd0, usd2, usd4 } from './formato';

const CLASE_TARJETA = 'rounded-xl border border-slate-200 bg-white p-5 space-y-3';
const CLASE_TITULO = 'text-base font-bold text-[#12305a]';
const CLASE_KPI = 'rounded-lg border border-slate-200 bg-white px-4 py-3';
const CLASE_TH = 'p-2 text-[10px] font-bold uppercase tracking-wide text-slate-500';
const MAX_MEJORAS_VISIBLES = 5;
const LEYENDA_SUPUESTOS = 'Supuestos conservadores, a confirmar con ensayo en planta.';
const CLASE_DESCARTADA = 'rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-sm';
const CLASE_YA_NO_SE_SUGIERE = 'inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800';
const TEXTO_GUARDAR_PRIMERO = 'Guardá la pieza primero';
const CLASE_LOGRO_NEGATIVO = 'font-bold text-red-700';
const CLASE_LOGRO_POSITIVO = 'font-bold text-emerald-700';
/** YYYY-MM-DD -> DD/MM/AAAA (sin pasar por Date: no depende de la zona horaria). */
const fechaCorta = (iso: string) => { const [a, m, d] = iso.split('-'); return a && m && d ? `${d}/${m}/${a}` : iso; };
const fechaHora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); };

/** El texto de cada mejora termina con la leyenda general; en la tarjeta se muestra solo el supuesto y la leyenda va una vez al pie. */
const sinLeyenda = (supuesto: string) => supuesto.split('. Supuestos conservadores')[0].replace(/\.$/, '');

export interface DiagnosticoPiezaProps {
  pieza: Pieza;
  resultado: ResultadoPieza;
  mejorasLista: MejoraCosto[];
  /** El resumen guardado se calculó con otras reglas que las actuales de settings/reglasCostos (solo informativo). */
  reglasDesactualizadas: boolean;
  onCompararAlternativa: (m: MejoraCosto) => void;
  /** Mejoras descartadas guardadas en la pieza (registro visible). */
  descartadas?: MejoraDescartadaVista[];
  /** Si no se pasa, no se ofrece "Descartar" ni "Reactivar" (solo lectura). */
  onDescartar?: (m: MejoraCosto, tipo: MotivoDescarteTipo, motivo: string) => void;
  onReactivar?: (clave: string) => void;
  /** Registro de mejoras implementadas. Sin `onMarcarImplementada` no se ofrece "Marcar como implementada". */
  onMarcarImplementada?: (m: MejoraCosto, fecha: string, nota: string) => void;
  onAnularImplementacion?: (id: string) => void;
  /** Solo con la pieza guardada y sin cambios pendientes: el punto de partida es el costo guardado. */
  puedeMarcarImplementada?: boolean;
}

/** Sub-pestaña "Diagnóstico": se calcula en vivo sobre el estado de la pieza, así que siempre coincide con lo cargado. */
export default function DiagnosticoPieza({ pieza, resultado, mejorasLista, reglasDesactualizadas, onCompararAlternativa, descartadas = [], onDescartar, onReactivar, onMarcarImplementada, onAnularImplementacion, puedeMarcarImplementada = true }: DiagnosticoPiezaProps) {
  const [verTodas, setVerTodas] = useState(false);
  const [aDescartar, setADescartar] = useState<MejoraCosto | null>(null);
  const [verDescartadas, setVerDescartadas] = useState(false);
  const [aImplementar, setAImplementar] = useState<MejoraCosto | null>(null);
  const [aAnular, setAAnular] = useState<Implementacion | null>(null);
  const [verRealizadas, setVerRealizadas] = useState(false);

  const ops = resultado.operaciones;
  const total = resultado.costoPieza;
  const volumen = resultado.volumenAnual;
  const numeroOp = (opId: string) => `Op ${(pieza.operaciones.findIndex((o) => o.id === opId) + 1) * 10}`;

  const implementaciones = pieza.implementaciones ?? [];
  const logros = useMemo(() => logroPorImplementacion(pieza, resultado), [pieza, resultado]);
  const logrado = logros.reduce((s, x) => s + x, 0);

  const ordenadas = useMemo(() => [...ops].sort((a, b) => b.totalOp - a.totalOp), [ops]);
  const rubrosOrdenados = useMemo(() => [...RUBROS].sort((a, b) => resultado.porRubroUsdPza[b] - resultado.porRubroUsdPza[a]), [resultado]);
  const celdaMax = useMemo(() => Math.max(0, ...ops.flatMap((o) => RUBROS.map((r) => o[r]))), [ops]);

  if (pieza.operaciones.length === 0) {
    return (
      <div role="tabpanel" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500" data-testid="diagnostico-vacio">
        Cargá al menos una operación para ver el diagnóstico.
      </div>
    );
  }

  const opTope = ops.find((o) => o.opId === resultado.opMayorCosto) ?? ordenadas[0];
  const rubroDeLaOp = [...RUBROS].sort((a, b) => opTope[b] - opTope[a])[0];
  const rubroDePieza = resultado.rubroPrincipal ?? rubrosOrdenados[0];
  const pctHerramientas = total > 0 ? (resultado.porRubroUsdPza.herramientas + resultado.porRubroUsdPza.cambios) / total : 0;
  const m = pieza.material;
  const potencial = mejorasLista.reduce((s, x) => s + x.ahorroAnual, 0);
  const visibles = verTodas ? mejorasLista : mejorasLista.slice(0, MAX_MEJORAS_VISIBLES);

  return (
    <div role="tabpanel" className="space-y-6" data-testid="diagnostico">
      {reglasDesactualizadas && (
        <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800" data-testid="insignia-reglas"
          title="El resumen guardado de esta pieza se calculó con otras reglas de mejoras. Este diagnóstico ya usa las reglas actuales.">
          calculado con reglas anteriores
        </p>
      )}

      {/* 1. Mayor costo de la pieza */}
      <section className="rounded-xl border border-[#f3c4c4] bg-[#fdecec] p-5" aria-labelledby="titulo-mayor" data-testid="mayor-costo">
        <h3 id="titulo-mayor" className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64545]">Mayor costo de esta pieza</h3>
        <p className="mt-1 text-xl font-extrabold text-slate-800" data-testid="mayor-costo-titulo">
          {numeroOp(opTope.opId)} · {opTope.nombre} = {porcentaje0(total > 0 ? opTope.totalOp / total : 0)} del costo de mecanizado
        </p>
        <p className="mt-1 text-sm text-slate-700" data-testid="mayor-costo-detalle">
          {usd4(opTope.totalOp)} por pieza · {usd0(opTope.totalOp * volumen)} por año. Dentro de esta operación lo que más pesa es <b>{ETIQUETA_RUBRO[rubroDeLaOp].toLowerCase()}</b>{' '}
          ({porcentaje0(opTope.totalOp > 0 ? opTope[rubroDeLaOp] / opTope.totalOp : 0)}). En toda la pieza, el rubro principal es <b>{ETIQUETA_RUBRO[rubroDePieza].toLowerCase()}</b>{' '}
          ({porcentaje0(total > 0 ? resultado.porRubroUsdPza[rubroDePieza] / total : 0)}).
        </p>
      </section>

      {/* 2. KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kpis">
        <div className={CLASE_KPI} data-testid="kpi-mecanizado">
          <p className="text-xs text-slate-500">Mecanizado por pieza</p>
          <p className="text-xl font-extrabold">{usd4(total)}</p>
          <p className="text-[11px] text-slate-500">{toMmss(resultado.minutosPieza)} min por pieza</p>
        </div>
        {m.quienPone === 'cliente' ? (
          <div className={CLASE_KPI} data-testid="kpi-material">
            <p className="text-xs text-slate-500">Material</p>
            <p className="text-base font-extrabold">Material: lo pone el cliente</p>
            <p className="text-[11px] text-slate-500">{m.clienteCobraScrap ? `Te cobra ${usd2(materialEfectivo(pieza))} por pieza perdida` : 'No te cobra el scrap'}</p>
          </div>
        ) : (
          <div className={CLASE_KPI} data-testid="kpi-material">
            <p className="text-xs text-slate-500">Pieza con material</p>
            <p className="text-xl font-extrabold">{usd4(resultado.costoPiezaConMaterial)}</p>
            <p className="text-[11px] text-slate-500">Mecanizado + material {usd2(resultado.materialEfectivo)}</p>
          </div>
        )}
        <div className={CLASE_KPI} data-testid="kpi-anual">
          <p className="text-xs text-slate-500">Mecanizado anual</p>
          <p className="text-xl font-extrabold">{usd0(resultado.costoAnual)}</p>
          <p className="text-[11px] text-slate-500">{numero(volumen, 0)} piezas</p>
        </div>
        <div className={CLASE_KPI} data-testid="kpi-herramientas">
          <p className="text-xs text-slate-500">Herramientas en el mecanizado</p>
          <p className="text-xl font-extrabold">{porcentaje0(pctHerramientas)}</p>
          <p className="text-[11px] text-slate-500">Incluye cambios</p>
        </div>
      </div>

      {/* 3. ¿Dónde está el costo? / ¿En qué se va? */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={CLASE_TARJETA} aria-labelledby="titulo-donde">
          <h3 id="titulo-donde" className={CLASE_TITULO}>¿Dónde está el costo?</h3>
          <div className="space-y-3" data-testid="donde-esta">
            {ordenadas.map((o) => (
              <div key={o.opId} data-testid="barra-operacion">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold">{numeroOp(o.opId)} · {o.nombre}</span>
                  <span className="tabular-nums">{numero(o.totalOp, 4)} <small className="text-slate-500">{porcentaje0(total > 0 ? o.totalOp / total : 0)}</small></span>
                </div>
                <div className="mt-1 flex h-5 overflow-hidden rounded bg-slate-100" style={{ width: `${Math.max(4, ordenadas[0].totalOp > 0 ? (o.totalOp / ordenadas[0].totalOp) * 100 : 0)}%` }}>
                  {RUBROS.map((r) => {
                    const w = o.totalOp > 0 ? (o[r] / o.totalOp) * 100 : 0;
                    return w > 0.5 ? <div key={r} className={`${FONDO_RUBRO[r]} ${TEXTO_SOBRE_RUBRO[r]} text-[10px] font-bold flex items-center justify-center overflow-hidden`} style={{ width: `${w}%` }} title={`${ETIQUETA_RUBRO[r]}: ${usd4(o[r])}`} /> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" data-testid="leyenda-rubros">
            {RUBROS.map((r) => <li key={r} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${FONDO_RUBRO[r]}`} />{ETIQUETA_RUBRO[r]}</li>)}
          </ul>
        </section>

        <section className={CLASE_TARJETA} aria-labelledby="titulo-en-que">
          <h3 id="titulo-en-que" className={CLASE_TITULO}>¿En qué se va?</h3>
          <div className="space-y-3" data-testid="en-que-se-va">
            {rubrosOrdenados.map((r: Rubro) => (
              <div key={r} data-testid="barra-rubro" data-rubro={r}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold">{ETIQUETA_RUBRO[r]}</span>
                  <span className="tabular-nums">{numero(resultado.porRubroUsdPza[r], 4)} <small className="text-slate-500">{porcentaje0(total > 0 ? resultado.porRubroUsdPza[r] / total : 0)}</small></span>
                </div>
                <div className="mt-1 h-3 rounded bg-slate-100">
                  <div className={`h-3 rounded ${FONDO_RUBRO[r]}`} style={{ width: `${rubrosOrdenados[0] && resultado.porRubroUsdPza[rubrosOrdenados[0]] > 0 ? (resultado.porRubroUsdPza[r] / resultado.porRubroUsdPza[rubrosOrdenados[0]]) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 4. Matriz operación × rubro */}
      <section className={CLASE_TARJETA} aria-labelledby="titulo-matriz">
        <h3 id="titulo-matriz" className={CLASE_TITULO}>Operación × rubro (USD por pieza)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="matriz">
            <thead>
              <tr>
                <th className={`${CLASE_TH} text-left`}>Operación</th>
                {RUBROS.map((r) => (
                  <th key={r} className={`${CLASE_TH} text-right`}><span className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm ${FONDO_RUBRO[r]}`} />{ETIQUETA_CORTA_RUBRO[r]}</th>
                ))}
                <th className={`${CLASE_TH} text-right`}>Total</th><th className={`${CLASE_TH} text-right`}>%</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => (
                <tr key={o.opId} data-testid="fila-matriz">
                  <td className="p-2"><b>{numeroOp(o.opId)}</b> · {o.nombre}</td>
                  {RUBROS.map((r) => {
                    const a = celdaMax > 0 ? o[r] / celdaMax : 0;
                    return (
                      <td key={r} className={`p-2 text-right tabular-nums ${a > 0.5 ? 'font-bold' : ''}`} data-rubro={r} style={{ backgroundColor: `rgba(214,69,69,${(a * 0.35).toFixed(2)})` }}>{numero(o[r], 4)}</td>
                    );
                  })}
                  <td className="p-2 text-right font-bold tabular-nums" data-testid="total-operacion">{numero(o.totalOp, 4)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{porcentaje0(total > 0 ? o.totalOp / total : 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold" data-testid="fila-total-matriz">
                <td className="p-2">Total pieza</td>
                {RUBROS.map((r) => <td key={r} className="p-2 text-right tabular-nums" data-rubro={r}>{numero(resultado.porRubroUsdPza[r], 4)}</td>)}
                <td className="p-2 text-right tabular-nums" data-testid="total-pieza-matriz">{numero(total, 4)}</td><td className="p-2 text-right">100 %</td>
              </tr>
              <tr className="text-xs text-slate-500" data-testid="fila-pct-matriz">
                <td className="p-2">% del total</td>
                {RUBROS.map((r) => <td key={r} className="p-2 text-right tabular-nums">{porcentaje0(total > 0 ? resultado.porRubroUsdPza[r] / total : 0)}</td>)}
                <td /><td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Mejoras priorizadas */}
      <section className={CLASE_TARJETA} aria-labelledby="titulo-mejoras" data-testid="mejoras">
        <h3 id="titulo-mejoras" className={CLASE_TITULO}>Mejoras priorizadas</h3>
        {mejorasLista.length === 0 ? (
          <p className="text-sm text-slate-500">Con los datos cargados no hay mejoras que superen los umbrales.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-testid="potencial">
              <span>{mejorasLista.length} {mejorasLista.length === 1 ? 'mejora' : 'mejoras'} en esta pieza</span>
              <span><b>Ahorro potencial ≈ {usd0(potencial)}/año</b> · {porcentaje0(resultado.costoAnual > 0 ? potencial / resultado.costoAnual : 0)} del costo de mecanizado</span>
            </div>
            <ol className="space-y-3">
              {visibles.map((x, i) => (
                <li key={`${x.categoria}-${x.opId}-${x.posicionId ?? ''}`} className="grid grid-cols-[2rem_1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3" data-testid="mejora">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#12305a] text-xs font-extrabold text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <p>
                      <span className={`mr-2 inline-block rounded-lg px-2 py-0.5 text-[10.5px] font-bold ${FONDO_CATEGORIA[x.categoria]}`} data-testid="categoria-mejora">{x.categoria}</span>
                      <span className="text-xs text-slate-500">{numeroOp(x.opId)} · {x.opNombre}</span>
                    </p>
                    <p className="mt-1 text-sm font-bold">{x.titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-700">{x.explicacion}</p>
                    <p className="mt-1 text-xs text-slate-500">{sinLeyenda(x.supuesto)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {x.puedeComparar && (
                        <Button type="button" size="sm" variant="outline" onClick={() => onCompararAlternativa(x)}>Comparar alternativa</Button>
                      )}
                      {onMarcarImplementada && (
                        <Button
                          type="button" size="sm" variant="outline" disabled={!puedeMarcarImplementada} aria-label={`Marcar como implementada: ${x.titulo}`}
                          title={puedeMarcarImplementada ? undefined : TEXTO_GUARDAR_PRIMERO} onClick={() => setAImplementar(x)}
                        >
                          Marcar como implementada
                        </Button>
                      )}
                      {onDescartar && (
                        <Button type="button" size="sm" variant="ghost" aria-label={`Descartar mejora: ${x.titulo}`} onClick={() => setADescartar(x)}>Descartar</Button>
                      )}
                    </div>
                    {onMarcarImplementada && !puedeMarcarImplementada && <p className="mt-1 text-[11px] text-slate-500" data-testid="leyenda-guardar-primero">{TEXTO_GUARDAR_PRIMERO}.</p>}
                  </div>
                  <div className="min-w-[8rem] text-right">
                    <p className="text-base font-extrabold text-emerald-700" data-testid="ahorro-mejora">≈ {usd0(x.ahorroAnual)}/año</p>
                    <p className="text-xs text-slate-500">{usd4(x.ahorroPorPieza)} por pieza</p>
                  </div>
                </li>
              ))}
            </ol>
            {mejorasLista.length > MAX_MEJORAS_VISIBLES && (
              <div className="text-center">
                <Button type="button" variant="outline" size="sm" onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? `Ver solo las ${MAX_MEJORAS_VISIBLES} principales` : `Ver las ${mejorasLista.length} mejoras`}
                </Button>
              </div>
            )}
          </>
        )}
        <p className="text-xs text-slate-500" data-testid="leyenda-supuestos">{LEYENDA_SUPUESTOS}</p>
      </section>

      {/* 6. Registro de mejoras descartadas */}
      {descartadas.length > 0 && (
        <section className={CLASE_TARJETA} aria-labelledby="titulo-descartadas" data-testid="mejoras-descartadas">
          <h3 id="titulo-descartadas" className="m-0">
            <button type="button" className={`${CLASE_TITULO} flex w-full items-center justify-between text-left`} aria-expanded={verDescartadas} aria-controls="lista-descartadas" onClick={() => setVerDescartadas((v) => !v)}>
              <span>Mejoras descartadas ({descartadas.length})</span>
              <span aria-hidden="true" className="text-sm text-slate-500">{verDescartadas ? '▲' : '▼'}</span>
            </button>
          </h3>
          {verDescartadas && (
            <ul id="lista-descartadas" className="space-y-3">
              {descartadas.map((d) => {
                const opIdx = pieza.operaciones.findIndex((o) => o.id === d.opId);
                return (
                  <li key={d.clave} className={CLASE_DESCARTADA} data-testid="mejora-descartada">
                    <p>
                      <span className={`mr-2 inline-block rounded-lg px-2 py-0.5 text-[10.5px] font-bold ${FONDO_CATEGORIA[d.categoria] ?? ''}`} data-testid="categoria-descartada">{d.categoria}</span>
                      <span className="text-xs text-slate-500">{opIdx >= 0 ? `${numeroOp(d.opId)} · ${d.opNombre}` : 'operación eliminada'}</span>
                    </p>
                    {d.mejora && <p className="font-bold">{d.mejora.titulo}</p>}
                    <p data-testid="motivo-descartada"><b>{ETIQUETA_MOTIVO_DESCARTE[d.descarte.motivoTipo] ?? d.descarte.motivoTipo}:</b> {d.descarte.motivo}</p>
                    <p className="text-xs text-slate-500" data-testid="autor-descartada">Descartada por {d.descarte.porEmail} · {fechaHora(d.descarte.fecha)}</p>
                    <p className="text-xs text-slate-500" data-testid="ahorro-descartada">Ahorro estimado al descartar: ≈ {usd0(d.descarte.ahorroAnualAlDescartar)}/año</p>
                    {!d.vigente && <p className={CLASE_YA_NO_SE_SUGIERE} data-testid="ya-no-se-sugiere">ya no se sugiere con los datos actuales</p>}
                    {onReactivar && (
                      <div><Button type="button" size="sm" variant="outline" aria-label={`Reactivar mejora ${d.categoria}`} onClick={() => onReactivar(d.clave)}>Reactivar</Button></div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 7. Mejoras realizadas: logrado real contra el potencial */}
      {implementaciones.length > 0 && (
        <section className={CLASE_TARJETA} aria-labelledby="titulo-realizadas" data-testid="mejoras-realizadas">
          <h3 id="titulo-realizadas" className="m-0">
            <button type="button" className={`${CLASE_TITULO} flex w-full items-center justify-between text-left`} aria-expanded={verRealizadas} aria-controls="lista-realizadas" onClick={() => setVerRealizadas((v) => !v)}>
              <span>Mejoras realizadas ({implementaciones.length})</span>
              <span aria-hidden="true" className="text-sm text-slate-500">{verRealizadas ? '▲' : '▼'}</span>
            </button>
          </h3>
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-2" data-testid="resumen-realizadas">
            <p data-testid="texto-logrado-pendiente">
              Logrado ≈ {usd0(logrado)}/año · Pendiente ≈ {usd0(potencial)}/año · <b>Potencial total {usd0(logrado + potencial)}/año</b>
            </p>
            <div className="h-2 rounded bg-white" role="progressbar" aria-label="Logrado sobre potencial total" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(logrado + potencial > 0 ? Math.min(100, Math.max(0, (logrado / (logrado + potencial)) * 100)) : 0)}>
              <div className="h-2 rounded bg-emerald-600" data-testid="barra-logrado" style={{ width: `${logrado + potencial > 0 ? Math.min(100, Math.max(0, (logrado / (logrado + potencial)) * 100)) : 0}%` }} />
            </div>
          </div>
          {verRealizadas && (
            <ul id="lista-realizadas" className="space-y-3">
              {implementaciones.map((im, i) => {
                const logro = logros[i] ?? 0;
                return (
                  <li key={im.id} className={CLASE_DESCARTADA} data-testid="mejora-realizada">
                    <p>
                      <span className={`mr-2 inline-block rounded-lg px-2 py-0.5 text-[10.5px] font-bold ${FONDO_CATEGORIA[im.categoria] ?? ''}`} data-testid="categoria-realizada">{im.categoria}</span>
                      <span className="text-xs text-slate-500">{pieza.operaciones.some((o) => o.id === im.opId) ? `${numeroOp(im.opId)} · ${im.opNombre}` : `${im.opNombre} (operación eliminada)`}</span>
                    </p>
                    <p className="font-bold">{im.titulo}</p>
                    <p data-testid="fecha-realizada"><b>Implementada el {fechaCorta(im.fecha)}:</b> <span data-testid="nota-realizada">{im.nota}</span></p>
                    <p className="text-xs text-slate-500" data-testid="autor-realizada">Registrada por {im.porEmail} · {fechaHora(im.registradaEn)}</p>
                    <p className="text-xs text-slate-500" data-testid="estimado-realizada">Estimado al registrar: ≈ {usd0(im.ahorroEstimadoAnual)}/año · costo antes {usd4(im.costoPiezaAntes)} por pieza</p>
                    <p data-testid="logrado-realizada">
                      Logrado: <span className={logro < 0 ? CLASE_LOGRO_NEGATIVO : CLASE_LOGRO_POSITIVO}>≈ {usd0(logro)}/año</span>
                      {Math.abs(logro) < 0.005 && <span className="ml-2 text-xs text-slate-500" data-testid="sin-cambios-realizada">Aún sin cambios en los datos</span>}
                    </p>
                    {onAnularImplementacion && (
                      <div><Button type="button" size="sm" variant="outline" aria-label={`Anular registro: ${im.titulo}`} onClick={() => setAAnular(im)}>Anular registro</Button></div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <MarcarImplementadaDialog
        mejora={aImplementar}
        onCancelar={() => setAImplementar(null)}
        onConfirmar={(m, fecha, nota) => { setAImplementar(null); onMarcarImplementada?.(m, fecha, nota); }}
      />
      <AnularImplementacionDialog
        implementacion={aAnular}
        onCancelar={() => setAAnular(null)}
        onConfirmar={(id) => { setAAnular(null); onAnularImplementacion?.(id); }}
      />

      <DescartarMejoraDialog
        mejora={aDescartar}
        onCancelar={() => setADescartar(null)}
        onConfirmar={(m, tipo, motivo) => { setADescartar(null); onDescartar?.(m, tipo, motivo); }}
      />
    </div>
  );
}
