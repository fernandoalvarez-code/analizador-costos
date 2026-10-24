// Mejoras priorizadas (SPEC sección 6 + ADDENDUM puntos 3 y 7). Las reglas usan ">" ESTRICTO: un valor exacto en el umbral no dispara.
import type { CategoriaMejora, MejoraCosto, MejoraDescartada, Pieza, ReglasCostos, ResultadoOperacion, ResultadoPieza } from './types';
import { REGLAS_POR_DEFECTO } from './types';

// Costo POR PIEZA con 4 decimales (la misma regla que el resto del módulo); solo al mostrar, nunca en el cálculo.
const usd = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pc = (ratio: number) => `${Math.round(ratio * 100)} %`;
const AVISO_SUPUESTOS = 'Supuestos conservadores, a confirmar con ensayo en planta.';

interface Candidata {
  categoria: CategoriaMejora;
  op: ResultadoOperacion;
  posicionId?: string;
  titulo: string;
  explicacion: string;
  supuesto: string;
  ahorroPorPieza: number;
  puedeComparar: boolean;
}

/** Clave estable de una mejora: usa ids (de la operación y de la posición de herramienta), no posiciones en la lista. */
export const claveMejora = (categoria: CategoriaMejora, opId: string, posicionId?: string): string => `${categoria}|${opId}|${posicionId ?? ''}`;

/** Mejoras de una pieza ya calculada, ordenadas por ahorro anual (de mayor a menor): las ACTIVAS, sin las descartadas con motivo. */
export function mejoras(resultado: ResultadoPieza, pieza: Pick<Pieza, 'operaciones' | 'mejorasDescartadas'>, reglas: ReglasCostos = REGLAS_POR_DEFECTO): MejoraCosto[] {
  const descartadas = pieza.mejorasDescartadas ?? {};
  return todasLasMejoras(resultado, reglas).filter((m) => !Object.prototype.hasOwnProperty.call(descartadas, m.clave));
}

/** Una mejora descartada de la pieza, para mostrarla en el registro. `vigente`: con los datos actuales la mejora todavía se dispararía. */
export interface MejoraDescartadaVista {
  clave: string;
  categoria: CategoriaMejora;
  opId: string;
  /** Nombre actual de la operación; '' si ya no existe. */
  opNombre: string;
  posicionId?: string;
  descarte: MejoraDescartada;
  vigente: boolean;
  /** La mejora tal como se calcularía hoy (solo si es vigente). */
  mejora: MejoraCosto | null;
}

/** Las mejoras descartadas que siguen guardadas en la pieza (aunque ya no se dispararían), de la más cara a la más barata al descartar. */
export function mejorasDescartadas(resultado: ResultadoPieza, pieza: Pick<Pieza, 'operaciones' | 'mejorasDescartadas'>, reglas: ReglasCostos = REGLAS_POR_DEFECTO): MejoraDescartadaVista[] {
  const guardadas = pieza.mejorasDescartadas ?? {};
  const vigentes = new Map(todasLasMejoras(resultado, reglas).map((m) => [m.clave, m]));
  return Object.entries(guardadas)
    .map(([clave, descarte]): MejoraDescartadaVista => {
      const [categoria, opId = '', posicionId = ''] = clave.split('|');
      const mejora = vigentes.get(clave) ?? null;
      return {
        clave, categoria: categoria as CategoriaMejora, opId, opNombre: pieza.operaciones.find((o) => o.id === opId)?.nombre ?? '',
        posicionId: posicionId || undefined, descarte, vigente: mejora !== null, mejora,
      };
    })
    .sort((a, b) => b.descarte.ahorroAnualAlDescartar - a.descarte.ahorroAnualAlDescartar || a.clave.localeCompare(b.clave));
}

