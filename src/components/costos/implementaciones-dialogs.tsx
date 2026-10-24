"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IMPLEMENTACION_NOTA_MAX, IMPLEMENTACION_NOTA_MIN, LINEA_BASE_NOTA_MAX, type Implementacion, type MejoraCosto } from '@/lib/costos-mecanizado/types';
import { usd0, usd4 } from './formato';

const CLASE_CAMPO = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const CLASE_ETIQUETA = 'block text-sm font-bold text-slate-700 mb-1';
const CLASE_AVISO_FIJO = 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900';
export const AVISO_PUNTO_DE_PARTIDA = 'Registrá qué se cambió: queda como historial de la pieza.';
export const AVISO_REHACER_LINEA_BASE = 'Esto reinicia el acumulado de ahorro logrado: lo logrado hasta ahora se pierde como acumulado (los hitos quedan en el historial).';
export const MENSAJE_NOTA_OBLIGATORIA = `La nota es obligatoria: escribí al menos ${IMPLEMENTACION_NOTA_MIN} caracteres sobre qué se cambió.`;
export const MENSAJE_FECHA_FUTURA = 'La fecha no puede ser futura.';
export const MENSAJE_FECHA_OBLIGATORIA = 'Ingresá la fecha en que se implementó.';

const dosDigitos = (n: number) => String(n).padStart(2, '0');
/** Fecha de hoy (hora local) como YYYY-MM-DD. */
export const hoyISO = (ahora: Date = new Date()) => `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;

/** null si la fecha es válida (YYYY-MM-DD, existente y no futura); si no, el mensaje de error. */
export function errorDeFecha(fecha: string, hoy: string = hoyISO()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return MENSAJE_FECHA_OBLIGATORIA;
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) return MENSAJE_FECHA_OBLIGATORIA;
  return fecha > hoy ? MENSAJE_FECHA_FUTURA : null;
}

export interface MarcarImplementadaDialogProps {
  /** La mejora que se registra; null = diálogo cerrado. */
  mejora: MejoraCosto | null;
  onCancelar: () => void;
  onConfirmar: (mejora: MejoraCosto, fecha: string, nota: string) => void;
}

/** Diálogo para registrar una mejora como implementada: fecha (por defecto hoy, no futura) y nota obligatoria. No usa window.confirm. */
export function MarcarImplementadaDialog({ mejora, onCancelar, onConfirmar }: MarcarImplementadaDialogProps) {
  const [fecha, setFecha] = useState(() => hoyISO());
  const [nota, setNota] = useState('');
  const [intentado, setIntentado] = useState(false);
  useEffect(() => { setFecha(hoyISO()); setNota(''); setIntentado(false); }, [mejora?.clave]);

  const largo = nota.trim().length;
  const errorNota = largo < IMPLEMENTACION_NOTA_MIN || largo > IMPLEMENTACION_NOTA_MAX ? MENSAJE_NOTA_OBLIGATORIA : null;
  const errorFecha = errorDeFecha(fecha);

  const confirmar = () => {
    if (!mejora) return;
    if (errorNota || errorFecha) { setIntentado(true); return; }
    onConfirmar(mejora, fecha, nota.trim());
  };

  return (
    <Dialog open={mejora !== null} onOpenChange={(abierto) => { if (!abierto) onCancelar(); }}>
      <DialogContent data-testid="dialogo-implementada" className="bg-white">
        <DialogHeader>
          <DialogTitle>Marcar mejora como implementada</DialogTitle>
          <DialogDescription>
            {mejora ? `${mejora.categoria} · ${mejora.opNombre}: ${mejora.titulo} (≈ ${usd0(mejora.ahorroAnual)}/año estimado).` : ''}
          </DialogDescription>
        </DialogHeader>
        <p className={CLASE_AVISO_FIJO} data-testid="aviso-punto-de-partida">{AVISO_PUNTO_DE_PARTIDA}</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="implementada-fecha" className={CLASE_ETIQUETA}>Fecha en que se implementó</label>
            <input
              id="implementada-fecha" type="date" className={CLASE_CAMPO} value={fecha} max={hoyISO()}
              aria-invalid={intentado && !!errorFecha} onChange={(e) => setFecha(e.target.value)}
            />
            {intentado && errorFecha && <p role="alert" className="mt-1 text-xs font-medium text-red-600" data-testid="error-fecha">{errorFecha}</p>}
          </div>
          <div>
            <label htmlFor="implementada-nota" className={CLASE_ETIQUETA}>Qué se cambió (obligatorio)</label>
            <textarea
              id="implementada-nota" className={CLASE_CAMPO} rows={4} maxLength={IMPLEMENTACION_NOTA_MAX} value={nota}
              aria-invalid={intentado && !!errorNota} placeholder="Ej.: se subió el avance a 0,25 mm/diente con la fresa de alto avance"
              onChange={(e) => setNota(e.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              {intentado && errorNota ? <p role="alert" className="text-xs font-medium text-red-600" data-testid="error-nota">{errorNota}</p> : <span />}
              <span className="text-xs text-slate-500 tabular-nums">{largo}/{IMPLEMENTACION_NOTA_MAX}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={confirmar} data-testid="confirmar-implementada">Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface AnularImplementacionDialogProps {
  implementacion: Implementacion | null;
  onCancelar: () => void;
  onConfirmar: (id: string) => void;
}

/** Confirmación para anular el registro de una implementación (corregir un error): quita la entrada. No usa window.confirm. */
export function AnularImplementacionDialog({ implementacion, onCancelar, onConfirmar }: AnularImplementacionDialogProps) {
  return (
    <Dialog open={implementacion !== null} onOpenChange={(abierto) => { if (!abierto) onCancelar(); }}>
      <DialogContent data-testid="dialogo-anular-implementacion" className="bg-white">
        <DialogHeader>
          <DialogTitle>Anular el registro</DialogTitle>
          <DialogDescription>
            {implementacion ? `Se quita «${implementacion.titulo}» (${implementacion.opNombre}) de las mejoras realizadas. ` : ''}
            Usalo para corregir un error: el punto de partida de esa mejora se pierde y el logrado se recalcula con las que quedan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={() => implementacion && onConfirmar(implementacion.id)} data-testid="confirmar-anular-implementacion">Anular registro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface FijarLineaBaseDialogProps {
  abierto: boolean;
  /** Costo actual de la pieza (USD/pieza, sin material): queda como línea base. */
  costoActual: number;
  /** Ya hay una línea base: se está rehaciendo y hay que confirmar el reinicio del acumulado. */
  rehacer: boolean;
  onCancelar: () => void;
  onConfirmar: (nota: string) => void;
}

/** Diálogo para fijar (o rehacer) la línea base: nota opcional de hasta 500 caracteres. No usa window.confirm. */
export function FijarLineaBaseDialog({ abierto, costoActual, rehacer, onCancelar, onConfirmar }: FijarLineaBaseDialogProps) {
  const [nota, setNota] = useState('');
  useEffect(() => { if (abierto) setNota(''); }, [abierto]);
  return (
    <Dialog open={abierto} onOpenChange={(a) => { if (!a) onCancelar(); }}>
      <DialogContent data-testid="dialogo-linea-base" className="bg-white">
        <DialogHeader>
          <DialogTitle>{rehacer ? 'Rehacer línea base' : 'Fijar línea base'}</DialogTitle>
          <DialogDescription>
            El costo guardado de la pieza, {usd4(costoActual)} por pieza, queda como punto de partida del ahorro logrado. Fijala cuando la carga de la pieza esté terminada y validada.
          </DialogDescription>
        </DialogHeader>
        {rehacer && <p className={CLASE_AVISO_FIJO} data-testid="aviso-rehacer-linea-base">{AVISO_REHACER_LINEA_BASE}</p>}
        <div>
          <label htmlFor="linea-base-nota" className={CLASE_ETIQUETA}>Nota (opcional)</label>
          <textarea id="linea-base-nota" className={CLASE_CAMPO} rows={3} maxLength={LINEA_BASE_NOTA_MAX} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: carga validada con el jefe de planta" />
          <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">{nota.trim().length}/{LINEA_BASE_NOTA_MAX}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={() => onConfirmar(nota.trim())} data-testid="confirmar-linea-base">{rehacer ? 'Rehacer línea base' : 'Fijar línea base'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
