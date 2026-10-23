// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type OpcionHerramienta } from '@/lib/costos-mecanizado/types';
import { ALTERNATIVA_OP30, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Editor de la pieza: recálculo en vivo (sin perder el foco), guardado automático con tres estados reales, validación de mínimos,
// pieza de control CAR-001 (9,3570 USD/pza y 233.926 USD/año), cambio desde la apertura, comparación y sensibilidades.
// FRÁGIL: depende de next/navigation (useRouter) y de los nombres accesibles de los campos.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 },
  { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 },
  { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };

const carcasa = (): PiezaDoc => ({ ...crearCarcasa(), id: 'car-001' }) as PiezaDoc;
// Una pieza guardada abre en "Diagnóstico": estos tests son de la carga, así que van a "Cargar / editar datos" (el diagnóstico
// tiene su propio archivo: diagnostico-pieza.spec.tsx).
const montar = (inicial: PiezaDoc | null = carcasa()) => {
  const c = render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} />);
  if (inicial) fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
  return c;
};

type C = ReturnType<typeof render>;
const meta = (c: C) => c.getByTestId('meta-pieza').textContent ?? '';
const estado = (c: C) => c.queryByTestId('estado-pieza')?.textContent ?? null;
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const escribir = (el: HTMLElement, valor: string) => fireEvent.change(el, { target: { value: valor } });
const abrirOp = (c: C, nombre: string) => fireEvent.click(c.getByLabelText(`Editar ${nombre}`));
const editor = (c: C) => within(c.getByTestId('operacion-editor'));
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
  repo.duplicarPieza.mockResolvedValue('copia-1');
  repo.listarTodosLosResumenes.mockResolvedValue([]);
  repo.obtenerPieza.mockResolvedValue(null);
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('pieza de control CAR-001 (SPEC 4.7)', () => {
  it('la barra superior muestra 9,3570 USD/pza y 233.926 USD/año', () => {
    const c = montar();
    expect(c.getByTestId('nombre-pieza').textContent).toBe('Carcasa');
    expect(meta(c)).toContain('USD 9,3570 por pieza');
    expect(meta(c)).toContain('USD 233.926 por año');
    expect(meta(c)).toContain('25.000 piezas');
  });
  it('la ruta muestra el costo de cada operación (1,330 · 3,896 · 1,919 · 1,182 · 1,030) y la de mayor costo con el número en rojo', () => {
    const c = montar();
    const filas = c.getAllByTestId('fila-operacion');
    expect(filas.map((f) => within(f).getByTestId('usd-operacion').textContent)).toEqual(['1,330', '3,896', '1,919', '1,182', '1,030']);
    expect(filas.map((f) => within(f).getByTestId('numero-operacion').textContent)).toEqual(['Op 10', 'Op 20', 'Op 30', 'Op 40', 'Op 50']);
    expect(filas.map((f) => f.getAttribute('data-tope'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expect(within(filas[1]).getByTestId('numero-operacion').className).toContain('text-red-600');
    expect(within(filas[0]).getByTestId('numero-operacion').className).not.toContain('text-red-600');
  });
  it('muestra los datos de la pieza y el modo de producción con su línea', () => {
    const c = montar();
    expect((c.getByLabelText('Código') as HTMLInputElement).value).toBe('CAR-001');
    expect((c.getByLabelText('Piezas por año') as HTMLInputElement).value).toBe('25000');
    expect(c.getByTestId('linea-lote').textContent).toBe('= 50 preparaciones por año · lotes de 500 piezas');
  });
  it('sub-pestañas: se puede pasar de "Cargar / editar datos" a "Diagnóstico" y volver', () => {
    const c = montar();
    expect(c.getByRole('tab', { name: 'Cargar / editar datos' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.getByTestId('diagnostico')).toBeTruthy();
    expect(c.queryAllByTestId('fila-operacion')).toHaveLength(0);
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    expect(c.getAllByTestId('fila-operacion')).toHaveLength(5);
  });
  it('barra superior: buscador, Duplicar y "Resumen de planta"', () => {
    const c = montar();
    expect(c.getByLabelText('Buscar pieza')).toBeTruthy();
    expect(c.getByText('Duplicar')).toBeTruthy();
    expect(c.getByText(/Resumen de planta/).closest('a')?.getAttribute('href')).toBe('/costos');
  });
});

describe('recálculo en vivo sin perder el foco', () => {
  it('al cambiar un precio recalcula la barra superior y el MISMO campo sigue en el documento y enfocado', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    const precio = editor(c).getAllByLabelText('Precio USD')[0] as HTMLInputElement; // Broca Ø8,5: 180
    expect(precio.value).toBe('180');
    precio.focus();
    fireEvent.focus(precio);
    const antes = meta(c);
    escribir(precio, '360');
    expect(meta(c)).not.toBe(antes);
    expect(meta(c)).toContain('USD 233.926'.slice(0, 0)); // sigue mostrando el formato
    expect(editor(c).getAllByLabelText('Precio USD')[0]).toBe(precio); // no se volvió a montar
    expect(document.contains(precio)).toBe(true);
    expect(document.activeElement).toBe(precio);
    expect(precio.value).toBe('360');
  });
  it('al editar la vida útil se recalculan las piezas por filo (= vida / corte): 45:00 con corte 0:27 -> 100 piezas por filo', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    const vida = editor(c).getAllByLabelText('Vida útil por filo (mm:ss)')[0] as HTMLInputElement;
    expect(vida.value).toBe('81:00'); // 180 piezas × 0:27
    fireEvent.focus(vida);
    escribir(vida, '45:00');
    expect((editor(c).getAllByLabelText('Piezas por filo')[0] as HTMLInputElement).value).toBe('100');
  });
  it('vida útil fuera de 5–90 min: aviso "verificar el dato" (no bloquea)', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    // Broca Ø8,5: 81 min (dentro de 5–90); Broca de inserto Ø25: 950 × 0:09 = 142,5 min (fuera de rango)
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(1);
    escribir(editor(c).getAllByLabelText('Piezas por filo')[0], '250'); // 250 × 0,45 = 112,5 min
    expect(editor(c).getAllByTestId('aviso-vida')).toHaveLength(2);
    expect(editor(c).getAllByTestId('aviso-vida')[0].textContent).toMatch(/verificar el dato/);
  });
  it('el cambio de modo y de lote recalcula: lote de 100 en vez de 500 sube el costo por pieza', () => {
    const c = montar();
    escribir(c.getByLabelText('Piezas por lote'), '100');
    expect(c.getByTestId('linea-lote').textContent).toBe('= 250 preparaciones por año · lotes de 100 piezas');
    expect(meta(c)).toContain('USD 10,3435 por pieza'); // oráculo del SPEC (lote de 100)
  });
});

describe('guardado automático: tres estados reales', () => {
  it('1 s sin escribir; "Guardando…" hasta que Firestore confirma; "Guardado" SOLO al confirmar', async () => {
    const d = diferido<undefined>();
    repo.actualizarPieza.mockReturnValue(d.promesa);
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'Carcasa nueva');
    expect(estado(c)).toBe('Cambios sin guardar');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS - 1);
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
    await avanzar(1);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    const [empresa, id, pieza] = repo.actualizarPieza.mock.calls[0];
    expect([empresa, id, pieza.nombre]).toEqual([EMP, 'car-001', 'Carcasa nueva']);
    expect('resumen' in pieza).toBe(false); // el resumen lo calcula la capa de datos
    expect(estado(c)).toBe('Guardando…');
    expect(c.queryByText('Guardado')).toBeNull();
    await avanzar(5000);
    expect(estado(c)).toBe('Guardando…');
    await act(async () => { d.resolver(undefined); await vi.advanceTimersByTimeAsync(0); });
    expect(estado(c)).toBe('Guardado');
  });
  it('si no se pudo guardar: "No se pudo guardar." + "Reintentar" (nunca "Guardado")', async () => {
    repo.actualizarPieza.mockRejectedValueOnce(new Error('permission-denied'));
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
    expect(c.queryByText('Guardado')).toBeNull();
    fireEvent.click(c.getByTestId('reintentar-guardado-pieza'));
    await avanzar(0);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(2);
    expect(estado(c)).toBe('Guardado');
  });
  it('un timeout de escritura (el error de la capa de datos) también se ve como error', async () => {
    repo.actualizarPieza.mockRejectedValueOnce(new Error('No se pudo confirmar el guardado. Revisá los datos antes de reintentar, para no duplicarlos.'));
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'X');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
  });
  it('varias ediciones seguidas guardan una sola vez con lo último', async () => {
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'A'); await avanzar(400);
    escribir(c.getByLabelText('Nombre'), 'AB'); await avanzar(400);
    escribir(c.getByLabelText('Nombre'), 'ABC'); await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(repo.actualizarPieza.mock.calls[0][2].nombre).toBe('ABC');
  });
  it('si se edita mientras guarda, no queda en "Guardado" hasta guardar lo último', async () => {
    const d = diferido<undefined>();
    repo.actualizarPieza.mockReturnValueOnce(d.promesa);
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'Primera'); await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    escribir(c.getByLabelText('Nombre'), 'Segunda');
    await act(async () => { d.resolver(undefined); await vi.advanceTimersByTimeAsync(0); });
    expect(estado(c)).not.toBe('Guardado');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza.mock.calls.at(-1)?.[2].nombre).toBe('Segunda');
    expect(estado(c)).toBe('Guardado');
  });
  it('se guarda con las máquinas y las reglas cargadas (no vuelve a leerlas)', async () => {
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'X'); await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    const ctx = repo.actualizarPieza.mock.calls[0][3];
    expect(ctx.costoHora).toEqual({ T1: 30, CV1: 35, CV2: 35, CH: 45 });
    expect(ctx.reglas).toBe(REGLAS_POR_DEFECTO);
  });
});

