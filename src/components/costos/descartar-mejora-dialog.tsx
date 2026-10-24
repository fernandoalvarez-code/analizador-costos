"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ETIQUETA_MOTIVO_DESCARTE, MOTIVO_DESCARTE_MAX, MOTIVO_DESCARTE_MIN, type MejoraCosto, type MotivoDescarteTipo,
} from '@/lib/costos-mecanizado/types';
import { usd0 } from './formato';

const CLASE_CAMPO = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const CLASE_ETIQUETA = 'block text-sm font-bold text-slate-700 mb-1';
const TIPOS = Object.keys(ETIQUETA_MOTIVO_DESCARTE) as MotivoDescarteTipo[];
export const MENSAJE_MOTIVO_OBLIGATORIO = `El motivo es obligatorio: escribí al menos ${MOTIVO_DESCARTE_MIN} caracteres.`;

export interface DescartarMejoraDialogProps {
  /** La mejora a descartar; null = diálogo cerrado. */
  mejora: MejoraCosto | null;
  onCancelar: () => void;
  onConfirmar: (mejora: MejoraCosto, tipo: MotivoDescarteTipo, motivo: string) => void;
}

/** Diálogo para descartar una mejora: tipo de motivo (lista) y texto del motivo obligatorio. No usa window.confirm. */
export default function DescartarMejoraDialog({ mejora, onCancelar, onConfirmar }: DescartarMejoraDialogProps) {
  const [tipo, setTipo] = useState<MotivoDescarteTipo>('ya-probado');
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);

  // Cada vez que se abre para otra mejora arranca limpio
  useEffect(() => { setTipo('ya-probado'); setMotivo(''); setIntentado(false); }, [mejora?.clave]);

  const largo = motivo.trim().length;
  const invalido = largo < MOTIVO_DESCARTE_MIN || largo > MOTIVO_DESCARTE_MAX;

  const confirmar = () => {
    if (!mejora) return;
    if (invalido) { setIntentado(true); return; }
    onConfirmar(mejora, tipo, motivo.trim());
  };

  return (
    <Dialog open={mejora !== null} onOpenChange={(abierto) => { if (!abierto) onCancelar(); }}>
      <DialogContent data-testid="dialogo-descartar" className="bg-white">
        <DialogHeader>
          <DialogTitle>Descartar mejora</DialogTitle>
          <DialogDescription>
            {mejora ? `${mejora.categoria} · ${mejora.opNombre}: ${mejora.titulo} (≈ ${usd0(mejora.ahorroAnual)}/año). ` : ''}
            Deja de sugerirse y no suma al ahorro potencial. El motivo queda registrado en la pieza y podés reactivarla cuando quieras.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="descarte-tipo" className={CLASE_ETIQUETA}>Tipo de motivo</label>
            <select id="descarte-tipo" className={CLASE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value as MotivoDescarteTipo)}>
              {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_MOTIVO_DESCARTE[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="descarte-motivo" className={CLASE_ETIQUETA}>Motivo (obligatorio)</label>
            <textarea
              id="descarte-motivo" className={CLASE_CAMPO} rows={4} maxLength={MOTIVO_DESCARTE_MAX} value={motivo}
              aria-invalid={intentado && invalido} aria-describedby={intentado && invalido ? 'descarte-error' : undefined}
              placeholder="Ej.: la máquina no admite más avance por la rigidez del husillo"
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              {intentado && invalido
                ? <p id="descarte-error" role="alert" className="text-xs font-medium text-red-600" data-testid="error-motivo">{MENSAJE_MOTIVO_OBLIGATORIO}</p>
                : <span />}
              <span className="text-xs text-slate-500 tabular-nums">{largo}/{MOTIVO_DESCARTE_MAX}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={confirmar} data-testid="confirmar-descarte">Descartar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
