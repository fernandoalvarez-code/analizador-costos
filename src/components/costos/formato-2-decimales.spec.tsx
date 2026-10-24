// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor from '@/components/costos/pieza-editor';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Importes por pieza con 2 decimales y el valor exacto (4 decimales) en el title, en la pieza de control CAR-001 (9,3570235 USD/pza).
// Valores a mano: 9,3570235 → USD 9,36 · Op20 3,895944 → 3,90 · rubros: corte 4,058333 → 4,06 · herramientas 2,433568 → 2,43.
// FRÁGIL: depende de los textos y title de diagnostico-pieza, pieza-editor y las tablas de herramientas.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };
const montar = () => render(<PiezaEditor empresaId="emp-a" repo={repo} inicial={{ ...crearCarcasa(), id: 'car-001' } as PiezaDoc} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} />);
type C = ReturnType<typeof render>;
const escribir = (el: HTMLElement, valor: string) => fireEvent.change(el, { target: { value: valor } });
const irADatos = (c: C) => fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  repo.actualizarPieza.mockResolvedValue(undefined);
  repo.listarTodosLosResumenes.mockResolvedValue([]);
  repo.obtenerPieza.mockResolvedValue(null);
});
afterEach(() => cleanup());

describe('barra de la pieza y tarjeta "Mecanizado por pieza"', () => {
  it('barra: "USD 9,36 por pieza" con title "USD 9,3570 exacto"; el anual sigue entero (USD 233.926)', () => {
    const c = montar();
    const barra = c.getByTestId('meta-pieza');
    expect(barra.textContent).toContain('USD 9,36 por pieza');
    expect(barra.textContent).toContain('USD 233.926 por año');
    expect(barra.querySelector('b')!.getAttribute('title')).toBe('USD 9,3570 exacto');
  });
  it('tarjeta "Mecanizado por pieza": USD 9,36 con title "USD 9,3570 exacto"; "Pieza con material" USD 18,86 (9,3570 + 9,50 = 18,8570)', () => {
    const c = montar();
    const kpi = within(c.getByTestId('kpi-mecanizado'));
    expect(kpi.getByText('USD 9,36').getAttribute('title')).toBe('USD 9,3570 exacto');
    const material = within(c.getByTestId('kpi-material'));
    expect(material.getByText('USD 18,86').getAttribute('title')).toBe('USD 18,8570 exacto');
  });
  it('banner "Mayor costo": USD 3,90 por pieza (title "USD 3,8959 exacto") y USD 97.399 por año', () => {
    const c = montar();
    const detalle = c.getByTestId('mayor-costo-detalle');
    expect(detalle.textContent).toMatch(/^USD 3,90 por pieza · USD 97\.399 por año/);
    expect(detalle.querySelector('span')!.getAttribute('title')).toBe('USD 3,8959 exacto');
  });
});

describe('matriz operación × rubro y barras', () => {
  it('celdas, total por operación y fila total con 2 decimales y su title exacto', () => {
    const c = montar();
    const totalOp20 = c.getAllByTestId('total-operacion')[1];
    expect(totalOp20.textContent).toBe('3,90');
    expect(totalOp20.getAttribute('title')).toBe('USD 3,8959 exacto');
    const total = c.getByTestId('total-pieza-matriz');
    expect(total.textContent).toBe('9,36');
    expect(total.getAttribute('title')).toBe('USD 9,3570 exacto');
    const herrTotal = c.getByTestId('fila-total-matriz').querySelector('td[data-rubro="herramientas"]')!;
    expect(herrTotal.textContent).toBe('2,43');
    expect(herrTotal.getAttribute('title')).toBe('USD 2,4336 exacto');
  });
  it('"¿Dónde está el costo?" y "¿En qué se va?" con 2 decimales y title exacto', () => {
    const c = montar();
    const barraOp = within(c.getAllByTestId('barra-operacion')[0]);
    expect(barraOp.getByText('3,90', { exact: false }).getAttribute('title')).toBe('USD 3,8959 exacto');
    const corte = c.getAllByTestId('barra-rubro').find((b) => b.getAttribute('data-rubro') === 'corte')!;
    expect(corte.textContent).toContain('4,06');
    expect(corte.querySelector('span.tabular-nums')!.getAttribute('title')).toBe('USD 4,0583 exacto');
  });
  it('los segmentos de la barra conservan su tooltip y le anexan el exacto, sin pisarlo ("Tiempo de corte: USD 2,40 · USD 2,4000 exacto" en Op20, que corta 3,2 min a 45 USD/h)', () => {
    const c = montar();
    const segmentos = [...c.getByTestId('donde-esta').querySelectorAll('[title]')].map((e) => e.getAttribute('title'));
    expect(segmentos).toContain('Tiempo de corte: USD 2,40 · USD 2,4000 exacto');
  });
});