describe('validación de mínimos (ADDENDUM punto 5): un dato inválido no se guarda', () => {
  it('piezas por año 0: mensaje visible, no se guarda y el estado pide corregir', async () => {
    const c = montar();
    escribir(c.getByLabelText('Piezas por año'), '0');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS * 2);
    expect(c.getByText('Las piezas por año deben ser un número mayor o igual a 1.')).toBeTruthy();
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
    expect(estado(c)).toBe('Corregí los datos marcados para guardar');
  });
  it('piezas por filo 0 en una herramienta: mensaje en el campo y no se guarda; al corregirlo se guarda', async () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    escribir(editor(c).getAllByLabelText('Piezas por filo')[0], '0');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS * 2);
    expect(editor(c).getByText('Las piezas por filo deben ser un número mayor o igual a 0,01.')).toBeTruthy();
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
    escribir(editor(c).getAllByLabelText('Piezas por filo')[0], '0,01');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
  });
  it('scrap fuera de 0–100, filos 0, lote 0 y nombre vacío: cada uno con su mensaje', async () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    escribir(editor(c).getByLabelText('Scrap (%)'), '150');
    escribir(editor(c).getAllByLabelText('Filos por inserto')[0], '0');
    escribir(editor(c).getAllByLabelText('Insertos por herramienta')[0], '0');
    escribir(c.getByLabelText('Piezas por lote'), '0');
    escribir(c.getAllByLabelText('Nombre')[0], ''); // el de la pieza (el de la operación es el segundo)
    expect(c.getByText('El scrap debe estar entre 0 y 100 %.')).toBeTruthy();
    expect(c.getByText('Los filos por inserto deben ser un número mayor o igual a 1.')).toBeTruthy();
    expect(c.getByText('Los insertos por herramienta deben ser un número mayor o igual a 1.')).toBeTruthy();
    expect(c.getByText('Las piezas por lote deben ser un número mayor o igual a 1.')).toBeTruthy();
    expect(c.getByText('El nombre es obligatorio.')).toBeTruthy();
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS * 2);
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
  });
  it('un campo vacío o con texto no numérico es inválido (no se guarda)', async () => {
    const c = montar();
    escribir(c.getByLabelText('Piezas por año'), 'abc');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
  });
  it('una pieza nueva no muestra errores hasta tocar los campos', () => {
    const c = montar(null);
    expect(c.queryByText('El código es obligatorio.')).toBeNull();
    fireEvent.change(c.getByLabelText('Código'), { target: { value: 'X' } });
    fireEvent.change(c.getByLabelText('Código'), { target: { value: '' } });
    expect(c.getByText('El código es obligatorio.')).toBeTruthy();
    expect(c.queryByText('El nombre es obligatorio.')).toBeNull(); // el nombre todavía no se tocó
  });
});

