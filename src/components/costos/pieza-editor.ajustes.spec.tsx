// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Diagnóstico por defecto y ajustes de la carga: opciones sin completar, aviso al salir, código repetido y edición simultánea.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };
const marca = (ms: number) => ({ toMillis: () => ms });
const carcasa = (ms = 1000): PiezaDoc => ({ ...crearCarcasa(), id: 'car-001', updatedAt: marca(ms) }) as unknown as PiezaDoc;

const montar = (inicial: PiezaDoc | null = carcasa(), opciones: { reglas?: typeof REGLAS_POR_DEFECTO; irADatos?: boolean } = {}) => {
  const c = render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={opciones.reglas ?? REGLAS_POR_DEFECTO} />);
  if (inicial && opciones.irADatos !== false) fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
  return c;
};
type C = ReturnType<typeof render>;
const estado = (c: C) => c.queryByTestId('estado-pieza')?.textContent ?? null;
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const escribir = (el: HTMLElement, valor: string) => fireEvent.change(el, { target: { value: valor } });
const abrirOp = (c: C, nombre: string) => fireEvent.click(c.getByLabelText(`Editar ${nombre}`));
const editor = (c: C) => within(c.getByTestId('operacion-editor'));
const nombrePieza = (c: C) => c.getAllByLabelText('Nombre')[0] as HTMLInputElement;
const antesDeCerrar = () => { const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent; window.dispatchEvent(e); return e.defaultPrevented; };
function diferido<T>() {
  let resolver!: (v: T) => void; let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

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

describe('Parte A: pestaña por defecto y diagnóstico en vivo', () => {
  it('una pieza ya guardada abre en "Diagnóstico"; una nueva, en "Cargar / editar datos"', () => {
    const guardada = montar(carcasa(), { irADatos: false });
    expect(guardada.getByRole('tab', { name: 'Diagnóstico' }).getAttribute('aria-selected')).toBe('true');
    expect(guardada.getByTestId('diagnostico')).toBeTruthy();
    cleanup();
    const nueva = montar(null);
    expect(nueva.getByRole('tab', { name: 'Cargar / editar datos' }).getAttribute('aria-selected')).toBe('true');
    expect(nueva.queryByTestId('diagnostico')).toBeNull();
  });
  it('el diagnóstico se recalcula con lo cargado: al subir el precio de la broca cambian los KPIs', () => {
    const c = montar(carcasa(), { irADatos: false });
    expect(c.getByTestId('kpi-mecanizado').textContent).toContain('USD 9,36');
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    abrirOp(c, 'Agujereado');
    escribir(editor(c).getAllByLabelText('Precio USD')[0], '360');
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.getByTestId('kpi-mecanizado').textContent).toContain('USD 10,38'); // 10,3822 exacto
  });
  it('una pieza nueva sin operaciones, al pasar a Diagnóstico, pide cargar una operación', () => {
    const c = montar(null);
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.getByTestId('diagnostico-vacio').textContent).toMatch(/Cargá al menos una operación/);
  });
  it('"Comparar alternativa" lleva a "Cargar / editar datos" con la operación abierta y la posición con la comparación a la vista', () => {
    const c = montar(carcasa(), { irADatos: false });
    const mejora = c.getAllByTestId('mejora').find((m) => within(m).getByTestId('categoria-mejora').textContent === 'Productividad')!;
    fireEvent.click(within(mejora).getByText('Comparar alternativa'));
    expect(c.getByRole('tab', { name: 'Cargar / editar datos' }).getAttribute('aria-selected')).toBe('true');
    expect(c.getByLabelText('Cerrar Desbaste y contorno')).toBeTruthy(); // Op20 abierta
    expect(editor(c).getAllByTestId('posicion-herramienta').length).toBeGreaterThan(0);
    expect(editor(c).getAllByTestId('comparacion')).toHaveLength(1); // la posición enfocada ya muestra la comparación
  });
  it('de una mejora de Herramienta lleva a la posición de esa herramienta (Broca Ø8,5 de Op30)', () => {
    const c = montar(carcasa(), { irADatos: false });
    fireEvent.click(c.getByText('Ver las 10 mejoras'));
    const mejora = c.getAllByTestId('mejora').find((m) => within(m).getByTestId('categoria-mejora').textContent === 'Herramienta' && m.textContent?.includes('Broca Ø8,5'))!;
    fireEvent.click(within(mejora).getByText('Comparar alternativa'));
    expect(c.getByLabelText('Cerrar Agujereado')).toBeTruthy();
    const cajas = editor(c).getAllByTestId('posicion-herramienta');
    expect(within(cajas[0]).queryByTestId('comparacion')).not.toBeNull(); // Herramienta 1 (Broca Ø8,5)
    expect(within(cajas[1]).queryByTestId('comparacion')).toBeNull();
    expect(cajas[0].id).toBe('posicion-op30-h1');
  });
  it('insignia "calculado con reglas anteriores" cuando la versión de reglas del resumen guardado no es la actual', () => {
    const vieja = carcasa();
    (vieja as unknown as { resumen: { reglasVersion: number } }).resumen = { reglasVersion: 100 };
    const c = montar(vieja, { irADatos: false, reglas: { ...REGLAS_POR_DEFECTO, reglasVersion: 200 } });
    expect(c.getByTestId('insignia-reglas')).toBeTruthy();
  });
  it('sin insignia si coinciden, y desaparece al guardar (el resumen se reescribe con las reglas actuales)', async () => {
    const vieja = carcasa();
    (vieja as unknown as { resumen: { reglasVersion: number } }).resumen = { reglasVersion: 100 };
    const c = montar(vieja, { irADatos: true, reglas: { ...REGLAS_POR_DEFECTO, reglasVersion: 200 } });
    escribir(nombrePieza(c), 'Carcasa v2');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.queryByTestId('insignia-reglas')).toBeNull();
    cleanup();
    const igual = carcasa();
    (igual as unknown as { resumen: { reglasVersion: number } }).resumen = { reglasVersion: 200 };
    expect(montar(igual, { irADatos: false, reglas: { ...REGLAS_POR_DEFECTO, reglasVersion: 200 } }).queryByTestId('insignia-reglas')).toBeNull();
  });
});

