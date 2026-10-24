// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablaPiezas from '@/components/costos/tabla-piezas';
import { MAQUINAS, muchasPiezas, PIEZA_A, PIEZA_B, PIEZA_C, TRES_PIEZAS } from '@/components/costos/planta-datos-prueba';

// Tabla de piezas: búsqueda, filtros por máquina y rubro, orden por columna (asc/desc) y paginación de 15. Resúmenes inventados
// (ver planta-datos-prueba.ts): A = Zeta · B = Alfa · C = Mu. Los órdenes esperados están calculados a mano.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

type C = ReturnType<typeof render>;
const montar = (filas = TRES_PIEZAS, reglasVersion = 0) => render(<TablaPiezas filas={filas} maquinas={MAQUINAS} reglasVersion={reglasVersion} />);
const codigos = (c: C) => c.queryAllByTestId('fila-pieza').map((f) => f.querySelector('a')?.textContent);
const ordenarPor = (c: C, col: string) => fireEvent.click(c.getByTestId(`ordenar-${col}`));

beforeEach(() => push.mockReset());
afterEach(() => cleanup());

describe('orden por columna', () => {
  it('por defecto: USD/año de mayor a menor (A 10.000 · B 4.000 · C 2.000)', () => {
    expect(codigos(montar())).toEqual(['A-001', 'B-002', 'C-003']);
  });
  it('USD/año: un clic sobre la columna activa invierte el sentido', () => {
    const c = montar();
    ordenarPor(c, 'costoAnual');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
    expect(c.getByTestId('ordenar-costoAnual').closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    ordenarPor(c, 'costoAnual');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
    expect(c.getByTestId('ordenar-costoAnual').closest('th')?.getAttribute('aria-sort')).toBe('descending');
  });
  it('código: ascendente al primer clic (A, B, C) y descendente al segundo (C, B, A)', () => {
    const c = montar();
    ordenarPor(c, 'codigo');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
    ordenarPor(c, 'codigo');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
  });
  it('nombre: Alfa (B) · Mu (C) · Zeta (A) ascendente; al revés descendente', () => {
    const c = montar();
    ordenarPor(c, 'nombre');
    expect(codigos(c)).toEqual(['B-002', 'C-003', 'A-001']);
    ordenarPor(c, 'nombre');
    expect(codigos(c)).toEqual(['A-001', 'C-003', 'B-002']);
  });
  it('USD/pza: 10 (A) · 8 (B) · 1 (C), primero de mayor a menor', () => {
    const c = montar();
    ordenarPor(c, 'costoPieza');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
    ordenarPor(c, 'costoPieza');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
  });
  it('minutos por pieza: 9,5 (A) · 5 (B) · 0,5 (C)', () => {
    const c = montar();
    ordenarPor(c, 'minutosPieza');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
    ordenarPor(c, 'minutosPieza');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
  });
  it('ahorro potencial: 2.000 (A) · 500 (B) · 100 (C)', () => {
    const c = montar();
    ordenarPor(c, 'ahorro');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
    ordenarPor(c, 'ahorro');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
  });
  it('rubro principal (por su nombre): Tiempo de corte (A) · Scrap (C) · Herramientas (B) de Z a A', () => {
    const c = montar();
    ordenarPor(c, 'rubroPrincipal');
    expect(codigos(c)).toEqual(['A-001', 'C-003', 'B-002']);
    ordenarPor(c, 'rubroPrincipal');
    expect(codigos(c)).toEqual(['B-002', 'C-003', 'A-001']);
  });
  it('operación de mayor costo (por su nombre): Roscado (C) · Planeado (B) · Desbaste (A) de Z a A; al revés ascendente', () => {
    const c = montar();
    ordenarPor(c, 'opMayorCosto');
    expect(codigos(c)).toEqual(['C-003', 'B-002', 'A-001']);
    ordenarPor(c, 'opMayorCosto');
    expect(codigos(c)).toEqual(['A-001', 'B-002', 'C-003']);
  });
  it('los números se ordenan como números, no como texto (9 < 10 < 100)', () => {
    const filas = [PIEZA_A, PIEZA_B, PIEZA_C].map((f, i) => ({ ...f, resumen: { ...f.resumen, costoPieza: [100, 9, 10][i] } }));
    const c = montar(filas);
    ordenarPor(c, 'costoPieza');
    ordenarPor(c, 'costoPieza'); // ascendente
    expect(codigos(c)).toEqual(['B-002', 'C-003', 'A-001']);
  });
  it('los códigos con números se ordenan "naturalmente" (P-2 antes que P-10)', () => {
    const filas = ['P-10', 'P-2', 'P-1'].map((codigo, i) => ({ ...PIEZA_A, id: `x${i}`, codigo }));
    const c = montar(filas);
    ordenarPor(c, 'codigo');
    expect(codigos(c)).toEqual(['P-1', 'P-2', 'P-10']);
  });
});

describe('búsqueda y filtros', () => {
  it('busca por código o por nombre, sin distinguir mayúsculas ni acentos', () => {
    const c = montar();
    const caja = c.getByLabelText('Buscar por código o nombre');
    fireEvent.change(caja, { target: { value: 'ALFA' } });
    expect(codigos(c)).toEqual(['B-002']);
    fireEvent.change(caja, { target: { value: 'c-00' } });
    expect(codigos(c)).toEqual(['C-003']);
    fireEvent.change(caja, { target: { value: '' } });
    expect(codigos(c)).toHaveLength(3);
  });
  it('sin coincidencias: lo dice', () => {
    const c = montar();
    fireEvent.change(c.getByLabelText('Buscar por código o nombre'), { target: { value: 'nada' } });
    expect(c.getByText('Ninguna pieza coincide con el filtro.')).toBeTruthy();
    expect(c.getByTestId('cuenta-piezas').textContent).toBe('0 piezas');
  });
  it('"Pasa por la máquina" usa maquinaIds: m1 = A y B · m2 = A y C', () => {
    const c = montar();
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm1' } });
    expect(codigos(c)).toEqual(['A-001', 'B-002']);
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm2' } });
    expect(codigos(c)).toEqual(['A-001', 'C-003']);
    expect(within(c.getByLabelText('Pasa por la máquina')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas', 'Torno CNC', 'Centro vertical']);
  });
  it('"Rubro principal": corte = A · herramientas = B · scrap = C', () => {
    const c = montar();
    fireEvent.change(c.getByLabelText('Rubro principal'), { target: { value: 'corte' } });
    expect(codigos(c)).toEqual(['A-001']);
    fireEvent.change(c.getByLabelText('Rubro principal'), { target: { value: 'herramientas' } });
    expect(codigos(c)).toEqual(['B-002']);
    fireEvent.change(c.getByLabelText('Rubro principal'), { target: { value: 'scrap' } });
    expect(codigos(c)).toEqual(['C-003']);
  });
  it('los filtros se combinan: máquina m1 + rubro herramientas = B; m2 + herramientas = ninguna', () => {
    const c = montar();
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm1' } });
    fireEvent.change(c.getByLabelText('Rubro principal'), { target: { value: 'herramientas' } });
    expect(codigos(c)).toEqual(['B-002']);
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm2' } });
    expect(codigos(c)).toEqual([]);
  });
  it('el filtro se aplica sobre el orden elegido', () => {
    const c = montar();
    ordenarPor(c, 'costoAnual'); // ascendente
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm2' } });
    expect(codigos(c)).toEqual(['C-003', 'A-001']);
  });
});

describe('paginación de 15 (bordes)', () => {
  const filasVisibles = (c: C) => c.queryAllByTestId('fila-pieza').length;
  it('15 piezas: una sola página, sin controles', () => {
    const c = montar(muchasPiezas(15));
    expect(filasVisibles(c)).toBe(15);
    expect(c.queryByTestId('paginacion')).toBeNull();
  });
  it('16 piezas: dos páginas (15 + 1)', () => {
    const c = montar(muchasPiezas(16));
    expect(filasVisibles(c)).toBe(15);
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 2');
    expect((c.getByText('← Anterior') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(c.getByText('Siguiente →'));
    expect(filasVisibles(c)).toBe(1);
    expect(codigos(c)).toEqual(['P-016']);
    expect(c.getByTestId('paginacion').textContent).toContain('Página 2 de 2');
    expect((c.getByText('Siguiente →') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(c.getByText('← Anterior'));
    expect(filasVisibles(c)).toBe(15);
  });
  it('30 piezas: dos páginas exactas (15 + 15)', () => {
    const c = montar(muchasPiezas(30));
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 2');
    fireEvent.click(c.getByText('Siguiente →'));
    expect(filasVisibles(c)).toBe(15);
  });
  it('31 piezas: tres páginas (15 + 15 + 1)', () => {
    const c = montar(muchasPiezas(31));
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 3');
    fireEvent.click(c.getByText('Siguiente →'));
    expect(filasVisibles(c)).toBe(15);
    expect(codigos(c)[0]).toBe('P-016');
    fireEvent.click(c.getByText('Siguiente →'));
    expect(filasVisibles(c)).toBe(1);
    expect(codigos(c)).toEqual(['P-031']);
  });
  it('con 99 piezas se renderizan solo 15 filas, no las 99', () => {
    const c = montar(muchasPiezas(99));
    expect(filasVisibles(c)).toBe(15);
    expect(c.getByTestId('cuenta-piezas').textContent).toBe('99 piezas');
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 7');
  });
  it('al cambiar un filtro o el orden vuelve a la página 1', () => {
    const c = montar(muchasPiezas(31));
    fireEvent.click(c.getByText('Siguiente →'));
    fireEvent.change(c.getByLabelText('Buscar por código o nombre'), { target: { value: 'pieza' } });
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 3');
    fireEvent.click(c.getByText('Siguiente →'));
    ordenarPor(c, 'codigo');
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 3');
  });
  it('un filtro que deja 16 piezas de 31 da dos páginas', () => {
    const filas = muchasPiezas(31).map((f, i) => ({ ...f, resumen: { ...f.resumen, maquinaIds: i < 16 ? ['m1'] : ['m2'] } }));
    const c = montar(filas);
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm1' } });
    expect(c.getByTestId('cuenta-piezas').textContent).toBe('16 piezas');
    expect(c.getByTestId('paginacion').textContent).toContain('Página 1 de 2');
  });
});

describe('filas', () => {
  it('muestra código, nombre, USD/pza (4 decimales), USD/año, min/pza, operación, rubro y ahorro', () => {
    const c = montar();
    const fila = c.getAllByTestId('fila-pieza')[0].textContent ?? '';
    expect(fila).toContain('A-001');
    expect(fila).toContain('Zeta');
    expect(fila).toContain('USD 10,0000');
    expect(fila).toContain('USD 10.000');
    expect(fila).toContain('9:30');
    expect(fila).toContain('Desbaste');
    expect(fila).toContain('Tiempo de corte');
    expect(fila).toContain('USD 2.000');
  });
  it('clic en la fila abre el Diagnóstico de la pieza; el código es un enlace', () => {
    const c = montar();
    fireEvent.click(c.getAllByTestId('fila-pieza')[1]);
    expect(push).toHaveBeenCalledWith('/costos/piezas/b');
    expect(c.getAllByTestId('fila-pieza')[0].querySelector('a')?.getAttribute('href')).toBe('/costos/piezas/a');
  });
  it('la operación de mayor costo se muestra con su NOMBRE, no con el id', () => {
    const c = montar();
    const celdas = c.getAllByTestId('fila-pieza').map((f) => f.textContent ?? '');
    expect(celdas[0]).toContain('Desbaste');
    expect(celdas[0]).not.toContain('op20');
    expect(celdas[1]).toContain('Planeado');
    expect(celdas[2]).toContain('Roscado');
  });
  it('un resumen anterior al campo (sin opMayorCostoNombre) usa el id como respaldo', () => {
    const { opMayorCostoNombre: _n, ...sinNombre } = PIEZA_A.resumen; void _n;
    const filas = [{ ...PIEZA_A, resumen: sinNombre as never }];
    expect(montar(filas).getAllByTestId('fila-pieza')[0].textContent).toContain('op20');
  });
  it('una pieza sin operaciones (nombre vacío) muestra "—"', () => {
    const filas = [{ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, opMayorCosto: '', opMayorCostoNombre: '' } }];
    const fila = montar(filas).getAllByTestId('fila-pieza')[0];
    expect(within(fila).getAllByRole('cell')[5].textContent).toBe('—');
  });
  it('"+ Nueva pieza" lleva a la pieza nueva', () => {
    expect(montar().getByText('+ Nueva pieza').closest('a')?.getAttribute('href')).toBe('/costos/piezas/nueva');
  });
  it('la insignia "calculado con reglas anteriores" aparece solo en las piezas con otra versión de reglas', () => {
    const filas = [PIEZA_A, { ...PIEZA_B, resumen: { ...PIEZA_B.resumen, reglasVersion: 100 } }];
    const c = montar(filas, 100);
    const insignias = c.getAllByTestId('fila-pieza').map((f) => !!within(f).queryByTestId('insignia-reglas-fila'));
    expect(insignias).toEqual([true, false]); // A tiene reglasVersion 0 ≠ 100; B coincide
  });
  it('una calcVersion distinta también marca la pieza', () => {
    const filas = [{ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 0 } }];
    expect(montar(filas).getByTestId('insignia-reglas-fila')).toBeTruthy();
  });
  it('un resumen de la versión anterior (calcVersion 1, sin el nombre de la operación) aparece como desactualizado', () => {
    const filas = [{ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, calcVersion: 1 } }, { ...PIEZA_B, resumen: { ...PIEZA_B.resumen, calcVersion: 6 } }];
    const c = montar(filas);
    expect(c.getAllByTestId('fila-pieza').map((f) => !!within(f).queryByTestId('insignia-reglas-fila'))).toEqual([true, false]);
  });
});
