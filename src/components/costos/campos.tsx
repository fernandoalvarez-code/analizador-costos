"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import NumeroInput from './numero-input';
import TimeInput from './time-input';
import { useCampo } from './validacion-context';

export const CLASE_ETIQUETA = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1 leading-tight';
const CLASE_ERROR = 'mt-1 text-xs font-medium text-red-600';
const CLASE_AYUDA = 'mt-1 text-[10px] text-slate-400';

interface Base {
  ruta: string;
  /** Texto de la etiqueta visible. Si falta, el campo va solo (celdas de tabla) y se identifica por `nombre`. */
  etiqueta?: string;
  /** Nombre accesible del campo (por defecto, la etiqueta). */
  nombre?: string;
  ayuda?: string;
  className?: string;
}

function Envoltura({ etiqueta, ayuda, error, children, className }: { etiqueta?: string; ayuda?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      {etiqueta && <span className={CLASE_ETIQUETA}>{etiqueta}</span>}
      {children}
      {error && <p className={CLASE_ERROR} role="alert">{error}</p>}
      {ayuda && !error && <p className={CLASE_AYUDA}>{ayuda}</p>}
    </div>
  );
}

export function CampoTexto({ ruta, etiqueta, nombre, ayuda, className, value, onChange, placeholder }: Base & { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { error, tocar } = useCampo(ruta);
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <Input
        aria-label={nombre ?? etiqueta} value={value} placeholder={placeholder} aria-invalid={error ? true : undefined}
        className={`h-10 bg-white text-slate-900 font-medium ${error ? 'border-red-500' : ''}`}
        onChange={(e) => { tocar(); onChange(e.target.value); }} onBlur={tocar}
      />
    </Envoltura>
  );
}

export function CampoNumero({ ruta, etiqueta, nombre, ayuda, className, value, onChange, placeholder, title }: Base & { value: number; onChange: (v: number) => void; placeholder?: string; title?: string }) {
  const { error, tocar } = useCampo(ruta);
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <NumeroInput label={nombre ?? etiqueta ?? ruta} value={value} error={error} placeholder={placeholder} title={title} onChange={(v) => { tocar(); onChange(v); }} onBlur={tocar} />
    </Envoltura>
  );
}

export function CampoTiempo({ ruta, etiqueta, nombre, ayuda, className, value, onChange, title, disabled }: Base & { value: number; onChange: (v: number) => void; title?: string; disabled?: boolean }) {
  const { error, tocar } = useCampo(ruta);
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <TimeInput label={nombre ?? etiqueta ?? ruta} value={value} error={error} title={title} disabled={disabled} onChange={(v) => { tocar(); onChange(v); }} onBlur={tocar} />
    </Envoltura>
  );
}