describe('Parte B a): opciones sin completar no se comparan', () => {
  const agregarOpcion = (c: C) => {
    abrirOp(c, 'Agujereado');
    fireEvent.click(within(editor(c).getAllByTestId('posicion-herramienta')[0]).getByText('+ Opción'));
    fireEvent.click(within(editor(c).getAllByTestId('posicion-herramienta')[0]).getByText('Comparar'));
  };
  it('la opción nueva se marca "Sin completar" y "Comparar" muestra "Completá los datos para comparar" (sin delta, ahorro ni precio máximo)', () => {
    const c = montar();
    agregarOpcion(c);
    const caja = within(editor(c).getAllByTestId('posicion-herramienta')[0]);
    expect(caja.getByTestId('sin-completar').textContent).toBe('Sin completar');
    expect(caja.getByTestId('completar-datos').textContent).toBe('Completá los datos para comparar');
    expect(caja.queryByTestId('delta-pieza')).toBeNull();
    expect(caja.queryByTestId('delta-anual')).toBeNull();
    expect(caja.queryByTestId('precio-maximo')).toBeNull();
    expect(caja.queryByText(/ahorra/)).toBeNull();
  });
  it('al completar nombre, precio y corte, la comparación muestra el delta real', () => {
    const c = montar();
    agregarOpcion(c);
    const caja = () => within(editor(c).getAllByTestId('posicion-herramienta')[0]);
    escribir(caja().getAllByLabelText('Nombre de la opción')[1], 'Broca económica');
    escribir(caja().getAllByLabelText('Precio USD')[1], '120');
    escribir(caja().getAllByLabelText('Corte por pieza (mm:ss)')[1], '0:27');
    expect(caja().queryByTestId('sin-completar')).toBeNull();
    expect(caja().queryByTestId('completar-datos')).toBeNull();
    expect(caja().getByTestId('delta-pieza').textContent).toMatch(/^[+−]USD \d+,\d{2}\/pza$/);
    expect(caja().getByTestId('precio-maximo')).toBeTruthy();
  });
  it('si falta uno solo de los tres datos (p. ej. el corte) sigue sin compararse', () => {
    const c = montar();
    agregarOpcion(c);
    const caja = () => within(editor(c).getAllByTestId('posicion-herramienta')[0]);
    escribir(caja().getAllByLabelText('Nombre de la opción')[1], 'Broca económica');
    escribir(caja().getAllByLabelText('Precio USD')[1], '120');
    expect(caja().getByTestId('completar-datos')).toBeTruthy(); // corte 0:00
  });
  it('si la opción EN USO está sin completar, tampoco se compara contra ella', () => {
    const c = montar(null);
    fireEvent.click(c.getByText('+ Agregar operación'));
    const caja = () => within(editor(c).getAllByTestId('posicion-herramienta')[0]);
    fireEvent.click(caja().getByText('+ Opción'));
    escribir(caja().getAllByLabelText('Nombre de la opción')[1], 'Completa');
    escribir(caja().getAllByLabelText('Precio USD')[1], '50');
    escribir(caja().getAllByLabelText('Corte por pieza (mm:ss)')[1], '1:00');
    fireEvent.click(caja().getByText('Comparar'));
    expect(caja().getAllByTestId('completar-datos')).toHaveLength(2); // la en uso (por defecto) y la completa
  });
});

