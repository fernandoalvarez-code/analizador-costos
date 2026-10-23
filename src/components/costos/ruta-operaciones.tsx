"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import type { CostoHoraPorMaquina, Operacion, Pieza, ResultadoPieza } from '@/lib/costos-mecanizado/types';
import { toMmss } from '@/lib/costos-mecanizado/time';
import { numero, porcentaje0 } from './formato';
import type { BaseOperacion } from './incidencia-herramientas-table';
import OperacionEditor from './operacion-editor';

const CLASE_TH = 'text-[10px] font-bold uppercase tracking-wide text-slate-500';
const CLASE_CELDA = 'text-sm';
const CLASE_FILA = 'grid min-w-[640px] grid-cols-[4rem_minmax(8rem,1.5fr)_minmax(8rem,1.2fr)_6rem_6rem_5rem_7rem] items-center gap-3 px-3 py-3';
const CLASE_NUM_TOPE = 'font-black text-red-600';
const CLASE_NUM = 'font-bold text-slate-800';

export interface RutaOperacionesProps {
  pieza: Pieza;
  resultado: ResultadoPieza;
  maquinas: Array<{ id: string; nombre: string }>;
  costoHora: CostoHoraPorMaquina;
  abierta: string | null;
  base: BaseOperacion | null;
  onAbrir: (opId: string | null) => void;
  onFijarBase: () => void;
  onCambiarOp: (opId: string, fn: (op: Operacion) => Operacion) => void;
  onEliminarOp: (opId: string) => void;
  onAgregarOp: () => void;
  foco?: { posicionId: string; token: number } | null;
}

/** B. Ruta de operaciones: la de mayor costo con el número en rojo; clic en una fila para editarla. */
export default function RutaOperaciones({ pieza, resultado, maquinas, costoHora, abierta, base, onAbrir, onFijarBase, onCambiarOp, onEliminarOp, onAgregarOp, foco }: RutaOperacionesProps) {
  const nombreMaquina = (id: string) => maquinas.find((m) => m.id === id)?.nombre ?? '—';
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4" aria-labelledby="titulo-ruta">
      <h3 id="titulo-ruta" className="text-lg font-bold text-slate-800">B. Ruta de operaciones</h3>
      {pieza.operaciones.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay operaciones. Agregá la primera.</p>
      ) : (
        <div role="table" aria-label="Ruta de operaciones" className="divide-y divide-slate-100">
          <div role="row" className="overflow-x-auto">
            <div className={`${CLASE_FILA} ${CLASE_TH}`}>
              <span role="columnheader">Op</span><span role="columnheader">Operación</span><span role="columnheader">Máquina</span>
              <span role="columnheader" className="text-right">Tiempo/pza</span><span role="columnheader" className="text-right">USD/pza</span><span role="columnheader" className="text-right">% pieza</span><span />
            </div>
          </div>
          {pieza.operaciones.map((op, i) => {
            const res = resultado.operaciones[i];
            const esTope = op.id === resultado.opMayorCosto && resultado.operaciones.length > 1;
            const abiertaEsta = abierta === op.id;
            return (
              <div key={op.id} role="rowgroup">
                {/* La fila resumen es la que se desplaza en pantallas angostas; el editor ocupa todo el ancho de la tarjeta. */}
                <div role="row" className="overflow-x-auto hover:bg-slate-50" data-testid="fila-operacion" data-tope={esTope ? 'true' : 'false'}>
                  <div className={`${CLASE_FILA} ${CLASE_CELDA}`}>
                    <span role="cell" className={esTope ? CLASE_NUM_TOPE : CLASE_NUM} data-testid="numero-operacion">Op {(i + 1) * 10}</span>
                    <span role="cell" className="font-bold">{op.nombre || 'Sin nombre'}</span>
                    <span role="cell" className="text-slate-500">{nombreMaquina(op.maquinaId)}</span>
                    <span role="cell" className="text-right tabular-nums">{toMmss(res?.minutosOp ?? 0)}</span>
                    <span role="cell" className={`text-right tabular-nums ${esTope ? CLASE_NUM_TOPE : 'font-bold'}`} data-testid="usd-operacion">{numero(res?.totalOp ?? 0, 3)}</span>
                    <span role="cell" className="text-right tabular-nums text-slate-500">{porcentaje0(resultado.costoPieza > 0 ? (res?.totalOp ?? 0) / resultado.costoPieza : 0)}</span>
                    <span role="cell" className="text-right">
                      <Button type="button" size="sm" variant="ghost" aria-expanded={abiertaEsta} aria-label={`${abiertaEsta ? 'Cerrar' : 'Editar'} ${op.nombre || 'operación'}`} onClick={() => onAbrir(abiertaEsta ? null : op.id)}>
                        {abiertaEsta ? 'Cerrar ▴' : 'Editar ▾'}
                      </Button>
                    </span>
                  </div>
                </div>
                {abiertaEsta && res && (
                  <div className="rounded-lg bg-slate-50/60">
                    <OperacionEditor
                      op={op} resOp={res} resultado={resultado} pieza={pieza} maquinas={maquinas} costoHora={costoHora} base={base}
                      onFijarBase={onFijarBase} onChange={(fn) => onCambiarOp(op.id, fn)} onEliminar={() => onEliminarOp(op.id)} foco={foco}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button type="button" variant="outline" onClick={onAgregarOp}>+ Agregar operación</Button>
    </section>
  );
}