describe('pieza nueva: se crea en el primer guardado válido', () => {
  it('sin código y nombre no se guarda; con ambos se crea una vez y las ediciones siguientes la actualizan', async () => {
    const c = montar(null);
    expect(c.getByTestId('nombre-pieza').textContent).toBe('Nueva pieza');
    expect(meta(c)).toBe('Sin operaciones cargadas');
    escribir(c.getByLabelText('Código'), 'NUE-001');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS * 2);
    expect(repo.crearPieza).not.toHaveBeenCalled();
    expect(estado(c)).toBe('Corregí los datos marcados para guardar');
    escribir(c.getByLabelText('Nombre'), 'Nueva pieza de prueba');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.crearPieza).toHaveBeenCalledTimes(1);
    expect(repo.crearPieza.mock.calls[0][0]).toBe(EMP);
    expect(repo.crearPieza.mock.calls[0][1]).toMatchObject({ codigo: 'NUE-001', nombre: 'Nueva pieza de prueba' });
    expect(estado(c)).toBe('Guardado');
    escribir(c.getByLabelText('Piezas por año'), '2000');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.crearPieza).toHaveBeenCalledTimes(1);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(repo.actualizarPieza.mock.calls[0][1]).toBe('pieza-nueva');
  });
  it('"Duplicar" está deshabilitado hasta guardarla', async () => {
    const c = montar(null);
    expect((c.getByText('Duplicar') as HTMLButtonElement).disabled).toBe(true);
    escribir(c.getByLabelText('Código'), 'A'); escribir(c.getByLabelText('Nombre'), 'B');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect((c.getByText('Duplicar') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ruta de operaciones', () => {
  it('agregar una operación suma la fila con la primera máquina y abre su editor', () => {
    const c = montar(null);
    fireEvent.click(c.getByText('+ Agregar operación'));
    expect(c.getAllByTestId('fila-operacion')).toHaveLength(1);
    expect((editor(c).getByLabelText('Máquina') as HTMLSelectElement).value).toBe('T1');
  });
  it('eliminar una operación pide confirmación', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const c = montar();
    abrirOp(c, 'Roscado M10');
    fireEvent.click(editor(c).getByText(/Eliminar operación/));
    expect(c.getAllByTestId('fila-operacion')).toHaveLength(5);
    fireEvent.click(editor(c).getByText(/Eliminar operación/));
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(c.getAllByTestId('fila-operacion')).toHaveLength(4);
  });
  it('cambiar de máquina recalcula el costo (otra tarifa)', () => {
    const c = montar();
    const antes = meta(c);
    abrirOp(c, 'Torneado alojamiento');
    fireEvent.change(editor(c).getByLabelText('Máquina'), { target: { value: 'CH' } });
    expect(meta(c)).not.toBe(antes);
  });
});

describe('cambio desde que abriste la operación', () => {
  it('al abrir no hay cambio; al editar un precio muestra el cambio en USD/pza y USD/año; "Fijar como nueva base" lo reinicia', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    expect(editor(c).getByTestId('cambio-operacion').textContent).toMatch(/Editá tiempos, vidas o precios/);
    escribir(editor(c).getAllByLabelText('Precio USD')[0], '360'); // la broca pasa de 180 a 360: +1,00 de consumo y +1,2 % de scrap
    const txt = editor(c).getByTestId('cambio-operacion').textContent ?? '';
    expect(txt).toContain('Cambio desde que abriste la operación');
    expect(txt).toContain('+1,012 USD por pieza');
    expect(txt).toMatch(/cuesta USD [\d.]+ por año/);
    fireEvent.click(editor(c).getByText('Fijar como nueva base'));
    expect(editor(c).getByTestId('cambio-operacion').textContent).toMatch(/Editá tiempos, vidas o precios/);
  });
  it('un ahorro se muestra con signo menos y "ahorra"', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    escribir(editor(c).getAllByLabelText('Precio USD')[0], '90');
    const txt = editor(c).getByTestId('cambio-operacion').textContent ?? '';
    expect(txt).toContain('−0,506 USD por pieza');
    expect(txt).toMatch(/ahorra USD/);
  });
  it('la incidencia por herramienta muestra "Cambio al editar" contra la base', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    expect(editor(c).getAllByTestId('cambio-herramienta')[0].textContent).toBe('—');
    escribir(editor(c).getAllByLabelText('Precio USD')[0], '360');
    expect(editor(c).getAllByTestId('cambio-herramienta')[0].textContent).toMatch(/^\+1,0/);
  });
});