describe('Parte B b): aviso al salir con cambios sin guardar', () => {
  it('"Cambios sin guardar": beforeunload se cancela y un enlace interno pide confirmación', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const c = montar();
    escribir(nombrePieza(c), 'X');
    expect(estado(c)).toBe('Cambios sin guardar');
    expect(antesDeCerrar()).toBe(true);
    const enlace = c.getByText(/Resumen de planta/).closest('a')!;
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    enlace.dispatchEvent(e);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });
  it('"Guardando…" también avisa', async () => {
    const d = diferido<undefined>();
    repo.actualizarPieza.mockReturnValue(d.promesa);
    const c = montar();
    escribir(nombrePieza(c), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('Guardando…');
    expect(antesDeCerrar()).toBe(true);
  });
  it('"Corregí los datos" avisa', async () => {
    const c = montar();
    escribir(c.getByLabelText('Piezas por año'), '0');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('Corregí los datos marcados para guardar');
    expect(antesDeCerrar()).toBe(true);
  });
  it('"No se pudo guardar." avisa', async () => {
    repo.actualizarPieza.mockRejectedValue(new Error('permission-denied'));
    const c = montar();
    escribir(nombrePieza(c), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
    expect(antesDeCerrar()).toBe(true);
  });
  it('"Guardado" y sin cambios: no avisa', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar();
    expect(antesDeCerrar()).toBe(false);
    escribir(nombrePieza(c), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('Guardado');
    expect(antesDeCerrar()).toBe(false);
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    c.getByText(/Resumen de planta/).closest('a')!.dispatchEvent(e);
    expect(confirmar).not.toHaveBeenCalled();
  });
  it('cambiar de pieza desde el buscador (router.push) también pide confirmación con cambios sin guardar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    repo.listarTodosLosResumenes.mockResolvedValue([{ id: 'otra', codigo: 'OTR-1', nombre: 'Otra', volumenAnual: 1, resumen: {} }]);
    const c = montar();
    fireEvent.focus(c.getByLabelText('Buscar pieza'));
    await avanzar(0);
    escribir(nombrePieza(c), 'X'); // cambios sin guardar
    escribir(c.getByLabelText('Buscar pieza'), 'otr');
    fireEvent.click(within(c.getByTestId('resultados-buscador')).getByText(/OTR-1/));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(within(c.getByTestId('resultados-buscador')).getByText(/OTR-1/));
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith('/costos/piezas/otra');
  });
});

describe('Parte B c): aviso si el código ya existe en la empresa', () => {
  const resumenes = [
    { id: 'car-001', codigo: 'CAR-001', nombre: 'Carcasa', volumenAnual: 1, resumen: {} },
    { id: 'bri-100', codigo: 'BRI-100', nombre: 'Brida', volumenAnual: 1, resumen: {} },
  ];
  it('avisa (sin bloquear) si el código coincide con otra pieza, ignorando mayúsculas y espacios', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(resumenes);
    const c = montar();
    escribir(c.getByLabelText('Código'), ' bri-100 ');
    await avanzar(0);
    expect(c.getByTestId('aviso-campo').textContent).toBe('⚠ Ya existe otra pieza con este código en la empresa.');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1); // no bloquea el guardado
    expect(estado(c)).toBe('Guardado');
  });
  it('no avisa con el código de la propia pieza ni con uno que no existe', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(resumenes);
    const c = montar();
    escribir(c.getByLabelText('Código'), 'CAR-001X');
    await avanzar(0);
    escribir(c.getByLabelText('Código'), 'CAR-001'); // el de esta misma pieza
    await avanzar(0);
    expect(c.queryByTestId('aviso-campo')).toBeNull();
    escribir(c.getByLabelText('Código'), 'NUEVO-9');
    expect(c.queryByTestId('aviso-campo')).toBeNull();
  });
  it('lee la lista UNA sola vez, no por cada tecla', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(resumenes);
    const c = montar();
    for (const t of ['B', 'BR', 'BRI', 'BRI-', 'BRI-1', 'BRI-10', 'BRI-100']) { escribir(c.getByLabelText('Código'), t); await avanzar(0); }
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(1);
    expect(c.getByTestId('aviso-campo')).toBeTruthy();
  });
  it('comparte la lista con el buscador: si ya se cargó al enfocarlo, editar el código no vuelve a leerla', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(resumenes);
    const c = montar();
    fireEvent.focus(c.getByLabelText('Buscar pieza'));
    await avanzar(0);
    escribir(c.getByLabelText('Código'), 'BRI-100');
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(1);
    expect(c.getByTestId('aviso-campo')).toBeTruthy();
  });
  it('en una pieza nueva avisa igual', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(resumenes);
    const c = montar(null);
    escribir(c.getByLabelText('Código'), 'CAR-001');
    await avanzar(0);
    expect(c.getByTestId('aviso-campo')).toBeTruthy();
  });
});

