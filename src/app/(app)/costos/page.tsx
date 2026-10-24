"use client";

import Link from 'next/link';
import { useEmpresa } from '@/components/costos/empresa-context';
import ResumenPlanta from '@/components/costos/resumen-planta';

const CLASE_TARJETA = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm';
const CLASE_ENLACE = 'inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors';

export default function CostosPage() {
  const { empresa, repo, modo } = useEmpresa();
  if (!empresa || !repo) return null;
  return (
    <div className="space-y-6">
      <section className={CLASE_TARJETA} data-testid="tarjeta-empresa">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Empresa</p>
        <h2 className="text-xl font-bold text-slate-800 mt-1">{empresa.nombre}</h2>
        {empresa.plantas?.length ? <p className="text-sm text-slate-500 mt-1">Planta: {empresa.plantas.join(' · ')}</p> : null}
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/costos/maquinas" className={CLASE_ENLACE}>Mis máquinas</Link>
      </div>
      {/* key: al cambiar de empresa se descarta todo el estado (filtros, página, resúmenes) */}
      <ResumenPlanta key={empresa.id} empresaId={empresa.id} repo={repo} esAdmin={modo === 'admin'} />
    </div>
  );
}
