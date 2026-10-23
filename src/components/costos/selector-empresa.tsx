"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmpresa } from './empresa-context';

const CLASE_SELECT = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const CLASE_ETIQUETA = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const CLASE_ERROR = 'text-xs font-medium text-red-600';

/** Empresas de un texto "Planta 1, Planta 2": sin vacíos ni repetidas. */
export function parsearPlantas(texto: string): string[] {
  return [...new Set(texto.split(',').map((p) => p.trim()).filter(Boolean))];
}

/** Selector de empresa para vendedor y admin (el cliente tiene empresa fija y no ve selector). El admin puede crear empresas. */
export default function SelectorEmpresa() {
  const { empresa, empresas, puedeElegir, puedeCrear, seleccionar, crearEmpresa } = useEmpresa();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [plantas, setPlantas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!puedeElegir) return null;

  const cancelar = () => { setCreando(false); setNombre(''); setPlantas(''); setError(null); };
  const crear = async () => {
    if (nombre.trim() === '') { setError('El nombre de la empresa es obligatorio.'); return; }
    setGuardando(true);
    setError(null);
    try {
      await crearEmpresa(nombre.trim(), parsearPlantas(plantas));
      cancelar();
    } catch (e) {
      console.error('[costos] No se pudo crear la empresa:', e);
      setError('No se pudo crear la empresa. Reintentá.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 items-start md:items-end" data-testid="selector-empresa">
      <div className="flex items-end gap-2">
        {empresas.length > 0 && (
          <div>
            <label htmlFor="costos-empresa" className={CLASE_ETIQUETA}>Empresa</label>
            <select id="costos-empresa" className={CLASE_SELECT} value={empresa?.id ?? ''} onChange={(e) => seleccionar(e.target.value)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        )}
        {puedeCrear && !creando && (
          <Button type="button" variant="outline" size="sm" onClick={() => setCreando(true)}>+ Nueva empresa</Button>
        )}
      </div>
      {puedeCrear && creando && (
        <form
          className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 w-full md:w-80"
          onSubmit={(e) => { e.preventDefault(); void crear(); }}
          data-testid="form-nueva-empresa"
        >
          <div>
            <label htmlFor="nueva-empresa-nombre" className={CLASE_ETIQUETA}>Nombre</label>
            <Input id="nueva-empresa-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-invalid={error && nombre.trim() === '' ? true : undefined} />
          </div>
          <div>
            <label htmlFor="nueva-empresa-plantas" className={CLASE_ETIQUETA}>Plantas (opcional, separadas por coma)</label>
            <Input id="nueva-empresa-plantas" value={plantas} onChange={(e) => setPlantas(e.target.value)} placeholder="Planta 1, Planta 2" />
          </div>
          {error && <p role="alert" className={CLASE_ERROR}>{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={guardando}>{guardando ? 'Creando…' : 'Crear'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelar} disabled={guardando}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}
