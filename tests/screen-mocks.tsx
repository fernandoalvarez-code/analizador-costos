import { fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';

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
/**
 * El bloque SIN lo que agrega la función de máquinas en paralelo (el contenedor de sus dos campos). Con "Máquinas en
 * paralelo" vacío tiene que ser idéntico, carácter por carácter, al bloque de `main`.
 */
export function escalaComercialBase(container: HTMLElement): string {
  const clone = escalaComercialBlock(container).cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-testid="escala-maquinas-campos"], [data-testid="escala-maquinas-resultado"]').forEach((el) => el.remove());
  return clone.outerHTML;
}
/** Cambia el valor de un campo como lo haría el usuario. */
export function typeInto(el: Element | null | undefined, value: string) {
  expect(el, 'campo no encontrado').toBeTruthy();
  fireEvent.change(el!, { target: { value } });
}

const FIELD_TESTID: Record<string, string> = {
  'Hrs/Trn': 'escala-input-horas', 'Trns/Día': 'escala-input-turnos', 'Máquinas': 'escala-input-maquinas', 'Días': 'escala-input-dias',
};

/** Campo nuevo de la Escala Comercial por su nombre corto ("Hrs/Trn", "Trns/Día", "Máquinas", "Días"). */
export function fieldByUnit(container: HTMLElement, unit: string): HTMLInputElement {
  const input = container.querySelector(`[data-testid="${FIELD_TESTID[unit]}"]`);
  if (!input) throw new Error(`no se encontró el campo ${unit}`);
  return input as HTMLInputElement;
}

/** Carga el caso Toyota en la pantalla NUEVA de la curva: 10.000 pzs/mes, cambio 2 min, rendimiento 20 y 40, tiempos 2,0 y 1,375. */
export function fillToyotaPage(c: HTMLElement) {
  typeInto(c.querySelector('input[placeholder="0"]'), '10000');
  const pcs = c.querySelectorAll('input[placeholder="Ej: 120"]');
  typeInto(pcs[0], '20'); typeInto(pcs[1], '40');
  typeInto(c.querySelector('input[placeholder="Ej: 7.0"]'), '2');
  typeInto(c.querySelector('input[placeholder="Ej: 6.36"]'), '1.375');
  const cambio = [...c.querySelectorAll('label')].find((l) => l.textContent?.includes('Cambio (min)'));
  typeInto(cambio?.parentElement?.querySelector('input'), '2');
}
export { vi };
