// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezasLista from '@/components/costos/piezas-lista';

// Lista mínima de piezas: 15 por página con código, nombre, USD/pza y USD/año del resumen, y "+ Nueva pieza".
const EMP = 'emp-a';
const fila = (i: number) => ({
  id: `p${i}`, codigo: `COD-${String(i).padStart(3, '0')}`, nombre: `Pieza ${i}`, volumenAnual: 1000,
  resumen: { costoPieza: 9.357, costoAnual: 233925.59 },
});
const pagina = (desde: number, cantidad: number, siguiente: unknown) => ({ items: Array.from({ length: cantidad }, (_, k) => fila(desde + k)), siguiente });
const repo = { listarPiezasPagina: vi.fn() };

const montar = async () => {
  const c = render(<PiezasLista empresaId={EMP} repo={repo as never} />);
  await act(async () => { await Promise.resolve(); });
  return c;
};

beforeEach(() => { repo.listarPiezasPagina.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('lista de piezas', () => {
  it('pide 15 por página y muestra código, nombre, USD/pza (4 decimales) y USD/año', async () => {
    repo.listarPiezasPagina.mockResolvedValue(pagina(1, 3, null));
    const c = await montar();
    expect(repo.listarPiezasPagina).toHaveBeenCalledWith(EMP, 15, undefined);
    const filas = c.getAllByTestId('fila-pieza');
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toContain('COD-001');
    expect(filas[0].textContent).toContain('Pieza 1');
    expect(filas[0].textContent).toContain('USD 9,3570');
    expect(filas[0].textContent).toContain('USD 233.926');
  });
  it('cada código lleva a la pieza y "+ Nueva pieza" a la pieza nueva', async () => {
    repo.listarPiezasPagina.mockResolvedValue(pagina(1, 1, null));
    const c = await montar();
    expect(c.getByText('COD-001').closest('a')?.getAttribute('href')).toBe('/costos/piezas/p1');
    expect(c.getByText('+ Nueva pieza').closest('a')?.getAttribute('href')).toBe('/costos/piezas/nueva');
  });
  it('sin piezas invita a agregar la primera', async () => {
    repo.listarPiezasPagina.mockResolvedValue(pagina(1, 0, null));
    const c = await montar();
    expect(c.getByText(/Todavía no cargaste piezas/)).toBeTruthy();
    expect(c.queryByText('Siguiente →')).toBeNull();
  });
  it('paginación: "Siguiente" usa el cursor de la página y "Anterior" vuelve', async () => {
    const cursor1 = { cursor: 1 };
    repo.listarPiezasPagina
      .mockResolvedValueOnce(pagina(1, 15, cursor1))
      .mockResolvedValueOnce(pagina(16, 5, null))
      .mockResolvedValueOnce(pagina(1, 15, cursor1));
    const c = await montar();
    expect(c.getAllByTestId('fila-pieza')).toHaveLength(15);
    expect((c.getByText('← Anterior') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(c.getByText('Siguiente →'));
    await act(async () => { await Promise.resolve(); });
    expect(repo.listarPiezasPagina).toHaveBeenLastCalledWith(EMP, 15, cursor1);
    expect(c.getAllByTestId('fila-pieza')).toHaveLength(5);
    expect(c.getByText('Página 2')).toBeTruthy();
    expect((c.getByText('Siguiente →') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(c.getByText('← Anterior'));
    await act(async () => { await Promise.resolve(); });
    expect(c.getByText('Página 1')).toBeTruthy();
    expect(repo.listarPiezasPagina).toHaveBeenLastCalledWith(EMP, 15, undefined);
  });
  it('si falla la lectura, avisa y "Reintentar" vuelve a leer', async () => {
    repo.listarPiezasPagina.mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValueOnce(pagina(1, 2, null));
    const c = await montar();
    expect(c.getByRole('alert').textContent).toMatch(/No se pudieron leer las piezas/);
    fireEvent.click(c.getByText('Reintentar'));
    await act(async () => { await Promise.resolve(); });
    expect(c.getAllByTestId('fila-pieza')).toHaveLength(2);
  });
  it('una pieza sin resumen no rompe la lista', async () => {
    repo.listarPiezasPagina.mockResolvedValue({ items: [{ id: 'x', codigo: 'X', nombre: 'Sin resumen', volumenAnual: 1, resumen: undefined }], siguiente: null });
    const c = await montar();
    expect(c.getByTestId('fila-pieza').textContent).toContain('USD 0,0000');
  });
});
