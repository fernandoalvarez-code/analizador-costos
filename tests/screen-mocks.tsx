import { vi } from 'vitest';

/** Polyfills de jsdom que usan Radix y Recharts en las pantallas de la curva. */
export function installDomPolyfills() {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).matchMedia = (globalThis as any).matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  (Element.prototype as any).scrollIntoView = () => {};
  (Element.prototype as any).hasPointerCapture = () => false;
}

/** Módulo 'recharts' con exportaciones explícitas (un Proxy hace que vitest lo trate como una promesa y se cuelgue). */
export function rechartsStub() {
  const Stub = ({ children }: { children?: unknown }) => (children ?? null) as never;
  const names = ['LineChart','Line','XAxis','YAxis','CartesianGrid','Tooltip','Legend','ResponsiveContainer','ReferenceDot','ReferenceLine','ReferenceArea','BarChart','Bar','AreaChart','Area','ComposedChart','Cell','Label','LabelList','PieChart','Pie','RadarChart','Radar','PolarGrid','PolarAngleAxis','PolarRadiusAxis','Scatter','ScatterChart','ZAxis'];
  return Object.fromEntries(names.map((n) => [n, Stub]));
}

/** Texto del bloque "Escala Comercial" de una pantalla ya renderizada (el <div> que contiene el título). */
export function escalaComercialBlock(container: HTMLElement): HTMLElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Escala Comercial'));
  if (!label?.parentElement) throw new Error('no se encontró el bloque Escala Comercial');
  return label.parentElement;
}
export { vi };
