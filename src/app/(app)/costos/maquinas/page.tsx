"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEmpresa } from '@/components/costos/empresa-context';
import MaquinasTabla from '@/components/costos/maquinas-tabla';

export default function MaquinasPage() {
  const { empresa, repo } = useEmpresa();
  if (!empresa || !repo) return null;
  return (
    <div className="space-y-4">
      <div>
        <Link href="/costos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        <h2 className="text-xl font-bold text-slate-800 mt-1">Mis máquinas</h2>
        <p className="text-sm text-slate-500">Costo hora de cada máquina (USD/h): incluye operario, energía, amortización y gastos. Si lo cambiás, se recalcula el costo de las piezas que la usan.</p>
      </div>
      {/* key: al cambiar de empresa se descarta todo el estado de la tabla */}
      <MaquinasTabla key={empresa.id} empresaId={empresa.id} repo={repo} />
    </div>
  );
}
