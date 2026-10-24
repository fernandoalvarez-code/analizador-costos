"use client";

import React from 'react';
import Link from 'next/link';
import { useEmpresa } from './empresa-context';

const CLASE_SELECT = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const CLASE_ETIQUETA = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const CLASE_ENLACE = 'text-xs font-medium text-blue-700 hover:underline';
export const RUTA_GESTION_CLIENTES = '/settings#empresas-y-accesos';

export interface SelectorEmpresaProps {
  /** El admin ve junto al selector "Gestionar clientes" (lleva a Configuración). La sección de Configuración lo oculta: ya está ahí. */
  mostrarEnlaceGestion?: boolean;
}

/** Selector de empresa para vendedor y admin (el cliente tiene empresa fija y no ve selector). Crear empresas y gestionar accesos se hace en Configuración. */
export default function SelectorEmpresa({ mostrarEnlaceGestion = true }: SelectorEmpresaProps) {
  const { empresa, empresas, puedeElegir, puedeCrear, seleccionar } = useEmpresa();
  if (!puedeElegir) return null;

  return (
    <div className="flex flex-col gap-2 items-start md:items-end" data-testid="selector-empresa">
      {empresas.length > 0 && (
        <div>
          <label htmlFor="costos-empresa" className={CLASE_ETIQUETA}>Empresa</label>
          <select id="costos-empresa" className={CLASE_SELECT} value={empresa?.id ?? ''} onChange={(e) => seleccionar(e.target.value)}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      )}
      {puedeCrear && mostrarEnlaceGestion && <Link href={RUTA_GESTION_CLIENTES} className={CLASE_ENLACE} data-testid="enlace-gestionar-clientes">Gestionar clientes</Link>}
    </div>
  );
}