/** TODAS las mejoras que dispara la pieza con las reglas dadas (activas y descartadas), ordenadas por ahorro anual. */
function todasLasMejoras(resultado: ResultadoPieza, reglas: ReglasCostos): MejoraCosto[] {
  const candidatas: Candidata[] = [];

  for (const op of resultado.operaciones) {
    const t = op.totalOp;
    if (!(t > 0)) continue;

    // Productividad: corte / totalOp > umbral
    if (op.corte / t > reglas.productividad.umbralPct / 100) {
      candidatas.push({
        categoria: 'Productividad', op, titulo: 'El tiempo de corte domina la operación',
        explicacion: `Representa el ${pc(op.corte / t)} del costo de la operación. Una herramienta de mayor rendimiento o mejores parámetros bajan el tiempo.`,
        supuesto: `Supuesto: −${reglas.productividad.ahorroPct} % del tiempo de corte`,
        ahorroPorPieza: (op.corte * reglas.productividad.ahorroPct) / 100, puedeComparar: true,
      });
    }

    // Tiempos muertos: muertos > 60 % del corte (en minutos) Y aux > 0,05 USD/pza
    if (op.tiemposMuertosMin > (reglas.tiemposMuertos.umbralMuertosSobreCortePct / 100) * op.corteMin && op.tiemposMuertos > reglas.tiemposMuertos.umbralAuxUsd) {
      candidatas.push({
        categoria: 'Tiempos muertos', op, titulo: 'Mucho tiempo fuera de corte',
        explicacion: `${op.tiemposMuertosMin} min por pieza sin cortar contra ${op.corteMin} min de corte. Revisar sujeción, carga y descarga, y recorridos en vacío.`,
        supuesto: `Supuesto: −${reglas.tiemposMuertos.ahorroPct} % de tiempos muertos`,
        ahorroPorPieza: (op.tiemposMuertos * reglas.tiemposMuertos.ahorroPct) / 100, puedeComparar: false,
      });
    }

    // Preparación: setup / totalOp > umbral
    if (op.preparacion / t > reglas.preparacion.umbralPct / 100) {
      candidatas.push({
        categoria: 'Preparación', op, titulo: 'Preparación pesada para el tamaño de lote',
        explicacion: `La preparación es el ${pc(op.preparacion / t)} del costo con lotes de ${Math.round(resultado.loteEfectivo)} piezas. Preset de herramientas fuera de máquina o fijación rápida.`,
        supuesto: `Supuesto: −${reglas.preparacion.ahorroPct} % de la preparación`,
        ahorroPorPieza: (op.preparacion * reglas.preparacion.ahorroPct) / 100, puedeComparar: false,
      });
    }

    for (const h of op.herramientasDetalle) {
      // Roturas: (parada extra + piezas perdidas por rotura) de la herramienta / totalOp > umbral
      const costoRoturas = h.rotTiempo + h.scrapRot;
      if (costoRoturas / t > reglas.roturas.umbralPct / 100) {
        candidatas.push({
          categoria: 'Roturas', op, posicionId: h.posicionId, titulo: `${h.nombre} se rompe seguido`,
          explicacion: `Las roturas cuestan USD ${usd(costoRoturas)} por pieza entre parada extra y piezas perdidas (${pc(costoRoturas / t)} de la operación). Revisar estabilidad, runout, parámetros y evacuación de viruta.`,
          supuesto: `Supuesto: −${reglas.roturas.ahorroPct} % de las roturas`,
          ahorroPorPieza: (costoRoturas * reglas.roturas.ahorroPct) / 100, puedeComparar: true,
        });
      }
      // Herramienta (por herramienta): (consumo + cambios de ESA herramienta) / totalOp > umbral
      const herrMasCambios = h.consumo + h.cambios;
      if (herrMasCambios / t > reglas.herramienta.umbralPct / 100) {
        candidatas.push({
          categoria: 'Herramienta', op, posicionId: h.posicionId, titulo: `${h.nombre} pesa mucho`,
          explicacion: `Herramienta más cambios = ${pc(herrMasCambios / t)} de la operación (USD ${usd(herrMasCambios)} por pieza). Revisar vida, roturas y alternativas.`,
          supuesto: `Supuesto: −${reglas.herramienta.ahorroPct} % del costo de herramienta`,
          ahorroPorPieza: (herrMasCambios * reglas.herramienta.ahorroPct) / 100, puedeComparar: true,
        });
      }
    }

    // Calidad: scrap / totalOp > umbral
    if (op.scrap / t > reglas.calidad.umbralPct / 100) {
      candidatas.push({
        categoria: 'Calidad', op, titulo: 'El scrap es caro en este punto',
        explicacion: `El scrap es el ${pc(op.scrap / t)} de la operación, con todo el valor acumulado hasta acá (USD ${usd(op.scrap)} por pieza). Buscar la causa: rotura de herramienta, medida o sujeción.`,
        supuesto: `Supuesto: −${reglas.calidad.ahorroPct} % del scrap`,
        ahorroPorPieza: (op.scrap * reglas.calidad.ahorroPct) / 100, puedeComparar: false,
      });
    }
  }

  return candidatas
    .map((c): MejoraCosto => ({
      clave: claveMejora(c.categoria, c.op.opId, c.posicionId), categoria: c.categoria, opId: c.op.opId, opNombre: c.op.nombre, posicionId: c.posicionId, titulo: c.titulo,
      explicacion: c.explicacion, supuesto: `${c.supuesto}. ${AVISO_SUPUESTOS}`,
      ahorroPorPieza: c.ahorroPorPieza, ahorroAnual: c.ahorroPorPieza * resultado.volumenAnual, puedeComparar: c.puedeComparar,
    }))
    .sort((a, b) => b.ahorroAnual - a.ahorroAnual);
}
