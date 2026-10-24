"use client";

import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresa } from './empresa-context';
import SelectorEmpresa, { RUTA_GESTION_CLIENTES } from './selector-empresa';
import InvitacionPendiente from './invitacion-pendiente';

const CLASE_AVISO = 'rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600';

/** Encabezado del módulo y compuerta de contenido: solo se muestra el contenido con una empresa lista. */
export default function CostosMarco({ children }: { children: React.ReactNode }) {
  const { estado, mensajeError, empresa, puedeElegir, puedeCrear, modo, recargar } = useEmpresa();
  const plantas = empresa?.plantas?.length ? empresa.plantas.join(' · ') : null;

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Análisis de costos de mecanizado</h1>
          <p className="text-sm text-muted-foreground mt-1">Diagnóstico de costo por pieza y por operación · SECOCUT</p>
        </div>
        <div className="md:text-right" data-testid="costos-empresa-planta">
          {estado === 'listo' && !puedeElegir && empresa && <p className="text-sm font-bold text-slate-800">{empresa.nombre}</p>}
          {(puedeElegir || puedeCrear) && estado !== 'cargando' && estado !== 'error' && <SelectorEmpresa />}
          {estado === 'listo' && plantas && <p className="text-xs text-slate-500 mt-1">Planta: {plantas}</p>}
        </div>
      </div>

      {estado === 'cargando' && (
        <div data-testid="costos-cargando" role="status" className={`${CLASE_AVISO} flex items-center gap-2`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu empresa…
        </div>
      )}
      {estado === 'error' && (
        <div data-testid="costos-error" role="alert" className={`${CLASE_AVISO} space-y-3`}>
          <p>{mensajeError}</p>
          <Button type="button" variant="outline" size="sm" onClick={recargar}>Reintentar</Button>
        </div>
      )}
      {estado === 'sin-empresa' && <InvitacionPendiente />}
      {estado === 'sin-empresas' && (
        <div data-testid="costos-sin-empresas" role="alert" className={CLASE_AVISO}>
          {modo === 'admin'
            ? <>Todavía no hay empresas. Creá la primera en <Link href={RUTA_GESTION_CLIENTES} className="font-bold text-blue-700 hover:underline">Configuración → Empresas y accesos</Link>.</>
            : 'No tenés empresas asignadas.'}
        </div>
      )}
      {estado === 'listo' && children}
    </div>
  );
}
