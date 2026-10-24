"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useEmpresa } from '@/components/costos/empresa-context';
import PiezaEditor from '@/components/costos/pieza-editor';
import type { MaquinaDoc, PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import type { ReglasCostos } from '@/lib/costos-mecanizado/types';

interface Datos {
  maquinas: MaquinaDoc[];
  reglas: ReglasCostos;
  pieza: PiezaDoc | null;
}

/** "nueva" crea la pieza en el primer guardado válido; cualquier otro id es una pieza de la empresa. */
export default function PiezaPage() {
  const { piezaId } = useParams<{ piezaId: string }>();
  const { empresa, repo } = useEmpresa();
  const { user } = useUser();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [carga, setCarga] = useState<'cargando' | 'ok' | 'noExiste' | 'error'>('cargando');

  const cargar = useCallback(async () => {
    if (!empresa || !repo) return;
    setCarga('cargando');
    try {
      const [maquinas, reglas, pieza] = await Promise.all([
        repo.listarMaquinas(empresa.id),
        repo.leerReglas(),
        piezaId === 'nueva' ? Promise.resolve(null) : repo.obtenerPieza(empresa.id, piezaId),
      ]);
      if (piezaId !== 'nueva' && !pieza) { setCarga('noExiste'); return; }
      setDatos({ maquinas, reglas, pieza });
      setCarga('ok');
    } catch (e) {
      console.error('[costos] No se pudo cargar la pieza:', e);
      setCarga('error');
    }
  }, [empresa, repo, piezaId]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (!empresa || !repo) return null;
  if (carga === 'cargando') return <p role="status" className="text-sm text-slate-500">Cargando pieza…</p>;
  if (carga === 'noExiste') {
    return (
      <div role="alert" className="space-y-3 text-sm text-slate-600">
        <p>La pieza no existe o no tenés acceso.</p>
        <Link href="/costos" className="text-blue-700 hover:underline">← Volver al resumen de planta</Link>
      </div>
    );
  }
  if (carga === 'error' || !datos) {
    return (
      <div role="alert" className="space-y-3 text-sm text-slate-600">
        <p>No se pudo cargar la pieza.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {datos.maquinas.length === 0 && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Todavía no cargaste máquinas: cada operación necesita una. <Link href="/costos/maquinas" className="font-bold underline">Cargalas en Mis máquinas</Link>.
        </p>
      )}
      {/* key: al cambiar de empresa o de pieza se descarta todo el estado del editor */}
      <PiezaEditor key={`${empresa.id}:${piezaId}`} empresaId={empresa.id} repo={repo} inicial={datos.pieza} maquinas={datos.maquinas} reglas={datos.reglas}
        usuario={user ? { uid: user.uid, email: user.email ?? '' } : undefined} />
    </div>
  );
}