describe('incidencia y sensibilidades (Broca Ø8,5 de Op30)', () => {
  it('lo principal es el costo USD/pza; las participaciones y la sensibilidad al precio van en gris con "?"', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    const fila = editor(c).getAllByTestId('fila-incidencia')[0];
    expect(within(fila).getByTestId('costo-herramienta').textContent).toBe('USD 1,279'); // corte 0,2625 + consumo 1,0 + cambios 0,0162
    expect(within(fila).getByTestId('costo-herramienta').className).toContain('font-bold');
    expect(editor(c).getByTestId('ayuda-sensibilidad').getAttribute('title')).toMatch(/cuánto se nota el precio/);
    expect(fila.textContent).toMatch(/Alto/); // (consumo + cambios) / total de la operación = 53 %
  });
  it('sensibilidades con "sube" o "baja" explícito: precio +10 % sube 1,07 % · vida +10 % baja 0,99 % · corta 10 % más rápido baja 1,24 % · subir vc 10 % sube 4,79 %', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    const linea = within(editor(c).getByTestId('sensibilidades')).getAllByText(/Broca Ø8,5/)[0].closest('p')!.textContent ?? '';
    expect(linea).toContain('Precio +10 % → la pieza sube 1,07 %');
    expect(linea).toContain('Vida +10 % → la pieza baja 0,99 %');
    expect(linea).toContain('Corta 10 % más rápido con la misma vida → la pieza baja 1,24 %');
    expect(linea).toContain('Subir vc 10 % con la misma herramienta (vida −32 %, Taylor) → la pieza sube 4,79 %');
  });
});

