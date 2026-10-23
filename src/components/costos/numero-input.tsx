"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

const CLASE_INPUT = 'h-10 bg-white text-slate-900 font-medium tabular-nums';
const CLASE_INVALIDO = 'border-red-500';

/** Texto -> número (acepta coma decimal). Vacío o inválido -> NaN. */
export function parsearNumero(texto: string): number {
  const t = texto.trim().replace(',', '.');
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export interface NumeroInputProps {
  value: number;
  /** NaN cuando el campo está vacío o el texto no es un número (la validación lo marca y no se guarda). */
  onChange: (valor: number) => void;
  label: string;
  error?: string;
  className?: string;
  title?: string;
  placeholder?: string;
  onBlur?: () => void;
}

/** Campo numérico con texto libre mientras se escribe (admite "1," o vacío) y sin perder el foco al recalcular. */
export default function NumeroInput({ value, onChange, label, error, className = '', title, placeholder, onBlur }: NumeroInputProps) {
  const [texto, setTexto] = useState(() => (Number.isFinite(value) ? String(value) : ''));
  const enfocado = useRef(false);
  useEffect(() => {
    if (!enfocado.current) setTexto(Number.isFinite(value) ? String(value) : '');
  }, [value]);
  return (
    <Input
      type="text" inputMode="decimal" aria-label={label} title={title} placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      className={`${CLASE_INPUT} ${error ? CLASE_INVALIDO : ''} ${className}`}
      value={texto}
      onFocus={() => { enfocado.current = true; }}
      onChange={(e) => { setTexto(e.target.value); onChange(parsearNumero(e.target.value)); }}
      onBlur={() => { enfocado.current = false; setTexto(Number.isFinite(value) ? String(value) : texto); onBlur?.(); }}
    />
  );
}
