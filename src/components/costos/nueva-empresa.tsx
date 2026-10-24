"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmpresa } from './empresa-context';

const CLASE_ETIQUETA = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const CLASE_ERROR = 'text-xs font-medium text-red-600';

/** Plantas de un texto "Planta 1, Planta 2": sin vacías ni repetidas. */
export function parsearPlantas(texto: string): string[] {
  return [...new Set(texto.split(',').map((p) => p.trim()).filter(Boolean))];
}

/** "+ Nueva empresa" con su formulario (nombre obligatorio y plantas separadas por coma). Solo lo ofrece el admin SECOCUT (`puedeCrear`). */
export default function NuevaEmpresa() {
  const { puedeCrear, crearEmpresa } = useEmpresa();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [plantas, setPlantas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!puedeCrear) return null;

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
    <div className="flex flex-col gap-2 items-start" data-testid="nueva-empresa">
      {!creando && <Button type="button" variant="outline" size="sm" onClick={() => setCreando(true)}>+ Nueva empresa</Button>}
      {creando && (
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
