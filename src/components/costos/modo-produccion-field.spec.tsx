// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModoProduccionField, { resumenLote, type ModoProduccionValor } from '@/components/costos/modo-produccion-field';

afterEach(() => cleanup());

const montar = (valor: ModoProduccionValor) => {
  const onChange = vi.fn();
  const c = render(<ModoProduccionField valor={valor} onChange={onChange} />);
  return { c, onChange };
};
const linea = (c: ReturnType<typeof render>) => c.getByTestId('linea-lote').textContent ?? '';

describe('línea "= N preparaciones por año · lotes de X piezas"', () => {
  it('por lotes: 25.000 piezas/año con lotes de 500 = 50 preparaciones por año · lotes de 500 piezas', () => {
    const { c } = montar({ volumenAnual: 25000, modoProduccion: 'lote', piezasPorLote: 500 });
    expect(linea(c)).toBe('= 50 preparaciones por año · lotes de 500 piezas');
    expect(c.queryByTestId('aviso-lote')).toBeNull();
  });
  it('por lotes por año: 25.000 piezas con 250 lotes = 250 preparaciones · lotes de 100 piezas', () => {
    const { c } = montar({ volumenAnual: 25000, modoProduccion: 'lotesAnio', lotesPorAnio: 250 });
    expect(linea(c)).toBe('= 250 preparaciones por año · lotes de 100 piezas');
  });
  it('usa punto de miles: 250.000 piezas con lotes de 1.000 = 250 preparaciones · lotes de 1.000 piezas', () => {
    const { c } = montar({ volumenAnual: 250000, modoProduccion: 'lote', piezasPorLote: 1000 });
    expect(linea(c)).toBe('= 250 preparaciones por año · lotes de 1.000 piezas');
  });
  it('máquina dedicada: 1 preparación por año, sin aviso', () => {
    const { c } = montar({ volumenAnual: 25000, modoProduccion: 'dedicada' });
    expect(linea(c)).toMatch(/^1 preparación por año · el setup no incide en el costo por pieza/);
    expect(c.queryByTestId('aviso-lote')).toBeNull();
  });
});

describe('aviso de lote (ADDENDUM punto 6: lote < 50 o más de 2.000 preparaciones por año)', () => {
  it('lote de 49 piezas: aviso', () => {
    const { c } = montar({ volumenAnual: 5000, modoProduccion: 'lote', piezasPorLote: 49 });
    expect(c.getByTestId('aviso-lote').textContent).toMatch(/poco habitual/);
    expect(c.getByTestId('aviso-lote').textContent).toMatch(/Máquina dedicada/);
  });
  it('lote de 50 piezas: sin aviso (el borde no avisa)', () => {
    const { c } = montar({ volumenAnual: 5000, modoProduccion: 'lote', piezasPorLote: 50 });
    expect(c.queryByTestId('aviso-lote')).toBeNull();
  });
  it('más de 2.000 preparaciones por año: aviso; 2.000 exactas: sin aviso', () => {
    expect(montar({ volumenAnual: 200100, modoProduccion: 'lote', piezasPorLote: 100 }).c.queryByTestId('aviso-lote')).not.toBeNull();
    cleanup();
    expect(montar({ volumenAnual: 200000, modoProduccion: 'lote', piezasPorLote: 100 }).c.queryByTestId('aviso-lote')).toBeNull();
  });
  it('el aviso no bloquea: es solo texto (no hay error de validación)', () => {
    const { c } = montar({ volumenAnual: 5000, modoProduccion: 'lote', piezasPorLote: 10 });
    expect(c.queryByRole('alert')).toBeNull();
  });
  it('resumenLote: la línea y el aviso', () => {
    expect(resumenLote({ volumenAnual: 25000, modoProduccion: 'lote', piezasPorLote: 500 })).toMatchObject({ texto: '= 50 preparaciones por año · lotes de 500 piezas', aviso: null, dedicada: false });
    expect(resumenLote({ volumenAnual: 25000, modoProduccion: 'lote', piezasPorLote: 10 }).aviso).toMatch(/poco habitual/);
    expect(resumenLote({ volumenAnual: 25000, modoProduccion: 'dedicada' }).dedicada).toBe(true);
  });
});

describe('tarjetas de modo', () => {
  it('muestra las tres tarjetas con la actual marcada', () => {
    const { c } = montar({ volumenAnual: 1000, modoProduccion: 'lotesAnio', lotesPorAnio: 10 });
    const radios = c.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
  });
  it('elegir otra tarjeta informa el modo', () => {
    const { c, onChange } = montar({ volumenAnual: 1000, modoProduccion: 'lote', piezasPorLote: 100 });
    fireEvent.click(c.getByLabelText(/Máquina dedicada/));
    expect(onChange).toHaveBeenCalledWith({ modoProduccion: 'dedicada' });
  });
  it('solo muestra el campo del modo elegido: piezas por lote / lotes por año / ninguno', () => {
    expect(montar({ volumenAnual: 1000, modoProduccion: 'lote', piezasPorLote: 100 }).c.queryByLabelText('Piezas por lote')).not.toBeNull();
    cleanup();
    const b = montar({ volumenAnual: 1000, modoProduccion: 'lotesAnio', lotesPorAnio: 10 }).c;
    expect(b.queryByLabelText('Lotes por año')).not.toBeNull();
    expect(b.queryByLabelText('Piezas por lote')).toBeNull();
    cleanup();
    const d = montar({ volumenAnual: 1000, modoProduccion: 'dedicada' }).c;
    expect(d.queryByLabelText('Piezas por lote')).toBeNull();
    expect(d.queryByLabelText('Lotes por año')).toBeNull();
  });
  it('editar las piezas por lote informa el número', () => {
    const { c, onChange } = montar({ volumenAnual: 1000, modoProduccion: 'lote', piezasPorLote: 100 });
    fireEvent.change(c.getByLabelText('Piezas por lote'), { target: { value: '250' } });
    expect(onChange).toHaveBeenLastCalledWith({ piezasPorLote: 250 });
  });
});
