// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAJE_SALIDA, useAvisoSalida } from '@/components/costos/use-aviso-salida';

// Aviso al salir con cambios sin guardar: beforeunload y clics en enlaces internos.
let confirmarSalida: () => boolean;
function Probe({ activo }: { activo: boolean }) {
  confirmarSalida = useAvisoSalida(activo);
  return (
    <div>
      <a href="/costos" data-testid="interno">interno</a>
      <a href="/costos/piezas/otra" data-testid="otra">otra</a>
      <a href="https://example.com/x" data-testid="externo">externo</a>
      <a href="/costos/piezas/otra" target="_blank" data-testid="nueva-pestana">nueva pestaña</a>
      <a href="#ancla" data-testid="ancla">ancla</a>
    </div>
  );
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Un clic que el navegador no seguiría: se evalúa si algo lo canceló. */
const clic = (el: Element, init: MouseEventInit = {}) => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
};
const antesDeCerrar = () => {
  const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(e);
  return e;
};

describe('useAvisoSalida', () => {
  it('con cambios sin guardar: beforeunload se cancela (el navegador pregunta)', () => {
    render(<Probe activo />);
    expect(antesDeCerrar().defaultPrevented).toBe(true);
  });
  it('sin cambios: no molesta (ni beforeunload ni enlaces)', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = render(<Probe activo={false} />);
    expect(antesDeCerrar().defaultPrevented).toBe(false);
    expect(clic(c.getByTestId('otra')).defaultPrevented).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });
  it('clic en un enlace interno: pide confirmación; si se cancela, no navega; si se acepta, sigue', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const c = render(<Probe activo />);
    expect(clic(c.getByTestId('otra')).defaultPrevented).toBe(true);
    expect(confirmar).toHaveBeenCalledWith(MENSAJE_SALIDA);
    expect(clic(c.getByTestId('otra')).defaultPrevented).toBe(false);
    expect(confirmar).toHaveBeenCalledTimes(2);
  });
  it('no pregunta por enlaces externos, de nueva pestaña, anclas ni clics con modificadores', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const c = render(<Probe activo />);
    expect(clic(c.getByTestId('externo')).defaultPrevented).toBe(false);
    expect(clic(c.getByTestId('nueva-pestana')).defaultPrevented).toBe(false);
    expect(clic(c.getByTestId('ancla')).defaultPrevented).toBe(false);
    expect(clic(c.getByTestId('otra'), { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(clic(c.getByTestId('otra'), { button: 1 }).defaultPrevented).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });
  it('confirmarSalida (para router.push): pregunta solo con cambios', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const a = render(<Probe activo />);
    expect(confirmarSalida()).toBe(false);
    expect(confirmar).toHaveBeenCalledTimes(1);
    a.rerender(<Probe activo={false} />);
    expect(confirmarSalida()).toBe(true);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });
  it('al desmontar o al quedar sin cambios se quitan los avisos', () => {
    const c = render(<Probe activo />);
    c.rerender(<Probe activo={false} />);
    expect(antesDeCerrar().defaultPrevented).toBe(false);
    c.rerender(<Probe activo />);
    c.unmount();
    expect(antesDeCerrar().defaultPrevented).toBe(false);
  });
  void fireEvent;
});
