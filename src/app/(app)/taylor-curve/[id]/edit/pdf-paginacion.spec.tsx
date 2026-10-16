// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASO_24000 } from '../../../../../../tests/fixtures/caso-24000';

// Paginación del PDF: el informe lleva 3 hojas (resumen, análisis gráfico y desglose técnico), nunca 4, y el bucle que
// genera el PDF captura exactamente esas 3. Se prueba con la página REAL de edición (la pantalla nueva compone igual,
// ver el último bloque). FRÁGIL: depende de los nombres que importa de '@/firebase' y de firebase/firestore.
const { stable, addImage, addPage, save, html2canvas } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), save: vi.fn(),
  html2canvas: vi.fn(async (_el: HTMLElement) => ({ toDataURL: () => 'data:image/png;base64,', width: 794, height: 1123 })),
  stable: { user: { uid: 'u1', email: 'x@secocut.com', emailVerified: true }, router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() }, saved: { id: 'caso1', caseName: 'Toyota', clientName: 'Toyota', taylorInputs: {} as Record<string, unknown> } },
}));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router, useParams: () => ({ id: 'caso1' }), usePathname: () => '/x' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/firebase', () => ({ db: {}, storage: {}, useUser: () => ({ user: stable.user, loading: false }), useMemoFirebase: (f: () => unknown) => f(), useDoc: () => ({ data: stable.saved, isLoading: false }) }));
vi.mock('firebase/firestore', () => ({ updateDoc: vi.fn(), serverTimestamp: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => false })), doc: vi.fn(() => ({})) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('jspdf', () => ({ default: class { addImage = addImage; addPage = addPage; save = save; output() { return new Blob(['pdf']); } } }));
vi.mock('html2canvas', () => ({ default: html2canvas }));
vi.mock('@/lib/client/auth-fetch', () => ({ authedFetch: vi.fn(async () => new Response('{}')) }));
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: unknown }) => (children ?? null) as never;
  const names = ['LineChart','Line','XAxis','YAxis','CartesianGrid','Tooltip','Legend','ResponsiveContainer','ReferenceDot','ReferenceLine','ReferenceArea','BarChart','Bar','AreaChart','Area','ComposedChart','Cell','Label','LabelList'];
  return Object.fromEntries(names.map((n) => [n, Stub]));
});

import EditPage from '@/app/(app)/taylor-curve/[id]/edit/page';

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).matchMedia = (globalThis as any).matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  (Element.prototype as any).scrollIntoView = () => {};
  (Element.prototype as any).hasPointerCapture = () => false;
  vi.stubGlobal('alert', vi.fn());
});
afterAll(() => cleanup());
beforeEach(() => { cleanup(); vi.clearAllMocks(); });

const open = (extra: Record<string, unknown> = {}) => {
  stable.saved.taylorInputs = { ...CASO_24000, pieceName: 'Eje', ...extra };
  return render(<EditPage />).container;
};
const page = (c: HTMLElement, n: number) => c.querySelector(`#pdf-pagina-${n}`);
const FOOTER = 'Valores sugeridos — sujetos a verificación y ajuste en máquina';

describe('el informe tiene 3 hojas', () => {
  it('existen pdf-pagina-1, -2 y -3 y NO existe pdf-pagina-4; cada una dice "Página N de 3"', () => {
    const c = open();
    for (const n of [1, 2, 3]) expect(page(c, n), `hoja ${n}`).toBeTruthy();
    expect(page(c, 4)).toBeNull();
    for (const n of [1, 2, 3]) expect(page(c, n)!.textContent).toContain(`Página ${n} de 3`);
  });

  it('la hoja 2 reúne la curva de costos y la vida del filo (antes eran dos hojas)', () => {
    const t = page(open(), 2)!.textContent!;
    expect(t).toContain('2. Curva de Costos vs. Velocidad');
    expect(t).toContain('3. Vida del Filo vs. Velocidad');
  });

  it('sin vida del filo válida (sin Vc propuesta) siguen siendo 3 hojas: la 2 lleva solo la curva de costos', () => {
    const c = open({ vcPremium: 0 });
    expect(page(c, 4)).toBeNull();
    expect(page(c, 2)!.textContent).toContain('2. Curva de Costos vs. Velocidad');
    expect(page(c, 2)!.textContent).not.toContain('3. Vida del Filo');
    expect(page(c, 2)!.textContent).toContain('Página 2 de 3');
  });

  it('marca SECOCUT, título y pie legal en las 3 hojas; la nota de IA solo en la última', () => {
    const c = open();
    for (const n of [1, 2, 3]) {
      expect(page(c, n)!.textContent, `hoja ${n}`).toContain('SECOCUT');
      expect(page(c, n)!.textContent, `hoja ${n}`).toContain(FOOTER);
    }
    expect(page(c, 3)!.textContent).toContain('asistencia de inteligencia artificial');
    expect(page(c, 1)!.textContent).not.toContain('inteligencia artificial');
    expect(page(c, 2)!.textContent).not.toContain('inteligencia artificial');
  });
});

describe('la generación del PDF captura exactamente esas 3 hojas', () => {
  async function generar(c: HTMLElement) {
    const boton = [...c.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'PDF')!;
    expect(boton, 'botón PDF').toBeTruthy();
    await act(async () => { fireEvent.click(boton); });
    await waitFor(() => expect(save).toHaveBeenCalled());
  }

  it('3 capturas (ids 1, 2 y 3 en ese orden), 3 imágenes, 2 saltos de página y un solo archivo', async () => {
    const c = open();
    await generar(c);
    expect(html2canvas).toHaveBeenCalledTimes(3);
    expect(html2canvas.mock.calls.map((call) => (call[0] as HTMLElement).id)).toEqual(['pdf-pagina-1', 'pdf-pagina-2', 'pdf-pagina-3']);
    expect(addImage).toHaveBeenCalledTimes(3);
    expect(addPage).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('también 3 sin vida del filo (antes ese caso daba 3 y con vida 4)', async () => {
    const c = open({ vcPremium: 0 });
    await generar(c);
    expect(html2canvas).toHaveBeenCalledTimes(3);
    expect(addPage).toHaveBeenCalledTimes(2);
  });
});

describe('la pantalla nueva de la curva compone el informe igual que la edición', () => {
  const src = readFileSync('src/app/(app)/taylor-curve/page.tsx', 'utf8');
  const edit = readFileSync('src/app/(app)/taylor-curve/[id]/edit/page.tsx', 'utf8');

  it.each([['pantalla nueva', src], ['edición', edit]])('%s: 3 hojas, hoja de gráficos unificada y sin las hojas viejas', (_n, code) => {
    expect(code).toMatch(/const totalPdfPages = 3;/);
    expect(code).toContain('<PdfPaginaGraficos');
    expect(code).toContain('lifeData={hasVidaFilo ? lifeChartData : null}');
    expect(code).not.toContain('pdf-pagina-4');
    expect(code).not.toContain('PdfPaginaVidaFilo');
    expect(code).not.toContain('PdfPaginaCurvaCostos');
    expect(code).not.toContain('hasPage3');
  });

  it('la pantalla nueva captura las hojas 1, 2 y 3 y ninguna otra', () => {
    const ids = [...src.matchAll(/getElementById\('(pdf-pagina-\d)'\)/g)].map((m) => m[1]);
    expect(ids).toEqual(['pdf-pagina-1', 'pdf-pagina-2', 'pdf-pagina-3']);
  });
});
