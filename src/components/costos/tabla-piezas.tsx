"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FilaPieza } from '@/lib/costos-mecanizado/firestore';
import { toMmss } from '@/lib/costos-mecanizado/time';
import { ETIQUETA_RUBRO, RUBROS } from '@/lib/costos-mecanizado/types';
import { numero, usd0, usd4 } from './formato';
import {
  etiquetaOperacion, etiquetaRubro, filtrarPiezas, ordenarPiezas, paginar, resumenDesactualizado, PIEZAS_POR_PAGINA,
  type ColumnaOrden, type Filtros, type Sentido,
} from './planta-utils';

const CLASE_TH = 'p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 select-none';
const CLASE_SELECT = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800';

const COLUMNAS: Array<{ id: ColumnaOrden; titulo: string; derecha: boolean }> = [
  { id: 'codigo', titulo: 'Código', derecha: false },
  { id: 'nombre', titulo: 'Nombre', derecha: false },
  { id: 'costoPieza', titulo: 'USD/pza', derecha: true },
  { id: 'costoAnual', titulo: 'USD/año', derecha: true },
  { id: 'minutosPieza', titulo: 'Min/pza', derecha: true },
  { id: 'opMayorCosto', titulo: 'Operación de mayor costo', derecha: false },
  { id: 'rubroPrincipal', titulo: 'Rubro principal', derecha: false },
  { id: 'ahorro', titulo: 'Ahorro potencial', derecha: true },
];

export interface TablaPiezasProps {
  filas: FilaPieza[];
  maquinas: Array<{ id: string; nombre: string }>;
  reglasVersion: number;
}

/** Tabla de todas las piezas con búsqueda, filtros, orden por columna y 15 por página (todo sobre los resúmenes en memoria). */
export default function TablaPiezas({ filas, maquinas, reglasVersion }: TablaPiezasProps) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<Filtros>({ texto: '', maquinaId: '', rubro: '' });
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; sentido: Sentido }>({ columna: 'costoAnual', sentido: 'desc' });
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => filtrarPiezas(filas, filtros), [filas, filtros]);
  const ordenadas = useMemo(() => ordenarPiezas(filtradas, orden.columna, orden.sentido), [filtradas, orden]);
  const pag = useMemo(() => paginar(ordenadas, pagina), [ordenadas, pagina]);

  const cambiarFiltro = (cambio: Partial<Filtros>) => { setFiltros((f) => ({ ...f, ...cambio })); setPagina(0); };
  const ordenarPor = (columna: ColumnaOrden) => {
    setOrden((o) => (o.columna === columna ? { columna, sentido: o.sentido === 'asc' ? 'desc' : 'asc' } : { columna, sentido: columna === 'codigo' || columna === 'nombre' ? 'asc' : 'desc' }));
    setPagina(0);
  };

  return (
    <section className="space-y-3" aria-labelledby="titulo-tabla-piezas" data-testid="tabla-piezas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-tabla-piezas" className="text-lg font-bold text-slate-800">Todas las piezas</h2>
        <Link href="/costos/piezas/nueva" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Nueva pieza</Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input aria-label="Buscar por código o nombre" placeholder="Buscar por código o nombre…" className="h-9 w-64 bg-white" value={filtros.texto} onChange={(e) => cambiarFiltro({ texto: e.target.value })} />
        <label className="text-xs text-slate-500">
          Pasa por la máquina
          <select aria-label="Pasa por la máquina" className={`${CLASE_SELECT} block`} value={filtros.maquinaId} onChange={(e) => cambiarFiltro({ maquinaId: e.target.value })}>
            <option value="">Todas</option>
            {maquinas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Rubro principal
          <select aria-label="Rubro principal" className={`${CLASE_SELECT} block`} value={filtros.rubro} onChange={(e) => cambiarFiltro({ rubro: e.target.value as Filtros['rubro'] })}>
            <option value="">Todos</option>
            {RUBROS.map((r) => <option key={r} value={r}>{ETIQUETA_RUBRO[r]}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-500" data-testid="cuenta-piezas">{numero(pag.total, 0)} {pag.total === 1 ? 'pieza' : 'piezas'}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {COLUMNAS.map((c) => {
                const activa = orden.columna === c.id;
                return (
                  <th key={c.id} className={`${CLASE_TH} ${c.derecha ? 'text-right' : 'text-left'}`} aria-sort={activa ? (orden.sentido === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800 ${activa ? 'text-slate-900' : ''}`} onClick={() => ordenarPor(c.id)} data-testid={`ordenar-${c.id}`}>
                      {c.titulo}{activa ? (orden.sentido === 'asc' ? ' ▴' : ' ▾') : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pag.items.length === 0 && (
              <tr><td colSpan={COLUMNAS.length} className="p-6 text-center text-slate-500">Ninguna pieza coincide con el filtro.</td></tr>
            )}
            {pag.items.map((f) => {
              const vieja = resumenDesactualizado(f, reglasVersion);
              return (
                <tr key={f.id} className="cursor-pointer hover:bg-slate-50" data-testid="fila-pieza" onClick={() => router.push(`/costos/piezas/${f.id}`)}>
                  <td className="p-3 font-bold">
                    <Link href={`/costos/piezas/${f.id}`} className="text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>{f.codigo}</Link>
                    {vieja && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" data-testid="insignia-reglas-fila" title="El resumen de esta pieza se calculó con otras reglas.">calculado con reglas anteriores</span>}
                  </td>
                  <td className="p-3">{f.nombre}</td>
                  <td className="p-3 text-right tabular-nums">{usd4(f.resumen?.costoPieza ?? 0)}</td>
                  <td className="p-3 text-right tabular-nums font-bold">{usd0(f.resumen?.costoAnual ?? 0)}</td>
                  <td className="p-3 text-right tabular-nums text-slate-500">{toMmss(f.resumen?.minutosPieza ?? 0)}</td>
                  <td className="p-3 text-slate-600" title={f.resumen?.opMayorCosto}>{etiquetaOperacion(f.resumen?.opMayorCosto)}</td>
                  <td className="p-3 text-slate-600">{etiquetaRubro(f.resumen?.rubroPrincipal)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-emerald-700">{usd0(f.resumen?.ahorroPotencialAnual ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pag.paginas > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600" data-testid="paginacion">
          <span>Página {pag.pagina + 1} de {pag.paginas} · {PIEZAS_POR_PAGINA} por página</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pag.pagina === 0} onClick={() => setPagina(pag.pagina - 1)}>← Anterior</Button>
            <Button type="button" size="sm" variant="outline" disabled={pag.pagina >= pag.paginas - 1} onClick={() => setPagina(pag.pagina + 1)}>Siguiente →</Button>
          </span>
        </div>
      )}
    </section>
  );
}
