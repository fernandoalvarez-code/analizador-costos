"use client";

import React from 'react';
import type { Pieza } from '@/lib/costos-mecanizado/types';
import { CampoNumero, CampoTexto } from './campos';
import ModoProduccionField from './modo-produccion-field';

const CLASE_SECCION = 'rounded-xl border border-slate-200 bg-white p-5 space-y-5';
const CLASE_OPCION = 'flex items-center gap-2 text-sm text-slate-700';

export interface DatosPiezaFormProps {
  pieza: Pieza;
  onChange: (fn: (p: Pieza) => Pieza) => void;
  /** Aviso (no bloqueante) si el código ya existe en la empresa. */
  avisoCodigo?: string | null;
  /** Se llama al editar el código (el editor carga la lista de códigos una sola vez, no en cada tecla). */
  onCodigoEditado?: () => void;
}

/** A. Datos de la pieza: código y nombre, piezas por año, material y modo de producción. */
export default function DatosPiezaForm({ pieza, onChange, avisoCodigo, onCodigoEditado }: DatosPiezaFormProps) {
  const m = pieza.material;
  return (
    <section className={CLASE_SECCION} aria-labelledby="titulo-datos">
      <h3 id="titulo-datos" className="text-lg font-bold text-slate-800">A. Datos de la pieza</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CampoTexto ruta="codigo" etiqueta="Código" value={pieza.codigo} placeholder="Ej: CAR-001" aviso={avisoCodigo} onChange={(v) => { onCodigoEditado?.(); onChange((p) => ({ ...p, codigo: v })); }} />
        <CampoTexto ruta="nombre" etiqueta="Nombre" value={pieza.nombre} placeholder="Ej: Carcasa" onChange={(v) => onChange((p) => ({ ...p, nombre: v }))} />
        <CampoNumero ruta="volumenAnual" etiqueta="Piezas por año" value={pieza.volumenAnual} onChange={(v) => onChange((p) => ({ ...p, volumenAnual: v }))} />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">¿Quién pone el material?</p>
        <div role="radiogroup" aria-label="¿Quién pone el material?" className="flex flex-wrap gap-6">
          <label className={CLASE_OPCION}>
            <input type="radio" name="quienPone" checked={m.quienPone === 'propio'}
              onChange={() => onChange((p) => ({ ...p, material: { quienPone: 'propio', costoPorPieza: p.material.costoPorPieza ?? 0 } }))} />
            Yo
          </label>
          <label className={CLASE_OPCION}>
            <input type="radio" name="quienPone" checked={m.quienPone === 'cliente'}
              onChange={() => onChange((p) => ({ ...p, material: { quienPone: 'cliente', clienteCobraScrap: p.material.clienteCobraScrap ?? false, cobroPorPiezaPerdida: p.material.cobroPorPiezaPerdida } }))} />
            El cliente
          </label>
        </div>
        {m.quienPone === 'propio' && (
          <CampoNumero ruta="material.costoPorPieza" etiqueta="Costo del material por pieza (USD)" value={m.costoPorPieza ?? NaN} className="max-w-xs"
            onChange={(v) => onChange((p) => ({ ...p, material: { ...p.material, costoPorPieza: v } }))} />
        )}
        {m.quienPone === 'cliente' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">¿El cliente te cobra las piezas que se pierden (scrap)?</p>
            <div role="radiogroup" aria-label="¿El cliente te cobra las piezas perdidas?" className="flex gap-6">
              <label className={CLASE_OPCION}>
                <input type="radio" name="cobraScrap" checked={m.clienteCobraScrap === true}
                  onChange={() => onChange((p) => ({ ...p, material: { ...p.material, clienteCobraScrap: true } }))} />
                Sí
              </label>
              <label className={CLASE_OPCION}>
                <input type="radio" name="cobraScrap" checked={!m.clienteCobraScrap}
                  onChange={() => onChange((p) => ({ ...p, material: { ...p.material, clienteCobraScrap: false } }))} />
                No
              </label>
            </div>
            {m.clienteCobraScrap && (
              <CampoNumero ruta="material.cobroPorPiezaPerdida" etiqueta="Monto que te cobra por pieza perdida (USD)" value={m.cobroPorPiezaPerdida ?? NaN} className="max-w-xs"
                onChange={(v) => onChange((p) => ({ ...p, material: { ...p.material, cobroPorPiezaPerdida: v } }))} />
            )}
          </div>
        )}
      </div>

      <ModoProduccionField
        valor={{ volumenAnual: pieza.volumenAnual, modoProduccion: pieza.modoProduccion, piezasPorLote: pieza.piezasPorLote, lotesPorAnio: pieza.lotesPorAnio }}
        onChange={(c) => onChange((p) => ({
          ...p, ...c,
          // al pasar a un modo que necesita su dato, arranca con un valor razonable (el usuario lo ajusta)
          ...(c.modoProduccion === 'lote' && p.piezasPorLote === undefined ? { piezasPorLote: 100 } : {}),
          ...(c.modoProduccion === 'lotesAnio' && p.lotesPorAnio === undefined ? { lotesPorAnio: 10 } : {}),
        }))}
      />
    </section>
  );
}
