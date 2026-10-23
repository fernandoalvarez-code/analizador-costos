// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MaquinasTabla, { DEBOUNCE_GUARDADO_MS, parsearCostoHora, textoRecalculo, validarFila } from '@/components/costos/maquinas-tabla';
import { MaquinaEnUsoError } from '@/lib/costos-mecanizado/firestore';

// Tabla de máquinas: guardado con TRES estados reales ("Guardando…", "Guardado" solo con la confirmación de Firestore, y
// "No se pudo guardar. Reintentar"), validación visible, recálculo de piezas y eliminación con confirmación.
const EMP = 'emp-a';
const maquina = (id: string, nombre: string, costoHora: number) => ({ id, nombre, costoHora });

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

const repo = {
  listarMaquinas: vi.fn(), crearMaquina: vi.fn(), actualizarMaquina: vi.fn(), eliminarMaquina: vi.fn(), recalcularResumenesPorMaquina: vi.fn(),
};

async function montar() {
  const c = render(<MaquinasTabla empresaId={EMP} repo={repo} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // la carga inicial
  return c;
}
const filas = (c: ReturnType<typeof render>) => c.queryAllByTestId('fila-maquina');
const nombre = (c: ReturnType<typeof render>, i = 0) => c.getAllByLabelText('Nombre de la máquina')[i] as HTMLInputElement;
const costo = (c: ReturnType<typeof render>, i = 0) => c.getAllByLabelText('Costo hora en USD por hora')[i] as HTMLInputElement;
const estado = (c: ReturnType<typeof render>, i = 0) => filas(c)[i].querySelector('[data-testid="estado-fila"]')?.textContent ?? null;
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const escribir = (el: HTMLInputElement, valor: string) => fireEvent.change(el, { target: { value: valor } });

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(repo).forEach((f) => f.mockReset());
  repo.listarMaquinas.mockResolvedValue([maquina('m1', 'Torno CNC 1', 30), maquina('m2', 'Centro vertical 1', 35)]);
  repo.actualizarMaquina.mockResolvedValue({ recalculo: null });
  repo.crearMaquina.mockResolvedValue('m-nueva');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('lista', () => {
  it('muestra las máquinas de la empresa con su nombre y costo hora, sin estado de guardado', async () => {
    const c = await montar();
    expect(repo.listarMaquinas).toHaveBeenCalledWith(EMP);
    expect(filas(c)).toHaveLength(2);
    expect(nombre(c, 0).value).toBe('Torno CNC 1');
    expect(costo(c, 1).value).toBe('35');
    expect(estado(c, 0)).toBeNull();
  });
  it('sin máquinas: invita a agregar la primera', async () => {
    repo.listarMaquinas.mockResolvedValue([]);
    const c = await montar();
    expect(c.getByText(/Todavía no cargaste máquinas/)).toBeTruthy();
  });
  it('mientras carga: estado de carga; si falla la lectura: aviso y "Reintentar"', async () => {
    repo.listarMaquinas.mockRejectedValueOnce(new Error('permission-denied'));
    const c = await montar();
    expect(c.getByRole('alert').textContent).toMatch(/No se pudieron leer las máquinas/);
    fireEvent.click(c.getByText('Reintentar'));
    await avanzar(0);
    expect(filas(c)).toHaveLength(2);
  });
});

describe('guardado: tres estados reales', () => {
  it('espera 1 s sin escribir; "Guardando…" mientras Firestore no confirma; "Guardado" SOLO al confirmar', async () => {
    const d = diferido<{ recalculo: null }>();
    repo.actualizarMaquina.mockReturnValue(d.promesa);
    const c = await montar();
    escribir(nombre(c), 'Torno CNC 1 (nuevo)');
    expect(estado(c)).toBe('Cambios sin guardar');
    await avanzar(DEBOUNCE_GUARDADO_MS - 1);
    expect(repo.actualizarMaquina).not.toHaveBeenCalled();
    await avanzar(1);
    expect(repo.actualizarMaquina).toHaveBeenCalledWith(EMP, 'm1', { nombre: 'Torno CNC 1 (nuevo)', costoHora: 30 });
    expect(estado(c)).toBe('Guardando…');
    expect(c.queryByText('Guardado')).toBeNull(); // nunca "Guardado" antes de la confirmación
    await avanzar(5000);
    expect(estado(c)).toBe('Guardando…');
    await act(async () => { d.resolver({ recalculo: null }); await vi.advanceTimersByTimeAsync(0); });
    expect(estado(c)).toBe('Guardado');
  });
  it('si no se pudo guardar: "No se pudo guardar." + "Reintentar" (nunca "Guardado")', async () => {
    repo.actualizarMaquina.mockRejectedValueOnce(new Error('permission-denied'));
    const c = await montar();
    escribir(costo(c), '40');
    await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
    expect(c.queryByText('Guardado')).toBeNull();
    fireEvent.click(c.getByTestId('reintentar-guardado'));
    await avanzar(0);
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(2);
    expect(estado(c)).toBe('Guardado');
  });
  it('el error de "no se confirmó a tiempo" también se ve como error', async () => {
    repo.actualizarMaquina.mockRejectedValueOnce(new Error('No se pudo confirmar el guardado. Revisá los datos antes de reintentar, para no duplicarlos.'));
    const c = await montar();
    escribir(nombre(c), 'X');
    await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(estado(c)).toBe('No se pudo guardar.');
  });
  it('al salir del campo guarda sin esperar el segundo', async () => {
    const c = await montar();
    escribir(nombre(c), 'Nombre nuevo');
    fireEvent.blur(nombre(c));
    await avanzar(0);
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(1);
    expect(estado(c)).toBe('Guardado');
    await avanzar(DEBOUNCE_GUARDADO_MS * 2);
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(1); // el temporizador no vuelve a guardar
  });
  it('varias ediciones seguidas guardan una sola vez, con el último valor', async () => {
    const c = await montar();
    escribir(nombre(c), 'A'); await avanzar(400);
    escribir(nombre(c), 'AB'); await avanzar(400);
    escribir(nombre(c), 'ABC'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(1);
    expect(repo.actualizarMaquina).toHaveBeenCalledWith(EMP, 'm1', { nombre: 'ABC', costoHora: 30 });
  });
  it('si se edita mientras guarda, no queda en "Guardado" hasta guardar lo último', async () => {
    const d = diferido<{ recalculo: null }>();
    repo.actualizarMaquina.mockReturnValueOnce(d.promesa);
    const c = await montar();
    escribir(nombre(c), 'Primera'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(estado(c)).toBe('Guardando…');
    escribir(nombre(c), 'Segunda');
    await act(async () => { d.resolver({ recalculo: null }); await vi.advanceTimersByTimeAsync(0); });
    expect(estado(c)).not.toBe('Guardado'); // lo último todavía no se guardó
    await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.actualizarMaquina).toHaveBeenLastCalledWith(EMP, 'm1', { nombre: 'Segunda', costoHora: 30 });
    expect(estado(c)).toBe('Guardado');
  });
  it('si el temporizador vence mientras todavía guarda, vuelve a guardar apenas confirma el anterior', async () => {
    const d = diferido<{ recalculo: null }>();
    repo.actualizarMaquina.mockReturnValueOnce(d.promesa);
    const c = await montar();
    escribir(nombre(c), 'Primera'); await avanzar(DEBOUNCE_GUARDADO_MS);
    escribir(nombre(c), 'Segunda'); await avanzar(DEBOUNCE_GUARDADO_MS * 3); // vence con el primer guardado sin confirmar
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolver({ recalculo: null }); await vi.advanceTimersByTimeAsync(0); });
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(2);
    expect(repo.actualizarMaquina).toHaveBeenLastCalledWith(EMP, 'm1', { nombre: 'Segunda', costoHora: 30 });
    expect(estado(c)).toBe('Guardado');
  });
  it('acepta coma decimal en el costo hora', async () => {
    const c = await montar();
    escribir(costo(c), '42,5'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.actualizarMaquina).toHaveBeenCalledWith(EMP, 'm1', { nombre: 'Torno CNC 1', costoHora: 42.5 });
  });
});

