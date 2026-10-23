"use client";

import React from 'react';
import { avisoLote, loteEfectivo } from '@/lib/costos-mecanizado/calc';
import type { ModoProduccion } from '@/lib/costos-mecanizado/types';
import { CampoNumero } from './campos';
import { numero } from './formato';

const CLASE_TARJETA = 'flex-1 min-w-[180px] cursor-pointer rounded-xl border p-3 text-sm transition-colors';
const CLASE_TARJETA_ACTIVA = 'border-blue-500 bg-blue-50';
const CLASE_TARJETA_INACTIVA = 'border-slate-200 bg-white hover:border-slate-300';
const CLASE_INFO_OK = 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800';
const CLASE_INFO_AVISO = 'rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900';

export interface ModoProduccionValor {
  volumenAnual: number;
  modoProduccion: ModoProduccion;
  piezasPorLote?: number;
  lotesPorAnio?: number;
}

const OPCIONES: Array<{ modo: ModoProduccion; titulo: string; detalle: string }> = [
  { modo: 'lote', titulo: 'Por lotes', detalle: 'Indico cuántas piezas tiene cada lote' },
  { modo: 'lotesAnio', titulo: 'Por lotes (lotes por año)', detalle: 'Indico cuántos lotes hago por año' },
  { modo: 'dedicada', titulo: 'Máquina dedicada', detalle: 'Produce todo el año sin cambiar de pieza' },
];

/** "= N preparaciones por año · lotes de X piezas", con el aviso no bloqueante (lote < 50 o más de 2.000 preparaciones por año). */
export function resumenLote(v: ModoProduccionValor): { texto: string; aviso: string | null; dedicada: boolean } {
  if (v.modoProduccion === 'dedicada') {
    return { texto: '1 preparación por año · el setup no incide en el costo por pieza. En producción continua el ahorro está en el tiempo de corte, los tiempos muertos y los cambios de herramienta.', aviso: null, dedicada: true };
  }
  const lote = loteEfectivo(v);
  const preparaciones = Math.max(1, Number.isFinite(v.volumenAnual) ? v.volumenAnual : 1) / lote;
  const aviso = avisoLote(v) ? 'Es un valor poco habitual: revisá que el dato sea correcto. Si la máquina hace esta pieza todo el año, elegí Máquina dedicada.' : null;
  return { texto: `= ${numero(Math.round(preparaciones), 0)} preparaciones por año · lotes de ${numero(Math.round(lote), 0)} piezas`, aviso, dedicada: false };
}

export interface ModoProduccionFieldProps {
  valor: ModoProduccionValor;
  onChange: (cambios: Partial<ModoProduccionValor>) => void;
}

export default function ModoProduccionField({ valor, onChange }: ModoProduccionFieldProps) {
  const info = resumenLote(valor);
  return (
    <div className="space-y-3" data-testid="modo-produccion">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Modo de producción</p>
      <div role="radiogroup" aria-label="Modo de producción" className="flex flex-wrap gap-3">
        {OPCIONES.map((o) => {
          const activa = valor.modoProduccion === o.modo;
          return (
            <label key={o.modo} className={`${CLASE_TARJETA} ${activa ? CLASE_TARJETA_ACTIVA : CLASE_TARJETA_INACTIVA}`}>
              <input type="radio" name="modoProduccion" className="mr-2" checked={activa} onChange={() => onChange({ modoProduccion: o.modo })} />
              <span className="font-bold text-slate-800">{o.titulo}</span>
              <span className="block text-xs text-slate-500 mt-1">{o.detalle}</span>
            </label>
          );
        })}
      </div>
      {valor.modoProduccion === 'lote' && (
        <CampoNumero ruta="piezasPorLote" etiqueta="Piezas por lote" value={valor.piezasPorLote ?? NaN} onChange={(v) => onChange({ piezasPorLote: v })} className="max-w-xs" />
      )}
      {valor.modoProduccion === 'lotesAnio' && (
        <CampoNumero ruta="lotesPorAnio" etiqueta="Lotes por año" value={valor.lotesPorAnio ?? NaN} onChange={(v) => onChange({ lotesPorAnio: v })} className="max-w-xs" />
      )}
      <p className={info.aviso ? CLASE_INFO_AVISO : CLASE_INFO_OK} data-testid="linea-lote">
        {info.texto}
        {info.aviso && <span data-testid="aviso-lote"> · ⚠ {info.aviso}</span>}
      </p>
    </div>
  );
}
