// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import { opcionNueva } from '@/components/costos/validar-pieza';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type Pieza } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Casilla "Dato verificado" de la vida útil por filo. En la operación Agujereado de CAR-001 hay dos herramientas:
//   Broca Ø8,5:          180 piezas × 0,45 min = 81 min     (dentro de 5–90: sin aviso)
//   Broca inserto Ø25:   950 piezas × 0,15 min = 142,5 min  (fuera de rango: aviso)
// FRÁGIL: depende de las etiquetas de los campos de posicion-herramienta-table.tsx.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };

const carcasa = (ajustar?: (p: Pieza) => void): PiezaDoc => {
  const p = crearCarcasa();
  ajustar?.(p);
  return { ...p, id: 'car-001' } as PiezaDoc;
};
const opcionInserto = (p: Pieza) => p.operaciones.find((o) => o.id === 'op30')!.herramientas[1].opciones[0];

const montar = (inicial: PiezaDoc = carcasa()) => {
  const c = render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} />);
  fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
  fireEvent.click(c.getByLabelText('Editar Agujereado'));
  return c;
};
type C = ReturnType<typeof render>;
const editor = (c: C) => within(c.getByTestId('operacion-editor'));
const meta = (c: C) => c.getByTestId('meta-pieza').textContent ?? '';
const escribir = (el: HTMLElement, valor: string) => fireEvent.change(el, { target: { value: valor } });
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const casillas = (c: C) => editor(c).queryAllByLabelText('Dato verificado') as HTMLInputElement[];
const piezasPorFilo = (c: C, i: number) => editor(c).getAllByLabelText('Piezas por filo')[i];
/** La opción de la Broca inserto Ø25 en el último guardado. */
const guardadaInserto = () => opcionInserto(repo.actualizarPieza.mock.calls.at(-1)![2] as Pieza);

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(repo).forEach((f) => f.mockReset());
  repo.actualizarPieza.mockResolvedValue(undefined);
  repo.crearPieza.mockResolvedValue('pieza-nueva');
  repo.listarTodosLosResumenes.mockResolvedValue([]);
  repo.obtenerPieza.mockResolvedValue(null);
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('casilla "Dato verificado"', () => {
  it('con 142,5 min hay aviso y casilla (desmarcada); con 81 min no hay ni aviso ni casilla', () => {
    const c = montar();
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
    expect(casillas(c)).toHaveLength(1);
    expect(casillas(c)[0].checked).toBe(false);
    expect(editor(c).queryByTestId('vida-verificada')).toBeNull();
    // la casilla es de la segunda herramienta, no de la Broca Ø8,5
    const filaInserto = editor(c).getAllByTestId('opcion-herramienta')[1];
    expect(within(filaInserto).getByLabelText('Dato verificado')).toBe(casillas(c)[0]);
    expect(casillas(c)[0].closest('label')?.getAttribute('title')).toBe('Confirmo que la vida útil por filo es la medida en planta');
  });

  it('marcarla oculta el aviso, muestra "Verificado" y se guarda en la opción (vidaVerificada: true)', async () => {
    const c = montar();
    fireEvent.click(casillas(c)[0]);
    expect(editor(c).queryByTestId('aviso-vida')).toBeNull();
    expect(editor(c).getByTestId('vida-verificada').textContent).toBe('Verificado');
    expect(casillas(c)[0].checked).toBe(true);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(guardadaInserto().vidaVerificada).toBe(true);
  });

  it('desmarcarla vuelve el aviso y quita el campo guardado', async () => {
    const c = montar(carcasa((p) => { opcionInserto(p).vidaVerificada = true; }));
    expect(editor(c).queryByTestId('aviso-vida')).toBeNull();
    fireEvent.click(casillas(c)[0]);
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect('vidaVerificada' in guardadaInserto()).toBe(false);
  });

  it('cambiar las piezas por filo borra la marca: vuelve el aviso, la casilla queda desmarcada y se guarda sin el campo', async () => {
    const c = montar();
    fireEvent.click(casillas(c)[0]);
    escribir(piezasPorFilo(c, 1), '1000'); // 1000 × 0,15 = 150 min: sigue fuera de rango
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
    expect(casillas(c)[0].checked).toBe(false);
    expect(editor(c).queryByTestId('vida-verificada')).toBeNull();
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect('vidaVerificada' in guardadaInserto()).toBe(false);
    expect(guardadaInserto().piezasPorFilo).toBe(1000);
  });

  it('cambiar el corte por pieza o la vida útil (que recalcula piezas por filo) también la borra', () => {
    const c = montar();
    fireEvent.click(casillas(c)[0]);
    const corte = editor(c).getAllByLabelText('Corte por pieza (mm:ss)')[1] as HTMLInputElement;
    fireEvent.focus(corte);
    escribir(corte, '0:12'); // 950 × 0,2 = 190 min
    expect(casillas(c)[0].checked).toBe(false);
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
    fireEvent.click(casillas(c)[0]);
    const vida = editor(c).getAllByLabelText('Vida útil por filo (mm:ss)')[1] as HTMLInputElement;
    fireEvent.focus(vida);
    escribir(vida, '200:00'); // piezas por filo = 200 / 0,2 = 1000
    expect(casillas(c)[0].checked).toBe(false);
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
  });

  it('cambiar otros campos (precio, nombre, cambio, roturas) NO la borra', async () => {
    const c = montar();
    fireEvent.click(casillas(c)[0]);
    escribir(editor(c).getAllByLabelText('Precio USD')[1], '30');
    escribir(editor(c).getAllByLabelText('Nombre de la opción')[1], 'Broca inserto Ø25 v2');
    const cambio = editor(c).getAllByLabelText('Cambio (mm:ss)')[1] as HTMLInputElement;
    fireEvent.focus(cambio);
    escribir(cambio, '6:00');
    fireEvent.click(editor(c).getAllByText('+ Roturas')[1]);
    escribir(editor(c).getByLabelText('% de los cambios que son por rotura'), '10');
    expect(casillas(c)[0].checked).toBe(true);
    expect(editor(c).queryByTestId('aviso-vida')).toBeNull();
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(guardadaInserto()).toMatchObject({ precio: 30, nombre: 'Broca inserto Ø25 v2', vidaVerificada: true });
  });

  it('con 30 min (200 piezas × 0,15) no hay ni aviso ni casilla; una marca ya guardada se conserva sin mostrar nada', async () => {
    const c = montar(carcasa((p) => { const o = opcionInserto(p); o.piezasPorFilo = 200; o.vidaVerificada = true; }));
    expect(editor(c).queryAllByTestId('aviso-vida')).toHaveLength(0);
    expect(casillas(c)).toHaveLength(0);
    expect(editor(c).queryByTestId('vida-verificada')).toBeNull();
    // al guardar por otro cambio, la marca sigue en la opción
    escribir(editor(c).getAllByLabelText('Precio USD')[1], '26');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(guardadaInserto()).toMatchObject({ precio: 26, piezasPorFilo: 200, vidaVerificada: true });
  });

  it('"+ Opción" arranca sin marca (la nueva opción no trae el campo)', async () => {
    const c = montar(carcasa((p) => { opcionInserto(p).vidaVerificada = true; }));
    fireEvent.click(editor(c).getAllByText('+ Opción')[1]);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    const guardada = repo.actualizarPieza.mock.calls.at(-1)![2] as Pieza;
    const opciones = guardada.operaciones.find((o) => o.id === 'op30')!.herramientas[1].opciones;
    expect(opciones).toHaveLength(2);
    expect(opciones[0].vidaVerificada).toBe(true);
    expect('vidaVerificada' in opciones[1]).toBe(false);
    expect('vidaVerificada' in opcionNueva()).toBe(false);
  });

  it('los oráculos de CAR-001 no cambian: 9,3570 USD/pza y 233.926 USD/año, antes y después de marcar la casilla', () => {
    const c = montar();
    expect(meta(c)).toContain('USD 9,36 por pieza'); // 9,3570 exacto
    expect(meta(c)).toContain('USD 233.926 por año');
    fireEvent.click(casillas(c)[0]);
    expect(meta(c)).toContain('USD 9,36 por pieza'); // 9,3570 exacto
    expect(meta(c)).toContain('USD 233.926 por año');
  });
});
