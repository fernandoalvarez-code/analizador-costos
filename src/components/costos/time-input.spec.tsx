// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TimeInput, { textoTiempoValido } from '@/components/costos/time-input';

// Entrada de tiempos mm:ss: "1:30" = 1 min 30 s · "0:27" = 27 s · "5" = 5 min (acepta coma decimal). Datos en minutos.
afterEach(() => cleanup());

function montar(value = 1.5) {
  const onChange = vi.fn();
  const c = render(<TimeInput label="Setup" value={value} onChange={onChange} />);
  const input = c.getByLabelText('Setup') as HTMLInputElement;
  return { c, input, onChange };
}

describe('TimeInput', () => {
  it('muestra el valor en mm:ss', () => {
    expect(montar(1.5).input.value).toBe('1:30');
    cleanup();
    expect(montar(0.45).input.value).toBe('0:27');
    cleanup();
    expect(montar(0).input.value).toBe('0:00');
  });
  it.each([['1:30', 1.5], ['0:27', 0.45], ['5', 5], ['1,5', 1.5], ['2.25', 2.25], ['12:15', 12.25]])('al escribir "%s" informa %s minutos', (texto, minutos) => {
    const { input, onChange } = montar(7); // el valor inicial es otro (si el texto no cambia, React no dispara el evento)
    fireEvent.change(input, { target: { value: texto } });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(minutos, 9));
  });
  it('mientras se escribe, el texto queda como se tipeó (no se reescribe)', () => {
    const { input } = montar();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1,5' } });
    expect(input.value).toBe('1,5');
  });
  it('al salir del campo se reescribe en mm:ss', () => {
    const { input } = montar();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1,5' } });
    fireEvent.blur(input);
    // el valor del padre no cambió (el test no lo actualiza): vuelve a su mm:ss
    expect(input.value).toBe('1:30');
  });
  it('al salir del campo con el valor ya actualizado por el padre, queda el mm:ss de ese valor', () => {
    const onChange = vi.fn();
    const c = render(<TimeInput label="Setup" value={1.5} onChange={(m) => { onChange(m); c.rerender(<TimeInput label="Setup" value={m} onChange={onChange} />); }} />);
    const input = c.getByLabelText('Setup') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0:27' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0:27');
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.45, 9));
  });
  it('entrada inválida: informa 0 y se marca como inválida', () => {
    const { input, onChange } = montar();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
  it('vacío cuenta como 0 y no es inválido', () => {
    const { input, onChange } = montar();
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
  it('un error de validación del padre lo marca', () => {
    const c = render(<TimeInput label="Setup" value={1} onChange={() => {}} error="El tiempo debe ser mayor o igual a 0 (mm:ss)." />);
    expect((c.getByLabelText('Setup') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
  });
  it('si el valor cambia desde afuera y no se está escribiendo acá, el texto se actualiza', () => {
    const c = render(<TimeInput label="Setup" value={1} onChange={() => {}} />);
    c.rerender(<TimeInput label="Setup" value={2.5} onChange={() => {}} />);
    expect((c.getByLabelText('Setup') as HTMLInputElement).value).toBe('2:30');
  });
  it('si cambia desde afuera MIENTRAS se escribe acá, no pisa lo que se está tipeando (no pierde el foco ni el texto)', () => {
    const c = render(<TimeInput label="Setup" value={1} onChange={() => {}} />);
    const input = c.getByLabelText('Setup') as HTMLInputElement;
    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '3:' } });
    c.rerender(<TimeInput label="Setup" value={3} onChange={() => {}} />);
    expect(input.value).toBe('3:');
    expect(document.activeElement).toBe(input);
  });
  it('un campo deshabilitado no se edita', () => {
    const c = render(<TimeInput label="Corte" value={2} onChange={() => {}} disabled />);
    expect((c.getByLabelText('Corte') as HTMLInputElement).disabled).toBe(true);
  });
  it('textoTiempoValido', () => {
    for (const t of ['', '  ', '5', '1:30', '1,5', '0:27,5', ' 2 ']) expect(textoTiempoValido(t)).toBe(true);
    for (const t of ['abc', '1:2:3', '-5', ':30', '1:']) expect(textoTiempoValido(t)).toBe(false);
  });
});
