// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DiagnosticoPieza from '@/components/costos/diagnostico-pieza';
import { calcPieza } from '@/lib/costos-mecanizado/calc';
import { mejoras } from '@/lib/costos-mecanizado/mejoras';
import { REGLAS_POR_DEFECTO, type Pieza } from '@/lib/costos-mecanizado/types';
import { COSTO_HORA, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Diagnóstico de la pieza de control CAR-001 (SPEC 4.7). Los valores esperados son los del SPEC y los que se verifican a mano:
// Op30 = 1,919 · pieza 9,3570 (sin material) · 233.926 USD/año · operación de mayor costo = Op20 · rubro principal = tiempo de corte.
afterEach(() => cleanup());

function montar(pieza: Pieza = crearCarcasa(), opciones: { reglasDesactualizadas?: boolean; onComparar?: (m: unknown) => void } = {}) {
  const resultado = calcPieza(pieza, COSTO_HORA);
  const lista = mejoras(resultado, pieza, REGLAS_POR_DEFECTO);
  const onComparar = opciones.onComparar ?? vi.fn();
  const c = render(<DiagnosticoPieza pieza={pieza} resultado={resultado} mejorasLista={lista} reglasDesactualizadas={!!opciones.reglasDesactualizadas} onCompararAlternativa={onComparar as never} />);
  return { c, lista, onComparar };
}
const num = (texto: string | null) => Number((texto ?? '').replace(/\./g, '').replace(',', '.'));

describe('1. Mayor costo de esta pieza', () => {
  it('Op20 es la operación de mayor costo: 42 % del mecanizado, 3,8959 USD/pza y ≈ 97.399 USD/año', () => {
    const { c } = montar();
    expect(c.getByTestId('mayor-costo-titulo').textContent).toBe('Op 20 · Desbaste y contorno = 42 % del costo de mecanizado');
    const detalle = c.getByTestId('mayor-costo-detalle').textContent ?? '';
    expect(detalle).toMatch(/^USD 3,8959 por pieza · USD 97\.39\d por año/);
  });
  it('el rubro que más pesa dentro de la operación (tiempo de corte, 62 %) y en toda la pieza (tiempo de corte, 43 %)', () => {
    const { c } = montar();
    const detalle = c.getByTestId('mayor-costo-detalle').textContent ?? '';
    expect(detalle).toContain('Dentro de esta operación lo que más pesa es tiempo de corte (62 %)');
    expect(detalle).toContain('En toda la pieza, el rubro principal es tiempo de corte (43 %)');
  });
  it('el recuadro es rojo (estilo del prototipo)', () => {
    const { c } = montar();
    expect(c.getByTestId('mayor-costo').className).toContain('bg-[#fdecec]');
    expect(c.getByText('Mayor costo de esta pieza')).toBeTruthy();
  });
});

describe('2. KPIs', () => {
  it('mecanizado por pieza 9,3570 USD (9:41 min) y anual 233.926 USD con 25.000 piezas', () => {
    const { c } = montar();
    expect(c.getByTestId('kpi-mecanizado').textContent).toContain('USD 9,3570');
    expect(c.getByTestId('kpi-mecanizado').textContent).toContain('9:41 min por pieza');
    expect(c.getByTestId('kpi-anual').textContent).toContain('USD 233.926');
    expect(c.getByTestId('kpi-anual').textContent).toContain('25.000 piezas');
  });
  it('pieza con material = mecanizado + material: 9,3570 + 9,50 = 18,8570', () => {
    const { c } = montar();
    expect(c.getByTestId('kpi-material').textContent).toContain('Pieza con material');
    expect(c.getByTestId('kpi-material').textContent).toContain('USD 18,8570');
    expect(c.getByTestId('kpi-material').textContent).toContain('Mecanizado + material USD 9,50');
  });
  it('herramientas en el mecanizado: (herramientas + cambios) / mecanizado = (2,4336 + 0,1717) / 9,3570 = 28 %', () => {
    const { c } = montar();
    expect(c.getByTestId('kpi-herramientas').textContent).toContain('28 %');
    expect(c.getByTestId('kpi-herramientas').textContent).toContain('Incluye cambios');
  });
  it('si el material lo pone el cliente: "Material: lo pone el cliente" y si cobra el scrap', () => {
    const cobra = crearCarcasa(); cobra.material = { quienPone: 'cliente', clienteCobraScrap: true, cobroPorPiezaPerdida: 12 };
    expect(montar(cobra).c.getByTestId('kpi-material').textContent).toContain('Material: lo pone el cliente');
    expect(montar(cobra).c.getAllByTestId('kpi-material')[0].textContent).toContain('Te cobra USD 12,00 por pieza perdida');
    cleanup();
    const noCobra = crearCarcasa(); noCobra.material = { quienPone: 'cliente', clienteCobraScrap: false };
    const { c } = montar(noCobra);
    expect(c.getByTestId('kpi-material').textContent).toContain('Material: lo pone el cliente');
    expect(c.getByTestId('kpi-material').textContent).toContain('No te cobra el scrap');
    expect(c.getByTestId('kpi-material').textContent).not.toContain('Pieza con material');
  });
});

describe('3. ¿Dónde está el costo? y ¿En qué se va?', () => {
  it('operaciones de mayor a menor: Op20 3,8959 · Op30 1,9190 · Op10 1,3303 · Op40 1,1821 · Op50 1,0297', () => {
    const { c } = montar();
    const filas = c.getAllByTestId('barra-operacion').map((b) => b.textContent ?? '');
    expect(filas.map((t) => t.match(/Op \d+/)?.[0])).toEqual(['Op 20', 'Op 30', 'Op 10', 'Op 40', 'Op 50']);
    expect(filas[0]).toContain('3,8959');
    expect(filas[0]).toContain('42 %');
  });
  it('rubros de mayor a menor: corte 4,0583 · herramientas 2,4336 · tiempos muertos 1,9167 · scrap 0,5359 · preparación 0,2408 · cambios 0,1717', () => {
    const { c } = montar();
    const barras = c.getAllByTestId('barra-rubro');
    expect(barras.map((b) => b.getAttribute('data-rubro'))).toEqual(['corte', 'herramientas', 'tiemposMuertos', 'scrap', 'preparacion', 'cambios']);
    expect(barras.map((b) => b.textContent?.match(/\d+,\d{4}/)?.[0])).toEqual(['4,0583', '2,4336', '1,9167', '0,5359', '0,2408', '0,1717']);
  });
  it('los colores de los rubros son los del prototipo (--k-corte #12305a, --k-herr #e3a008, --k-scrap #d64545…)', () => {
    const { c } = montar();
    const leyenda = c.getByTestId('leyenda-rubros').innerHTML;
    for (const hex of ['#12305a', '#4f7cc4', '#9db8e3', '#e3a008', '#f2d488', '#d64545']) expect(leyenda).toContain(hex);
  });
});

describe('4. Matriz operación × rubro', () => {
  it('los totales por operación suman la pieza (9,3570) y la fila de total por rubro también', () => {
    const { c } = montar();
    const porOp = c.getAllByTestId('total-operacion').map((e) => num(e.textContent));
    expect(porOp).toEqual([1.3303, 3.8959, 1.919, 1.1821, 1.0297]);
    expect(Math.abs(porOp.reduce((s, v) => s + v, 0) - 9.357)).toBeLessThan(0.0005);
    const fila = within(c.getByTestId('fila-total-matriz'));
    expect(fila.getByTestId('total-pieza-matriz').textContent).toBe('9,3570');
    const porRubro = [...c.getByTestId('fila-total-matriz').querySelectorAll('td[data-rubro]')].map((e) => num(e.textContent));
    expect(porRubro).toEqual([4.0583, 1.9167, 0.2408, 2.4336, 0.1717, 0.5359]);
    expect(Math.abs(porRubro.reduce((s, v) => s + v, 0) - 9.357)).toBeLessThan(0.0005);
  });
  it('cada operación suma sus rubros; la de mayor costo en un rubro tiene la celda más oscura', () => {
    const { c } = montar();
    for (const fila of c.getAllByTestId('fila-matriz')) {
      const celdas = [...fila.querySelectorAll('td[data-rubro]')].map((e) => num(e.textContent));
      expect(Math.abs(celdas.reduce((s, v) => s + v, 0) - num(within(fila as HTMLElement).getByTestId('total-operacion').textContent))).toBeLessThan(0.003);
    }
    const alfa = (td: Element) => Number((td as HTMLElement).style.backgroundColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? 0);
    const corteOp20 = c.getAllByTestId('fila-matriz')[1].querySelector('td[data-rubro="corte"]')!; // 2,400: la celda más grande de la matriz
    const corteOp10 = c.getAllByTestId('fila-matriz')[0].querySelector('td[data-rubro="corte"]')!;
    expect(alfa(corteOp20)).toBeCloseTo(0.35, 2);
    expect(alfa(corteOp20)).toBeGreaterThan(alfa(corteOp10));
  });
  it('la fila "% del total" muestra la participación de cada rubro (corte 43 %)', () => {
    const { c } = montar();
    expect(c.getByTestId('fila-pct-matriz').textContent).toContain('43 %');
  });
});

describe('5. Mejoras priorizadas', () => {
  it('10 mejoras: muestra las 5 primeras, "Ver las 10 mejoras" muestra todas y vuelve a "Ver solo las 5 principales"', () => {
    const { c } = montar();
    expect(c.getAllByTestId('mejora')).toHaveLength(5);
    fireEvent.click(c.getByText('Ver las 10 mejoras'));
    expect(c.getAllByTestId('mejora')).toHaveLength(10);
    fireEvent.click(c.getByText('Ver solo las 5 principales'));
    expect(c.getAllByTestId('mejora')).toHaveLength(5);
  });
  it('ordenadas por ahorro anual de mayor a menor; la primera es la de Productividad de Op20: ≈ USD 12.000/año', () => {
    const { c } = montar();
    fireEvent.click(c.getByText('Ver las 10 mejoras'));
    const ahorros = c.getAllByTestId('ahorro-mejora').map((e) => num(e.textContent?.match(/[\d.]+(?=\/año)/)?.[0] ?? ''));
    for (let i = 1; i < ahorros.length; i++) expect(ahorros[i - 1]).toBeGreaterThanOrEqual(ahorros[i]);
    const primera = c.getAllByTestId('mejora')[0];
    expect(within(primera).getByTestId('categoria-mejora').textContent).toBe('Productividad');
    expect(primera.textContent).toContain('Op 20 · Desbaste y contorno');
    expect(within(primera).getByTestId('ahorro-mejora').textContent).toBe('≈ USD 12.000/año');
  });
  it('cada tarjeta lleva categoría, operación, título, explicación con números, supuesto y ahorro por año', () => {
    const { c } = montar();
    const t = c.getAllByTestId('mejora')[0].textContent ?? '';
    expect(t).toContain('El tiempo de corte domina la operación');
    expect(t).toMatch(/Representa el \d+ % del costo de la operación/);
    expect(t).toContain('Supuesto: −20 % del tiempo de corte');
    expect(t).toContain('/año');
  });
  it('"Ahorro potencial" total y cantidad de mejoras, con la leyenda de supuestos conservadores', () => {
    const { c } = montar();
    const p = c.getByTestId('potencial').textContent ?? '';
    expect(p).toContain('10 mejoras en esta pieza');
    expect(p).toMatch(/Ahorro potencial ≈ USD [\d.]+\/año/);
    expect(p).toMatch(/\d+ % del costo de mecanizado/);
    expect(c.getByTestId('leyenda-supuestos').textContent).toBe('Supuestos conservadores, a confirmar con ensayo en planta.');
  });
  it('usa la nomenclatura "Mejoras" y "Ahorro potencial" (nunca "Oportunidades")', () => {
    const { c } = montar();
    expect(c.getByText('Mejoras priorizadas')).toBeTruthy();
    expect(c.container.textContent).not.toMatch(/Oportunidad/i);
  });
  describe('botón "Comparar alternativa": solo en las que se pueden comparar', () => {
    it('condición 1: aparece en Productividad y Herramienta (puedeComparar) y llama con la mejora', () => {
      const { c, onComparar } = montar();
      fireEvent.click(c.getByText('Ver las 10 mejoras'));
      const conBoton = c.getAllByTestId('mejora').filter((m) => within(m).queryByText('Comparar alternativa'));
      expect(conBoton.map((m) => within(m).getByTestId('categoria-mejora').textContent).sort()).toEqual(['Herramienta', 'Herramienta', 'Herramienta', 'Productividad', 'Productividad']);
      fireEvent.click(within(conBoton[0]).getByText('Comparar alternativa'));
      expect(onComparar).toHaveBeenCalledWith(expect.objectContaining({ categoria: 'Productividad', opId: 'op20', puedeComparar: true }));
    });
    it('condición 2: NO aparece en Tiempos muertos ni en Calidad (no se resuelven cambiando de herramienta)', () => {
      const { c } = montar();
      fireEvent.click(c.getByText('Ver las 10 mejoras'));
      const sinBoton = c.getAllByTestId('mejora').filter((m) => !within(m).queryByText('Comparar alternativa'));
      expect(sinBoton.map((m) => within(m).getByTestId('categoria-mejora').textContent).sort()).toEqual(['Calidad', 'Calidad', 'Tiempos muertos', 'Tiempos muertos', 'Tiempos muertos']);
    });
  });
  it('sin mejoras que superen los umbrales: lo dice, y la leyenda queda', () => {
    const p = crearCarcasa();
    const resultado = calcPieza(p, COSTO_HORA);
    const c = render(<DiagnosticoPieza pieza={p} resultado={resultado} mejorasLista={[]} reglasDesactualizadas={false} onCompararAlternativa={() => {}} />);
    expect(c.getByText(/no hay mejoras que superen los umbrales/)).toBeTruthy();
    expect(c.getByTestId('leyenda-supuestos')).toBeTruthy();
  });
});

describe('7. Pieza sin operaciones', () => {
  it('"Cargá al menos una operación para ver el diagnóstico"', () => {
    const p = crearCarcasa(); p.operaciones = [];
    const { c } = montar(p);
    expect(c.getByTestId('diagnostico-vacio').textContent).toBe('Cargá al menos una operación para ver el diagnóstico.');
    expect(c.queryByTestId('mayor-costo')).toBeNull();
    expect(c.queryByTestId('kpis')).toBeNull();
  });
});

describe('8. Insignia "calculado con reglas anteriores"', () => {
  it('se muestra si el resumen guardado se calculó con otras reglas (solo informativa)', () => {
    const { c } = montar(crearCarcasa(), { reglasDesactualizadas: true });
    expect(c.getByTestId('insignia-reglas').textContent).toBe('calculado con reglas anteriores');
    expect(c.queryAllByRole('button', { name: /recalcular/i })).toHaveLength(0);
  });
  it('no se muestra si las reglas coinciden', () => {
    expect(montar().c.queryByTestId('insignia-reglas')).toBeNull();
  });
});
