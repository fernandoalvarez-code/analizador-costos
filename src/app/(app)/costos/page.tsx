"use client";

import Link from 'next/link';
import { useEmpresa } from '@/components/costos/empresa-context';

const CLASE_TARJETA = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm';
const CLASE_ENLACE = 'inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors';
const CLASE_PROXIMAMENTE = 'inline-flex items-center rounded-md border border-dashed border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed';

export default function CostosPage() {
  const { empresa } = useEmpresa();
  if (!empresa) return null;
  return (
    <div className="space-y-6">
      <section className={CLASE_TARJETA} data-testid="tarjeta-empresa">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Empresa</p>
        <h2 className="text-xl font-bold text-slate-800 mt-1">{empresa.nombre}</h2>
        {empresa.plantas?.length ? <p className="text-sm text-slate-500 mt-1">Planta: {empresa.plantas.join(' · ')}</p> : null}
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/costos/maquinas" className={CLASE_ENLACE}>Mis máquinas</Link>
        <span className={CLASE_PROXIMAMENTE} aria-disabled="true">Piezas: próximamente</span>
      </div>
    </div>
  );
}