describe('comparar opciones de una posición (compararOpciones)', () => {
  const conAlternativa = (extra?: Partial<OpcionHerramienta>): PiezaDoc => {
    const p = carcasa();
    p.operaciones[2].herramientas[0].opciones.push({ ...ALTERNATIVA_OP30, ...extra });
    return p;
  };
  it('muestra delta USD/pza (−0,671), USD/año (ahorra USD 16.771) y precio máximo (USD 542,12)', () => {
    const c = montar(conAlternativa());
    abrirOp(c, 'Agujereado');
    fireEvent.click(editor(c).getAllByText('Comparar')[0]);
    const filas = editor(c).getAllByTestId('fila-comparacion');
    expect(filas).toHaveLength(2);
    expect(within(filas[1]).getByTestId('delta-pieza').textContent).toBe('−0,671 USD/pza');
    expect(within(filas[1]).getByTestId('delta-anual').textContent).toBe('ahorra USD 16.771/año');
    expect(within(filas[1]).getByTestId('precio-maximo').textContent).toBe('USD 542,12');
    expect(filas[0].textContent).toContain('(en uso)');
  });
  it('una opción que nunca empata muestra "no empata"', () => {
    const c = montar(conAlternativa({ precio: 1, piezasPorFilo: 10, cortePorPiezaMin: 5 })); // más cara aun regalada (precio mínimo)
    abrirOp(c, 'Agujereado');
    fireEvent.click(editor(c).getAllByText('Comparar')[0]);
    expect(editor(c).getByTestId('precio-maximo').textContent).toBe('no empata');
    expect(editor(c).getByTestId('delta-pieza').textContent).toMatch(/^\+/); // cuesta más
  });
  it('con una sola opción pide cargar otra', () => {
    const c = montar();
    abrirOp(c, 'Agujereado');
    fireEvent.click(editor(c).getAllByText('Comparar')[0]);
    expect(editor(c).getByTestId('comparacion').textContent).toMatch(/Cargá otra opción/);
  });
  it('"+ Opción" suma una alternativa y "En uso" cambia cuál entra en la cuenta', () => {
    const c = montar(conAlternativa());
    abrirOp(c, 'Agujereado');
    const antes = meta(c);
    const radios = editor(c).getAllByRole('radio').filter((r) => (r as HTMLInputElement).name.startsWith('en-uso-op30-op30-h1')) as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
    fireEvent.click(radios[1]);
    expect(meta(c)).not.toBe(antes); // la alternativa es más barata
    expect(editor(c).getAllByTestId('opcion-herramienta')[1].getAttribute('data-en-uso')).toBe('true');
  });
  it('roturas: el botón despliega los tres campos', () => {
    const c = montar();
    abrirOp(c, 'Desbaste y contorno');
    fireEvent.click(editor(c).getAllByText('+ Roturas')[0]);
    const caja = within(editor(c).getByTestId('roturas-opcion'));
    expect(caja.getByLabelText('% de los cambios que son por rotura')).toBeTruthy();
    expect(caja.getByLabelText('Tiempo extra por rotura (mm:ss)')).toBeTruthy();
    expect(caja.getByLabelText('% de roturas que tiran la pieza')).toBeTruthy();
    escribir(caja.getByLabelText('% de los cambios que son por rotura'), '30');
    expect(editor(c).getAllByText('⚠ 30 %')).toHaveLength(1);
  });
});