describe('una mejora', () => {
  it('"USD 0,48 por pieza" con title "USD 0,4800 exacto" y el anual entero (≈ USD 12.000/año)', () => {
    const c = montar();
    const tarjeta = c.getAllByTestId('mejora')[0];
    const linea = within(tarjeta).getByText('USD 0,48 por pieza');
    expect(linea.getAttribute('title')).toBe('USD 0,4800 exacto');
    expect(tarjeta.textContent).toContain('≈ USD 12.000/año');
  });
  it('las explicaciones usan 2 decimales: "(USD 1,02 por pieza)" de la herramienta de Op30 (1,0162 exacto)', () => {
    const c = montar();
    const textos = c.getAllByTestId('mejora').map((m) => m.textContent ?? '');
    expect(textos.some((t) => t.includes('(USD 1,02 por pieza)'))).toBe(true);
    for (const t of textos) for (const m of t.matchAll(/USD (\d+(?:\.\d{3})*,\d+) por pieza/g)) expect(m[1]).toMatch(/,\d{2}$/);
  });
});

describe('ruta de operaciones y tabla de herramientas', () => {
  it('la ruta muestra el costo de cada operación con 2 decimales y su title exacto', () => {
    const c = montar();
    irADatos(c);
    const celdas = c.getAllByTestId('usd-operacion');
    expect(celdas.map((e) => e.textContent)).toEqual(['1,33', '3,90', '1,92', '1,18', '1,03']);
    expect(celdas[1].getAttribute('title')).toBe('USD 3,8959 exacto');
  });
  it('columna USD/pza de cada opción: USD 1,28 con title exacto (Broca Ø8,5: 0,2625 + 1,0 + 0,0162 = 1,2787)', () => {
    const c = montar();
    irADatos(c);
    fireEvent.click(c.getByLabelText('Editar Agujereado'));
    const celda = within(c.getByTestId('operacion-editor')).getAllByTestId('usd-opcion')[0];
    expect(celda.textContent).toBe('USD 1,28');
    expect(celda.getAttribute('title')).toBe('USD 1,2787 exacto');
  });
  /** Agrega una alternativa a la Broca Ø8,5 (180 USD, 180 piezas por filo, 0:27 de corte, 5:00 de cambio) con otro precio y devuelve la celda del delta. */
  function deltaDeAlternativa(precio: string) {
    const c = montar();
    irADatos(c);
    fireEvent.click(c.getByLabelText('Editar Agujereado'));
    const posicion = within(within(c.getByTestId('operacion-editor')).getAllByTestId('posicion-herramienta')[0]);
    fireEvent.click(posicion.getByText('+ Opción'));
    const nueva = within(posicion.getAllByTestId('opcion-herramienta')[1]);
    escribir(nueva.getByLabelText('Nombre de la opción'), 'Broca alternativa');
    escribir(nueva.getByLabelText('Precio USD'), precio);
    escribir(nueva.getByLabelText('Piezas por filo'), '180');
    for (const [etiqueta, valor] of [['Corte por pieza (mm:ss)', '0:27'], ['Cambio (mm:ss)', '5:00']]) {
      const campo = nueva.getByLabelText(etiqueta) as HTMLInputElement;
      fireEvent.focus(campo);
      escribir(campo, valor);
    }
    fireEvent.click(posicion.getByText('Comparar'));
    return posicion.getAllByTestId('delta-pieza')[0];
  }
  it('un delta por pieza que se vería 0,00 pero no es cero se muestra "<USD 0,01/pza", no "igual" (50 centavos más de precio sobre 180 piezas por filo = +0,0028 USD/pza)', () => {
    const delta = deltaDeAlternativa('180.5');
    expect(delta.textContent).toBe('<USD 0,01/pza');
    expect(delta.getAttribute('title')).toMatch(/^USD 0,00\d\d exacto$/);
  });
  it('y si es negativo, "−<USD 0,01/pza" (50 centavos menos de precio: −0,0028 USD/pza)', () => {
    const delta = deltaDeAlternativa('179.5');
    expect(delta.textContent).toBe('−<USD 0,01/pza');
    expect(delta.getAttribute('title')).toMatch(/^−USD 0,00\d\d exacto$/);
  });
  it('con exactamente el mismo costo (misma opción copiada) sigue diciendo "igual"', () => {
    const delta = deltaDeAlternativa('180');
    expect(delta.textContent).toBe('igual');
  });
});
