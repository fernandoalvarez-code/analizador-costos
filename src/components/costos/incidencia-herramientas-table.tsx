"use client";

import React from 'react';
import type { Operacion, ResultadoOperacion, Sensibilidad } from '@/lib/costos-mecanizado/types';
import { toMmss } from '@/lib/costos-mecanizado/time';
import { TOLERANCIA_IGUAL, deltaPza, exactoPza, numero, numeroPza, porcentaje0, porcentaje1, usdPza } from './formato';

const CLASE_TH = 'p-2 text-[10px] font-bold uppercase tracking-wide text-left whitespace-nowrap';
const CLASE_TH_GRIS = `${CLASE_TH} text-slate-400`;
const CLASE_TH_PRINCIPAL = `${CLASE_TH} text-slate-700 bg-blue-50`;
const CLASE_TD = 'p-2 align-top tabular-nums';
const CLASE_GRIS = 'text-slate-400';
const CLASE_BAJA = 'font-bold text-emerald-700';
const CLASE_SUBE = 'font-bold text-red-600';
const CLASE_NIVEL: Record<string, string> = { Bajo: 'text-emerald-700', Medio: 'text-amber-700', Alto: 'text-red-600' };

const TOOLTIP_SENSIBILIDAD =
  'Indica cuánto se nota el precio de la herramienta en el costo de la operación (consumo más cambios, sobre el total de la operación). No mide cuánto cuesta la herramienta.';

/** "sube 1,07 %" / "baja 0,99 %": la dirección siempre explícita (positivo = el costo sube). */
export function textoSensibilidad(s: Sensibilidad): string {
  return `${s.direccion} ${numero(s.pct, 2)} %`;
}

/** Minutos de corte de la opción en uso de una posición. */
function cortePorPosicion(op: Operacion, posicionId: string): number {
  const pos = op.herramientas.find((p) => p.id === posicionId);
  const o = pos?.opciones[Math.min(Math.max(0, pos.seleccionada), pos.opciones.length - 1)];
  return o && Number.isFinite(o.cortePorPiezaMin) ? o.cortePorPiezaMin : 0;
}

/** Base para "Cambio desde que abriste la operación": lo que costaba la operación y cada herramienta al abrirla. */
export interface BaseOperacion {
  opId: string;
  totalOp: number;
  totalPieza: number;
  porPosicion: Record<string, number>;
}

export interface IncidenciaHerramientasTableProps {
  op: Operacion;
  resOp: ResultadoOperacion;
  base: BaseOperacion | null;
}

/** Incidencia de cada herramienta: lo principal en USD/pza; participaciones y sensibilidad al precio en gris con "?". */
export default function IncidenciaHerramientasTable({ op, resOp, base }: IncidenciaHerramientasTableProps) {
  const baseOp = base && base.opId === resOp.opId ? base : null;
  if (resOp.herramientasDetalle.length === 0) return <p className="text-sm text-slate-500">Todavía no hay herramientas en esta operación.</p>;
  return (
    <div className="space-y-2" data-testid="incidencia-herramientas">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${CLASE_TH} text-slate-700`}>Herramienta</th>
              <th className={CLASE_TH_PRINCIPAL}>Costo USD/pza</th>
              <th className={`${CLASE_TH} text-slate-700`}>Cambio al editar</th>
              <th className={`${CLASE_TH} text-slate-700`}>Tiempo de corte</th>
              <th className={`${CLASE_TH} text-slate-700`}>Consumo</th>
              <th className={`${CLASE_TH} text-slate-700`}>Cambios</th>
              <th className={`${CLASE_TH} text-slate-700`}>Roturas</th>
              <th className={CLASE_TH_GRIS}>Participación en la pieza</th>
              <th className={CLASE_TH_GRIS}>Participación en la op.</th>
              <th className={CLASE_TH_GRIS}>
                Sensibilidad al precio{' '}
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] cursor-help" title={TOOLTIP_SENSIBILIDAD} aria-label={TOOLTIP_SENSIBILIDAD} data-testid="ayuda-sensibilidad">?</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {resOp.herramientasDetalle.map((h) => {
              const antes = baseOp?.porPosicion[h.posicionId];
              const d = antes === undefined ? 0 : h.costoHerr - antes;
              return (
                <tr key={h.posicionId} data-testid="fila-incidencia">
                  <td className={CLASE_TD}>{h.nombre}<div className="text-xs text-slate-400">{toMmss(cortePorPosicion(op, h.posicionId))} de corte</div></td>
                  <td className={`${CLASE_TD} bg-blue-50/40 font-bold text-base`} data-testid="costo-herramienta" title={exactoPza(h.costoHerr)}>{usdPza(h.costoHerr)}</td>
                  <td className={CLASE_TD} data-testid="cambio-herramienta">
                    {Math.abs(d) < TOLERANCIA_IGUAL ? <span className={CLASE_GRIS}>—</span> : <span className={d < 0 ? CLASE_BAJA : CLASE_SUBE} title={exactoPza(d)}>{deltaPza(d)}</span>}
                  </td>
                  <td className={CLASE_TD} title={exactoPza(h.corte)}>{numeroPza(h.corte)}</td>
                  <td className={CLASE_TD} title={exactoPza(h.consumo)}>{numeroPza(h.consumo)}</td>
                  <td className={CLASE_TD} title={exactoPza(h.cambios)}>{numeroPza(h.cambios)}</td>
                  <td className={CLASE_TD} title={h.rotTiempo + h.scrapRot > 0 ? exactoPza(h.rotTiempo + h.scrapRot) : undefined}>{h.rotTiempo + h.scrapRot > 0 ? numeroPza(h.rotTiempo + h.scrapRot) : <span className={CLASE_GRIS}>—</span>}</td>
                  <td className={`${CLASE_TD} ${CLASE_GRIS}`}>{porcentaje1(h.partPieza * 100)}</td>
                  <td className={`${CLASE_TD} ${CLASE_GRIS}`}>{porcentaje0(h.partOp)}</td>
                  <td className={`${CLASE_TD} ${CLASE_GRIS}`}><span className={CLASE_NIVEL[h.nivelSensPrecio]}>{h.nivelSensPrecio}</span> ({porcentaje0(h.sensPrecio)})</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 text-xs text-slate-500" data-testid="sensibilidades">
        {resOp.herramientasDetalle.map((h) => (
          <p key={h.posicionId}>
            <b className="text-slate-700">{h.nombre}</b> · Precio +10 % → la pieza <b>{textoSensibilidad(h.sensibilidades.precioMas10)}</b>
            {' '}· Vida +10 % → la pieza <b>{textoSensibilidad(h.sensibilidades.vidaMas10)}</b>
            {' '}· Corta 10 % más rápido con la misma vida → la pieza <b>{textoSensibilidad(h.sensibilidades.cortaMasRapido10)}</b>
            {' '}· Subir vc 10 % con la misma herramienta (vida −32 %, Taylor) → la pieza <b>{textoSensibilidad(h.sensibilidades.subirVc10)}</b>
          </p>
        ))}
      </div>
    </div>
  );
}