describe('duplicar y buscador', () => {
  it('Duplicar llama a duplicarPieza y abre la copia', async () => {
    const c = montar();
    fireEvent.click(c.getByText('Duplicar'));
    await avanzar(0);
    expect(repo.duplicarPieza).toHaveBeenCalledWith(EMP, 'car-001');
    expect(push).toHaveBeenCalledWith('/costos/piezas/copia-1');
  });
  it('si no se pudo duplicar, avisa', async () => {
    repo.duplicarPieza.mockRejectedValueOnce(new Error('permission-denied'));
    const c = montar();
    fireEvent.click(c.getByText('Duplicar'));
    await avanzar(0);
    expect(c.getByRole('alert').textContent).toBe('No se pudo duplicar la pieza. Reintentá.');
    expect(push).not.toHaveBeenCalled();
  });
  it('Duplicar queda deshabilitado con cambios sin guardar', () => {
    const c = montar();
    escribir(c.getByLabelText('Nombre'), 'X');
    expect((c.getByText('Duplicar') as HTMLButtonElement).disabled).toBe(true);
  });
  it('el buscador carga los resúmenes al enfocar, filtra por código o nombre y abre la pieza elegida', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([
      { id: 'car-001', codigo: 'CAR-001', nombre: 'Carcasa', volumenAnual: 1, resumen: {} },
      { id: 'bri-100', codigo: 'BRI-100', nombre: 'Brida de acople', volumenAnual: 1, resumen: {} },
      { id: 'eje-200', codigo: 'EJE-200', nombre: 'Eje', volumenAnual: 1, resumen: {} },
    ]);
    const c = montar();
    const buscador = c.getByLabelText('Buscar pieza');
    fireEvent.focus(buscador);
    await avanzar(0);
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledWith(EMP);
    escribir(buscador, 'bri');
    const lista = within(c.getByTestId('resultados-buscador'));
    expect(lista.getAllByRole('button')).toHaveLength(1); // la pieza actual no se ofrece
    fireEvent.click(lista.getByText(/BRI-100/));
    expect(push).toHaveBeenCalledWith('/costos/piezas/bri-100');
  });
});
