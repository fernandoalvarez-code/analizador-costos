"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { parseMmss, toMmss } from '@/lib/costos-mecanizado/time';

const CLASE_INPUT = 'h-10 bg-white text-slate-900 font-medium tabular-nums';
const CLASE_INVALIDO = 'border-red-500';

/** ¿El texto es una hora válida? Vacío cuenta como 0; "abc" no. */
export function textoTiempoValido(texto: string): boolean {
  return texto.trim() === '' || /^\s*\d+([.,]\d+)?(:\d+([.,]\d+)?)?\s*$/.test(texto);
}

export interface TimeInputProps {
  /** Minutos (decimal). */
  value: number;
  onChange: (minutos: number) => void;
  label: string;
  /** Mensaje de error de validación del campo, si hay. */
  error?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  onBlur?: () => void;
}

/**
 * Entrada de tiempos mm:ss: "1:30" = 1 min 30 s · "0:27" = 27 s · "5" = 5 min (acepta coma decimal). Los datos están en minutos.
 * Mientras se escribe, el texto es libre y se recalcula en vivo; al salir del campo se reescribe en mm:ss.
 */
export default function TimeInput({ value, onChange, label, error, disabled, className = '', title, onBlur }: TimeInputProps) {
  const [texto, setTexto] = useState(() => toMmss(value));
  const enfocado = useRef(false);

  // Si el valor cambia desde afuera (p. ej. la vida útil recalcula el corte) y no se está escribiendo acá, se actualiza el texto.
  useEffect(() => { if (!enfocado.current) setTexto(toMmss(value)); }, [value]);

  const invalido = !textoTiempoValido(texto);
  return (
    <Input
      type="text" inputMode="numeric" placeholder="mm:ss" aria-label={label} title={title} disabled={disabled}
      aria-invalid={error || invalido ? true : undefined}
      className={`${CLASE_INPUT} ${error || invalido ? CLASE_INVALIDO : ''} ${className}`}
      value={texto}
      onFocus={() => { enfocado.current = true; }}
      onChange={(e) => { setTexto(e.target.value); onChange(parseMmss(e.target.value)); }}
      onBlur={() => { enfocado.current = false; setTexto(toMmss(value)); onBlur?.(); }}
    />
  );
}
