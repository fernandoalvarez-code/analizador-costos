import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTaylorCurve } from '@/hooks/use-taylor-curve';
import { PdfPaginaDashboard } from '@/components/calculator/PdfPaginaDashboard';
import { TOYOTA_INPUTS } from '../../../tests/fixtures/toyota';
import { expectGolden } from '../../../tests/golden';

// LÍNEA BASE: el marcado exacto de la página 1 del PDF con el código de `main` ANTES de la función de
// máquinas en paralelo. Con "Máquinas en paralelo" vacío tiene que seguir siendo idéntico, carácter por carácter.
function Pagina1() {
  const t = useTaylorCurve(TOYOTA_INPUTS);
  return (
    <PdfPaginaDashboard
      logos={{ company: '', brand: '' }} saveClientName="Toyota" pieceName="Eje de transmisión"
      curveDataInfo={t.curveDataInfo} monthlyProduction={10000} tcCurrent={2.0} tcPremiumInput={1.375}
      toolChangeTime={2} horasPorTurno={8} turnosPorDia={1} capacityCheck={t.capacityCheck}
      pageNumber={1} totalPages={4}
    />
  );
}

describe('PDF página 1: línea base sin máquinas en paralelo', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z')); }); // la página imprime la fecha
  afterAll(() => vi.useRealTimers());

  it('coincide con el golden de main', () => {
    expectGolden('pdf-pagina-1.base.html', renderToStaticMarkup(<Pagina1 />));
  });

  it('muestra la capacidad del caso Toyota tal como la calcula la app (350 y 238 hs/mes; 113 liberadas, la diferencia de 112,5 redondeada)', () => {
    const html = renderToStaticMarkup(<Pagina1 />);
    expect(html).toContain('Capacidad requerida');
    expect(html).toContain('350 hs/mes');
    expect(html).toContain('238 hs/mes'); // 237,5 redondeado por la app
    expect(html).toContain('113 hs máquina liberadas/mes');
  });
});
