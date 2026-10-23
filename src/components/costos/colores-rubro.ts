import type { CategoriaMejora, Rubro } from '@/lib/costos-mecanizado/types';

// Colores de los 6 rubros, iguales a los del prototipo (--k-corte, --k-aux, --k-setup, --k-herr, --k-camb, --k-scrap).
// Las clases van completas y a nivel de módulo para que Tailwind las incluya.
export const HEX_RUBRO: Record<Rubro, string> = {
  corte: '#12305a', tiemposMuertos: '#4f7cc4', preparacion: '#9db8e3', herramientas: '#e3a008', cambios: '#f2d488', scrap: '#d64545',
};
export const FONDO_RUBRO: Record<Rubro, string> = {
  corte: 'bg-[#12305a]', tiemposMuertos: 'bg-[#4f7cc4]', preparacion: 'bg-[#9db8e3]', herramientas: 'bg-[#e3a008]', cambios: 'bg-[#f2d488]', scrap: 'bg-[#d64545]',
};
/** Texto legible sobre cada fondo (los claros llevan texto oscuro). */
export const TEXTO_SOBRE_RUBRO: Record<Rubro, string> = {
  corte: 'text-white', tiemposMuertos: 'text-white', preparacion: 'text-slate-800', herramientas: 'text-slate-900', cambios: 'text-slate-800', scrap: 'text-white',
};

export const ETIQUETA_CORTA_RUBRO: Record<Rubro, string> = {
  corte: 'Corte', tiemposMuertos: 'Muertos', preparacion: 'Setup', herramientas: 'Herram.', cambios: 'Cambios', scrap: 'Scrap',
};

export const FONDO_CATEGORIA: Record<CategoriaMejora, string> = {
  Productividad: 'bg-[#12305a] text-white', 'Tiempos muertos': 'bg-[#4f7cc4] text-white', Preparación: 'bg-[#9db8e3] text-slate-900',
  Herramienta: 'bg-[#e3a008] text-slate-900', Calidad: 'bg-[#d64545] text-white', Roturas: 'bg-[#d64545] text-white',
};