describe('validación visible (ADDENDUM punto 5)', () => {
  it('nombre obligatorio: mensaje visible y NO se guarda', async () => {
    const c = await montar();
    escribir(nombre(c), '   '); await avanzar(DEBOUNCE_GUARDADO_MS * 2);
    expect(c.getByTestId('error-nombre').textContent).toBe('El nombre es obligatorio.');
    expect(repo.actualizarMaquina).not.toHaveBeenCalled();
    expect(estado(c)).toBe('Corregí los datos para guardar');
  });
  it.each([['-5'], ['abc'], [''], ['1,2,3'], ['12abc'], ['-0,01']])('costo hora "%s": mensaje visible y NO se guarda', async (valor) => {
    const c = await montar();
    escribir(costo(c), valor); await avanzar(DEBOUNCE_GUARDADO_MS * 2);
    expect(c.getByTestId('error-costo-hora').textContent).toBe('El costo hora debe ser un número mayor o igual a 0.');
    expect(repo.actualizarMaquina).not.toHaveBeenCalled();
  });
  it('costo hora 0 es válido (≥ 0)', async () => {
    const c = await montar();
    escribir(costo(c), '0'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(c.queryByTestId('error-costo-hora')).toBeNull();
    expect(repo.actualizarMaquina).toHaveBeenCalledWith(EMP, 'm1', { nombre: 'Torno CNC 1', costoHora: 0 });
  });
  it('al corregir el dato, se guarda', async () => {
    const c = await montar();
    escribir(costo(c), '-1'); await avanzar(DEBOUNCE_GUARDADO_MS);
    escribir(costo(c), '55'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(c.queryByTestId('error-costo-hora')).toBeNull();
    expect(repo.actualizarMaquina).toHaveBeenCalledTimes(1);
  });
  it('funciones de validación', () => {
    expect(validarFila('Torno', '30')).toEqual({});
    expect(validarFila('', '30')).toEqual({ nombre: 'El nombre es obligatorio.' });
    expect(validarFila('Torno', '-1').costoHora).toBeTruthy();
    expect(parsearCostoHora('0')).toBe(0);
    expect(parsearCostoHora(' 12,5 ')).toBe(12.5);
    expect(parsearCostoHora('')).toBeNull();
    expect(parsearCostoHora('1e3')).toBeNull();
  });
});

describe('máquina nueva', () => {
  it('"Agregar máquina" suma una fila vacía, sin errores hasta que se toca; se crea al completar y después se actualiza', async () => {
    const c = await montar();
    fireEvent.click(c.getByText('Agregar máquina'));
    expect(filas(c)).toHaveLength(3);
    expect(c.queryByTestId('error-nombre')).toBeNull();
    escribir(nombre(c, 2), '  Torno 2  ');
    escribir(costo(c, 2), '31');
    await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.crearMaquina).toHaveBeenCalledWith(EMP, { nombre: 'Torno 2', costoHora: 31 });
    expect(estado(c, 2)).toBe('Guardado');
    escribir(costo(c, 2), '32'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.actualizarMaquina).toHaveBeenCalledWith(EMP, 'm-nueva', { nombre: 'Torno 2', costoHora: 32 });
    expect(repo.crearMaquina).toHaveBeenCalledTimes(1);
  });
  it('una fila nueva incompleta no se guarda y muestra qué falta', async () => {
    const c = await montar();
    fireEvent.click(c.getByText('Agregar máquina'));
    escribir(nombre(c, 2), 'Solo nombre'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(repo.crearMaquina).not.toHaveBeenCalled();
    expect(c.getByTestId('error-costo-hora')).toBeTruthy();
  });
  it('descartar una fila nueva sin guardar no pide confirmación ni toca Firestore', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = await montar();
    fireEvent.click(c.getByText('Agregar máquina'));
    fireEvent.click(c.getByLabelText('Eliminar máquina'));
    expect(filas(c)).toHaveLength(2);
    expect(confirmar).not.toHaveBeenCalled();
    expect(repo.eliminarMaquina).not.toHaveBeenCalled();
  });
});

describe('cambia el costo hora: recálculo de piezas', () => {
  it('muestra "Se recalcularon N piezas"', async () => {
    repo.actualizarMaquina.mockResolvedValue({ recalculo: { recalculadas: 250, fallidas: 0 } });
    const c = await montar();
    escribir(costo(c), '60'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(c.getByTestId('resultado-recalculo').textContent).toContain('Se recalcularon 250 piezas');
    expect(c.queryByTestId('reintentar-recalculo')).toBeNull();
    expect(estado(c)).toBe('Guardado');
  });
  it('singular y cero', () => {
    expect(textoRecalculo(1)).toBe('Se recalculó 1 pieza');
    expect(textoRecalculo(0)).toBe('Se recalcularon 0 piezas');
  });
  it('si hubo fallidas: "M no se pudieron recalcular" + "Reintentar" (recalcularResumenesPorMaquina)', async () => {
    repo.actualizarMaquina.mockResolvedValue({ recalculo: { recalculadas: 98, fallidas: 2 } });
    repo.recalcularResumenesPorMaquina.mockResolvedValue({ recalculadas: 100, fallidas: 0 });
    const c = await montar();
    escribir(costo(c), '60'); await avanzar(DEBOUNCE_GUARDADO_MS);
    const r = c.getByTestId('resultado-recalculo');
    expect(r.textContent).toContain('Se recalcularon 98 piezas');
    expect(r.textContent).toContain('2 no se pudieron recalcular');
    fireEvent.click(c.getByTestId('reintentar-recalculo'));
    await avanzar(0);
    expect(repo.recalcularResumenesPorMaquina).toHaveBeenCalledWith(EMP, 'm1');
    expect(c.getByTestId('resultado-recalculo').textContent).toContain('Se recalcularon 100 piezas');
    expect(c.queryByTestId('reintentar-recalculo')).toBeNull();
  });
  it('si el reintento también falla, sigue mostrando las que no se pudieron recalcular', async () => {
    repo.actualizarMaquina.mockResolvedValue({ recalculo: { recalculadas: 98, fallidas: 2 } });
    repo.recalcularResumenesPorMaquina.mockRejectedValue(new Error('sin red'));
    const c = await montar();
    escribir(costo(c), '60'); await avanzar(DEBOUNCE_GUARDADO_MS);
    fireEvent.click(c.getByTestId('reintentar-recalculo'));
    await avanzar(0);
    expect(c.getByTestId('resultado-recalculo').textContent).toContain('no se pudieron recalcular');
    expect(c.getByTestId('reintentar-recalculo')).toBeTruthy();
  });
  it('seguir editando limpia el aviso de recálculo exitoso, pero no el de fallidas pendientes', async () => {
    repo.actualizarMaquina.mockResolvedValueOnce({ recalculo: { recalculadas: 5, fallidas: 0 } });
    const c = await montar();
    escribir(costo(c), '60'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(c.getByTestId('resultado-recalculo')).toBeTruthy();
    escribir(nombre(c), 'Otro nombre');
    expect(c.queryByTestId('resultado-recalculo')).toBeNull();
    repo.actualizarMaquina.mockResolvedValueOnce({ recalculo: { recalculadas: 1, fallidas: 1 } });
    await avanzar(DEBOUNCE_GUARDADO_MS);
    escribir(nombre(c), 'Y otro');
    expect(c.getByTestId('resultado-recalculo').textContent).toContain('1 no se pudieron recalcular');
  });
  it('cambiar solo el nombre no muestra recálculo', async () => {
    const c = await montar();
    escribir(nombre(c), 'Renombrada'); await avanzar(DEBOUNCE_GUARDADO_MS);
    expect(c.queryByTestId('resultado-recalculo')).toBeNull();
  });
});

describe('eliminar', () => {
  it('pide confirmación; si se cancela no borra nada', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const c = await montar();
    fireEvent.click(c.getByLabelText('Eliminar Torno CNC 1'));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toContain('Torno CNC 1');
    expect(repo.eliminarMaquina).not.toHaveBeenCalled();
    expect(filas(c)).toHaveLength(2);
  });
  it('confirmado: elimina y saca la fila', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    repo.eliminarMaquina.mockResolvedValue(undefined);
    const c = await montar();
    fireEvent.click(c.getByLabelText('Eliminar Torno CNC 1'));
    await avanzar(0);
    expect(repo.eliminarMaquina).toHaveBeenCalledWith(EMP, 'm1');
    expect(filas(c)).toHaveLength(1);
    expect(nombre(c).value).toBe('Centro vertical 1');
  });
  it('máquina en uso: "La máquina está en uso por al menos una pieza" y la fila se queda', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    repo.eliminarMaquina.mockRejectedValue(new MaquinaEnUsoError());
    const c = await montar();
    fireEvent.click(c.getByLabelText('Eliminar Torno CNC 1'));
    await avanzar(0);
    expect(c.getByTestId('mensaje-fila').textContent).toBe('La máquina está en uso por al menos una pieza');
    expect(filas(c)).toHaveLength(2);
  });
  it('otro error al eliminar: mensaje genérico y la fila se queda', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    repo.eliminarMaquina.mockRejectedValue(new Error('permission-denied'));
    const c = await montar();
    fireEvent.click(c.getByLabelText('Eliminar Torno CNC 1'));
    await avanzar(0);
    expect(c.getByTestId('mensaje-fila').textContent).toBe('No se pudo eliminar la máquina. Reintentá.');
    expect(filas(c)).toHaveLength(2);
  });
  it('el mensaje de "en uso" se limpia al editar la fila', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    repo.eliminarMaquina.mockRejectedValue(new MaquinaEnUsoError());
    const c = await montar();
    fireEvent.click(c.getByLabelText('Eliminar Torno CNC 1'));
    await avanzar(0);
    expect(c.queryByTestId('mensaje-fila')).not.toBeNull();
    escribir(nombre(c), 'Otro');
    expect(c.queryByTestId('mensaje-fila')).toBeNull();
  });
});

describe('cambio de empresa', () => {
  it('con otra empresaId lee las máquinas de esa empresa', async () => {
    const c = await montar();
    c.rerender(<MaquinasTabla empresaId="emp-b" repo={repo} />);
    await avanzar(0);
    expect(repo.listarMaquinas).toHaveBeenLastCalledWith('emp-b');
  });
});

