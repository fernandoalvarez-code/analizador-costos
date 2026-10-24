"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ETIQUETA_CORTA_RUBRO, FONDO_RUBRO, TEXTO_SOBRE_RUBRO } from './colores-rubro';
import { ETIQUETA_RUBRO, RUBROS, type CostoHoraPorMaquina, type Operacion, type Pieza, type ResultadoOperacion, type ResultadoPieza, type Rubro } from '@/lib/costos-mecanizado/types';
import { CampoNumero, CampoTexto, CampoTiempo, CLASE_ETIQUETA } from './campos';
import IncidenciaHerramientasTable, { type BaseOperacion } from './incidencia-herramientas-table';
import { conSigno, numero, porcentaje0, usd0, usd4 } from './formato';
import PosicionHerramientaTable from './posicion-herramienta-table';
import TimeInput from './time-input';
import { posicionNueva, rutaOp } from './validar-pieza';
import { useCampo } from './validacion-context';

const CLASE_GRUPO = 'space-y-3';
const CLASE_TITULO = 'text-sm font-bold text-slate-800';
const CLASE_CAMBIO_BUENO = 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900';
const CLASE_CAMBIO_MALO = 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900';
const CLASE_CAMBIO_NEUTRO = 'rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';

export interface OperacionEditorProps {
  op: Operacion;
  resOp: ResultadoOperacion;
  resultado: ResultadoPieza;
  pieza: Pieza;
  maquinas: Array<{ id: string; nombre: string }>;
  costoHora: CostoHoraPorMaquina;
  base: BaseOperacion | null;
  onFijarBase: () => void;
  onChange: (fn: (op: Operacion) => Operacion) => void;
  onEliminar: () => void;
  foco?: { posicionId: string; token: number } | null;
}

/** YYYY-MM-DD -> DD/MM/AAAA (sin pasar por Date: no depende de la zona horaria). */
const fechaCorta = (iso: string) => { const [a, m, d] = iso.split('-'); return a && m && d ? `${d}/${m}/${a}` : iso; };

