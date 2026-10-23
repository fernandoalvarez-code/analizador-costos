"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TAMANO_PAGINA_PIEZAS, type FilaPieza, type RepositorioCostos } from '@/lib/costos-mecanizado/firestore';
import { usd0, usd4 } from './formato';

const CLASE_TH = 'p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500';

type RepoLista = Pick<RepositorioCostos, 'listarPiezasPagina'>;
type Cursor = Awaited<ReturnType<RepoLista['listarPiezasPagina']>>['siguiente'];

/** Lista MÍNIMA de piezas (el resumen de planta completo llega después): 15 por página con código, nombre, USD/pza y USD/año del resumen. */
export default function PiezasLista({ empresaId, repo }: { empresaId: string; repo: RepoLista }) {
  const [filas, setFilas] = useState<FilaPieza[]>([]);
  const [carga, setCarga] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [pagina, setPagina] = useState(0);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  // cursores[i] = desde dónde empieza la página i (null = la primera)
  const cursores = useRef<Cursor[]>([null]);
  const montado = useRef(true);

  const cargar = useCallback(async (n: number) => {
    setCarga('cargando');
    try {
      const r = await repo.listarPiezasPagina(empresaId, TAMANO_PAGINA_PIEZAS, cursores.current[n] ?? undefined);
      if (!montado.current) return;
      cursores.current[n + 1] = r.siguiente;
      setFilas(r.items);
      setSiguiente(r.siguiente);
      setPagina(n);
      setCarga('ok');
    } catch (e) {
      console.error('[costos] No se pudieron leer las piezas:', e);
      if (montado.current) setCarga('error');
    }
  }, [repo, empresaId]);

  useEffect(() => { montado.current = true; void cargar(0); return () => { montado.current = false; }; }, [cargar]);

  return (
    <section className="space-y-3" aria-labelledby="titulo-piezas">
      <div className="flex items-center justify-between">
        <h2 id="titulo-piezas" className="text-lg font-bold text-slate-800">Piezas</h2>
        <Link href="/costos/piezas/nueva" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Nueva pieza</Link>
      </div>
      {carga === 'error' && (
        <div role="alert" className="space-y-2 text-sm text-slate-600">
          <p>No se pudieron leer las piezas.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void cargar(pagina)}>Reintentar</Button>
        </div>
      )}
      {carga !== 'error' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm" data-testid="lista-piezas">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className={`${CLASE_TH} text-left`}>Código</th><th className={`${CLASE_TH} text-left`}>Nombre</th><th className={`${CLASE_TH} text-right`}>USD/pza</th><th className={`${CLASE_TH} text-right`}>USD/año</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carga === 'cargando' && <tr><td colSpan={4} className="p-6 text-center text-slate-500" role="status">Cargando piezas…</td></tr>}
              {carga === 'ok' && filas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Todavía no cargaste piezas. Agregá la primera con «+ Nueva pieza».</td></tr>}
              {carga === 'ok' && filas.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50" data-testid="fila-pieza">
                  <td className="p-3 font-bold"><Link href={`/costos/piezas/${f.id}`} className="text-blue-700 hover:underline">{f.codigo}</Link></td>
                  <td className="p-3">{f.nombre}</td>
                  <td className="p-3 text-right tabular-nums">{usd4(f.resumen?.costoPieza ?? 0)}</td>
                  <td className="p-3 text-right tabular-nums font-bold">{usd0(f.resumen?.costoAnual ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {carga === 'ok' && (pagina > 0 || siguiente) && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Página {pagina + 1}</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pagina === 0} onClick={() => void cargar(pagina - 1)}>← Anterior</Button>
            <Button type="button" size="sm" variant="outline" disabled={!siguiente} onClick={() => void cargar(pagina + 1)}>Siguiente →</Button>
          </span>
        </div>
      )}
    </section>
  );
}