describe('Parte B d): edición simultánea', () => {
  it('si otro usuario modificó la pieza (updatedAt posterior al que cargó la pantalla): avisa y NO sobrescribe', async () => {
    repo.obtenerPieza.mockResolvedValue({ ...carcasa(), nombre: 'Carcasa de otro usuario', updatedAt: marca(2000) });
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'Mi cambio');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.obtenerPieza).toHaveBeenCalledWith(EMP, 'car-001');
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
    expect(estado(c)).toBe('Otro usuario modificó esta pieza');
    expect(c.getByTestId('aviso-conflicto').textContent).toContain('Otro usuario modificó esta pieza');
    expect(antesDeCerrar()).toBe(true); // lo propio sigue sin guardar
  });
  it('"Sobrescribir con mis cambios": pide confirmación y recién ahí guarda', async () => {
    repo.obtenerPieza.mockResolvedValueOnce({ ...carcasa(), updatedAt: marca(2000) }).mockResolvedValue({ ...carcasa(), updatedAt: marca(3000) });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'Mi cambio');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    fireEvent.click(c.getByText('Sobrescribir con mis cambios'));
    await avanzar(0);
    expect(repo.actualizarPieza).not.toHaveBeenCalled(); // canceló la confirmación
    fireEvent.click(c.getByText('Sobrescribir con mis cambios'));
    await avanzar(0);
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(repo.actualizarPieza.mock.calls[0][2].nombre).toBe('Mi cambio');
    expect(estado(c)).toBe('Guardado');
    expect(c.queryByTestId('aviso-conflicto')).toBeNull();
  });
  it('"Cargar la versión nueva": descarta lo propio (con confirmación) y muestra lo del otro usuario', async () => {
    repo.obtenerPieza.mockResolvedValue({ ...carcasa(), nombre: 'Carcasa de otro usuario', updatedAt: marca(2000) });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'Mi cambio');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    fireEvent.click(c.getByText('Cargar la versión nueva'));
    expect(nombrePieza(c).value).toBe('Carcasa de otro usuario');
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
    expect(c.queryByTestId('aviso-conflicto')).toBeNull();
    expect(estado(c)).toBeNull();
    expect(antesDeCerrar()).toBe(false);
  });
  it('sin cambios ajenos (misma marca de tiempo) guarda normalmente', async () => {
    repo.obtenerPieza.mockResolvedValueOnce({ ...carcasa(), updatedAt: marca(1000) }).mockResolvedValue({ ...carcasa(), updatedAt: marca(1500) });
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'Mi cambio');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(estado(c)).toBe('Guardado');
  });
  it('después de guardar, la marca propia se actualiza: el siguiente guardado no se confunde con un cambio ajeno', async () => {
    repo.obtenerPieza
      .mockResolvedValueOnce({ ...carcasa(), updatedAt: marca(1000) }) // control del 1.º guardado
      .mockResolvedValueOnce({ ...carcasa(), updatedAt: marca(1500) }) // marca nueva tras escribir
      .mockResolvedValueOnce({ ...carcasa(), updatedAt: marca(1500) }) // control del 2.º guardado: igual a la propia
      .mockResolvedValue({ ...carcasa(), updatedAt: marca(1800) });
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'A'); await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    escribir(nombrePieza(c), 'AB'); await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(2);
    expect(estado(c)).toBe('Guardado');
  });
  it('una pieza nueva no tiene con qué comparar: se crea sin lecturas de control', async () => {
    const c = montar(null);
    escribir(c.getByLabelText('Código'), 'N-1'); escribir(c.getAllByLabelText('Nombre')[0], 'Nueva');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.crearPieza).toHaveBeenCalledTimes(1);
    expect(estado(c)).toBe('Guardado');
  });
  it('si la lectura de control falla, se ve como error de guardado (no se pisa a ciegas)', async () => {
    repo.obtenerPieza.mockRejectedValue(new Error('unavailable'));
    const c = montar(carcasa(1000));
    escribir(nombrePieza(c), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
  });
});