function SelectorMaquina({ op, maquinas, onChange }: { op: Operacion; maquinas: Array<{ id: string; nombre: string }>; onChange: (id: string) => void }) {
  const { error, tocar } = useCampo(rutaOp(op.id, 'maquinaId'));
  return (
    <div className="min-w-0">
      <span className={CLASE_ETIQUETA}>Máquina</span>
      <select
        aria-label="Máquina" aria-invalid={error ? true : undefined} value={op.maquinaId}
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-medium text-slate-900 ${error ? 'border-red-500' : 'border-slate-200'}`}
        onChange={(e) => { tocar(); onChange(e.target.value); }}
      >
        {!maquinas.some((m) => m.id === op.maquinaId) && <option value={op.maquinaId}>— Elegí una máquina —</option>}
        {maquinas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** Editor de una operación: incidencia, cambio desde la apertura, tiempos y calidad, herramientas e incidencia por herramienta. */
export default function OperacionEditor({ op, resOp, resultado, pieza, maquinas, costoHora, base, onFijarBase, onChange, onEliminar, foco }: OperacionEditorProps) {
  const vol = resultado.volumenAnual;
  const totalPieza = resultado.costoPieza;
  const principal = [...RUBROS].sort((a, b) => resOp[b] - resOp[a])[0];
  const baseOp = base && base.opId === op.id ? base : null;
  const d = baseOp ? resOp.totalOp - baseOp.totalOp : 0;
  const dPieza = baseOp ? totalPieza - baseOp.totalPieza : 0;
  // Registro de mejoras implementadas en esta operación (sin cifra: el logro se mide a nivel pieza)
  const implementacionesOp = (pieza.implementaciones ?? []).filter((im) => im.opId === op.id);

  return (
    <div className="space-y-6 p-4" data-testid="operacion-editor">
      <div className={CLASE_GRUPO}>
        <h4 className={CLASE_TITULO}>Operación</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoTexto ruta={rutaOp(op.id, 'nombre')} etiqueta="Nombre" value={op.nombre} onChange={(v) => onChange((o) => ({ ...o, nombre: v }))} />
          <SelectorMaquina op={op} maquinas={maquinas} onChange={(id) => onChange((o) => ({ ...o, maquinaId: id }))} />
        </div>
      </div>

      <div className={CLASE_GRUPO}>
        <h4 className={CLASE_TITULO}>Incidencia de esta operación en la pieza</h4>
        <div className="flex h-7 w-full overflow-hidden rounded-md bg-slate-100" data-testid="barra-incidencia">
          {RUBROS.map((r) => {
            const w = resOp.totalOp > 0 ? (resOp[r] / resOp.totalOp) * 100 : 0;
            return w > 0.5 ? (
              <div key={r} className={`${FONDO_RUBRO[r]} ${TEXTO_SOBRE_RUBRO[r]} text-[10px] font-bold flex items-center justify-center overflow-hidden`} style={{ width: `${w}%` }} title={`${ETIQUETA_RUBRO[r]}: ${usd4(resOp[r])}`}>
                {w > 9 ? `${ETIQUETA_CORTA_RUBRO[r]} ${numero(w, 0)} %` : ''}
              </div>
            ) : null;
          })}
        </div>
        <p className="text-sm text-slate-700" data-testid="texto-incidencia">
          Esta operación cuesta <b>{usd4(resOp.totalOp)} por pieza</b> = <b>{porcentaje0(totalPieza > 0 ? resOp.totalOp / totalPieza : 0)} de la pieza</b> ({usd0(resOp.totalOp * vol)}/año).
          {' '}Lo que más pesa es <b>{ETIQUETA_RUBRO[principal].toLowerCase()}</b> ({porcentaje0(resOp.totalOp > 0 ? resOp[principal] / resOp.totalOp : 0)}).
        </p>
        {baseOp && (Math.abs(d) < 0.00005 ? (
          <div className={`${CLASE_CAMBIO_NEUTRO} flex flex-wrap items-center gap-3`} data-testid="cambio-operacion">
            <span>Editá tiempos, vidas o precios: acá vas a ver cuánto cambia la operación respecto a cómo estaba al abrirla.</span>
            <Button type="button" size="sm" variant="outline" onClick={onFijarBase}>Fijar como nueva base</Button>
          </div>
        ) : (
          <div className={`${d < 0 ? CLASE_CAMBIO_BUENO : CLASE_CAMBIO_MALO} flex flex-wrap items-center gap-3`} data-testid="cambio-operacion">
            <span>
              Cambio desde que abriste la operación: <b>{conSigno(d, 4)} USD por pieza</b> en la operación · pieza <b>{conSigno(dPieza, 4)} USD</b> ({d < 0 ? 'ahorra' : 'cuesta'} <b>{usd0(Math.abs(d) * vol)}</b> por año).
            </span>
            <Button type="button" size="sm" variant="outline" onClick={onFijarBase}>Fijar como nueva base</Button>
          </div>
        ))}
      </div>

      {implementacionesOp.length > 0 && (
        <div className={CLASE_GRUPO} data-testid="realizadas-operacion">
          <h4 className={CLASE_TITULO}>Mejoras realizadas en esta operación</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            {implementacionesOp.map((im) => (
              <li key={im.id} data-testid="realizada-operacion"><b>{fechaCorta(im.fecha)}</b> · {im.categoria}: {im.nota}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={CLASE_GRUPO}>
        <h4 className={CLASE_TITULO}>Tiempos y calidad</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="min-w-0">
            <span className={CLASE_ETIQUETA}>Tiempo de corte por pieza (mm:ss)</span>
            <TimeInput label="Tiempo de corte por pieza (mm:ss)" value={resOp.corteMin} onChange={() => {}} disabled />
            <p className="mt-1 text-[10px] text-slate-400">Suma de los tiempos de cada herramienta</p>
          </div>
          <CampoTiempo ruta={rutaOp(op.id, 'tiemposMuertosMin')} etiqueta="Tiempos muertos por pieza (mm:ss)" ayuda="Carga, descarga, posicionamiento, medición" value={op.tiemposMuertosMin} onChange={(v) => onChange((o) => ({ ...o, tiemposMuertosMin: v }))} />
          <CampoTiempo ruta={rutaOp(op.id, 'setupMin')} etiqueta="Setup por lote (mm:ss)" value={op.setupMin} onChange={(v) => onChange((o) => ({ ...o, setupMin: v }))} />
          <CampoNumero ruta={rutaOp(op.id, 'scrapPct')} etiqueta="Scrap (%)" value={op.scrapPct} onChange={(v) => onChange((o) => ({ ...o, scrapPct: v }))} />
        </div>
      </div>

      <div className={CLASE_GRUPO}>
        <h4 className={CLASE_TITULO}>Herramientas</h4>
        <p className="text-xs text-slate-500">
          <b>Cargá lo que medís en planta:</b> filos del inserto, <b>piezas por filo</b> y <b>corte por pieza</b> de esa herramienta. La app calcula la <b>vida útil por filo</b> (piezas × corte).
          Si solo tenés la vida en minutos (por ejemplo, de catálogo), escribila ahí y la app calcula las piezas por filo. Solo la opción marcada como <b>en uso</b> entra en la cuenta; las demás quedan para comparar.
        </p>
        {op.herramientas.map((pos, i) => (
          <PosicionHerramientaTable
            key={pos.id} opId={op.id} indice={i} pos={pos} pieza={pieza} costoHora={costoHora} foco={foco}
            onChange={(fn) => onChange((o) => ({ ...o, herramientas: o.herramientas.map((p) => (p.id === pos.id ? fn(p) : p)) }))}
            onQuitar={() => onChange((o) => ({ ...o, herramientas: o.herramientas.filter((p) => p.id !== pos.id) }))}
          />
        ))}
        <h4 className="pt-2 text-sm font-bold text-slate-800">Incidencia de cada herramienta en la pieza</h4>
        <IncidenciaHerramientasTable op={op} resOp={resOp} base={base} />
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange((o) => ({ ...o, herramientas: [...o.herramientas, posicionNueva()] }))}>+ Herramienta</Button>
          <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={onEliminar}>🗑️ Eliminar operación</Button>
        </div>
      </div>
    </div>
  );
}
