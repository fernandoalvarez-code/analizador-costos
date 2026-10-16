import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTaylorCurve, type UseTaylorCurveInputs } from '@/hooks/use-taylor-curve';
import { calcularRaTeorico } from '@/lib/taylor-helpers';
import { hasValidVidaFiloReference } from '@/components/calculator/VidaFiloChart';
import { PdfPaginaDashboard } from '@/components/calculator/PdfPaginaDashboard';
import { PdfPaginaGraficos } from '@/components/calculator/PdfPaginaGraficos';
import { PdfPaginaDesgloseTecnico } from '@/components/calculator/PdfPaginaDesgloseTecnico';
import { CASO_24000 } from '../../../tests/fixtures/caso-24000';
import { expectGolden } from '../../../tests/golden';

// El informe de 3 hojas con el caso 24.000 pzs, 122/130 m/min, 20/30 pzs/filo. Las tres hojas salen del MISMO hook,
// así que sirven para comprobar que los números de la hoja de gráficos coinciden con los del resto del informe.
type Page = 'p1' | 'p2' | 'p3';

function Hoja({ page, inputs = CASO_24000, life = true }: { page: Page; inputs?: UseTaylorCurveInputs; life?: boolean }) {
  const t = useTaylorCurve(inputs);
  const lifeData = t.curveDataInfo.data.map((d: any) => ({ speed: d.speed, lifeActual: d.lifePcsActual, lifePremium: d.lifePcsPremium }));
  const hasVida = life && hasValidVidaFiloReference(lifeData, Number(inputs.vcCurrent), Number(inputs.vcPremium));
  if (page === 'p1') {
    return (
      <PdfPaginaDashboard logos={{ company: '', brand: '' }} saveClientName="Toyota" pieceName="Eje" curveDataInfo={t.curveDataInfo} monthlyProduction={inputs.monthlyProduction}
        tcCurrent={inputs.tcCurrent} tcPremiumInput={inputs.tcPremiumInput} toolChangeTime={inputs.toolChangeTime} horasPorTurno={inputs.horasPorTurno} turnosPorDia={inputs.turnosPorDia}
        capacityCheck={t.capacityCheck} pageNumber={1} totalPages={3} />
    );
  }
  if (page === 'p2') {
    return (
      <PdfPaginaGraficos costData={t.curveDataInfo.data} vcActual={Number(inputs.vcCurrent)} vcPremium={Number(inputs.vcPremium)} actualCostCurrent={t.curveDataInfo.actualCostCurrent}
        actualCostPremium={t.curveDataInfo.actualCostPremium} isStressTestActive={inputs.isStressTestActive} limiteTermicoActual={t.curveDataInfo.limiteTermicoActual}
        lifeData={hasVida ? lifeData : null} lifeUnit="pzas/filo" logoUrl="" pageNumber={2} totalPages={3} />
    );
  }
  return (
    <PdfPaginaDesgloseTecnico operationType={inputs.operationType} toolNameCurrent={inputs.toolNameCurrent} toolNamePremium={inputs.toolNamePremium} toolCostCurrent={inputs.toolCostCurrent}
      toolCostPremium={inputs.toolCostPremium} dcCurrent={inputs.dcCurrent} dcPremium={inputs.dcPremium} apCurrent={inputs.apCurrent} apPremium={inputs.apPremium} profundidadAgujero={inputs.profundidadAgujero}
      tcCurrent={inputs.tcCurrent} tcPremiumInput={inputs.tcPremiumInput} vcCurrent={inputs.vcCurrent} vcPremium={inputs.vcPremium} feedCurrent={inputs.feedCurrent} feedPremium={inputs.feedPremium}
      pcsCurrent={inputs.pcsCurrent} pcsPremium={inputs.pcsPremium} lifeModeCurrent={inputs.lifeModeCurrent} lifeModePremium={inputs.lifeModePremium}
      raActual={calcularRaTeorico(inputs.feedCurrent, inputs.toolNameCurrent)} raPropuesta={calcularRaTeorico(inputs.feedPremium, inputs.toolNamePremium)}
      curveDataInfo={t.curveDataInfo} logoUrl="" pageNumber={3} totalPages={3} />
  );
}
// Recharts numera sus ids con un contador global ("recharts1-clip", "clipPath-recharts-line-4"): según el orden de los
// renders el marcado cambiaría. Se normalizan para que las comparaciones y los golden sean estables.
const html = (page: Page, opts: { inputs?: UseTaylorCurveInputs; life?: boolean } = {}) =>
  renderToStaticMarkup(<Hoja page={page} {...opts} />).replace(/recharts\d+-/g, 'recharts-').replace(/(recharts-line)-\d+/g, '$1');
const plain = (h: string) => h.replace(/<[^>]*>/g, '');
const count = (h: string, needle: string) => h.split(needle).length - 1;

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z')); });
afterAll(() => vi.useRealTimers());

describe('hoja 2 "Análisis Gráfico": curva de costos arriba y vida del filo abajo', () => {
  it('lleva las dos secciones, en ese orden, en UNA hoja (id pdf-pagina-2, "Página 2 de 3")', () => {
    const h = html('p2');
    expect(count(h, 'id="pdf-pagina-2"')).toBe(1);
    const costos = h.indexOf('data-testid="pdf-grafico-costos"');
    const vida = h.indexOf('data-testid="pdf-grafico-vida"');
    expect(costos).toBeGreaterThan(-1);
    expect(vida).toBeGreaterThan(costos);
    expect(plain(h)).toContain('2. Curva de Costos vs. Velocidad');
    expect(plain(h)).toContain('3. Vida del Filo vs. Velocidad');
    expect(plain(h)).toContain('Página 2 de 3');
  });

  it('cada gráfico mide ~260 px de alto con su leyenda (un SVG de 244 px + ~16 px de leyenda)', () => {
    const h = html('p2');
    expect(count(h, 'height="244"')).toBeGreaterThanOrEqual(2);
  });

  it('franja de costos: USD 0,79 → 0,65, variación -17.6 % y Vc de cada condición', () => {
    const t = plain(html('p2'));
    expect(t).toContain('Costo por pieza');
    expect(t).toMatch(/USD 0\.79\s*→\s*USD 0\.65/);
    expect(t).toContain('Variación del costo');
    expect(t).toContain('-17.6%');
    expect(t).toMatch(/122 m\/min\s*→\s*130 m\/min/);
  });

  it('franja de vida: 20 → 30 pzas/filo y +50.0 % de mejora', () => {
    const t = plain(html('p2'));
    expect(t).toContain('Vida del filo (pzas/filo)');
    expect(t).toMatch(/20\s*→\s*30/);
    expect(t).toContain('Mejora de la vida');
    expect(t).toContain('+50.0%');
  });

  it('marca cada Vc con una línea vertical punteada y su etiqueta, actual y propuesta distinguibles, en los DOS gráficos', () => {
    const h = html('p2');
    expect(count(h, 'stroke-dasharray="5 4"')).toBe(4);
    expect(count(h, 'Actual 122 m/min')).toBe(2);
    expect(count(h, 'Propuesta 130 m/min')).toBe(2);
    expect(h).toContain('stroke="#ef4444"');
    expect(h).toContain('stroke="#22c55e"');
  });

  it('etiqueta de valor en cada punto: USD 0.79 y USD 0.65 en la curva; 20 y 30 en la vida', () => {
    const h = html('p2');
    expect(count(h, '>USD 0.79<')).toBeGreaterThanOrEqual(2); // franja + etiqueta del punto
    expect(count(h, '>USD 0.65<')).toBeGreaterThanOrEqual(2);
    const svgs = h.match(/<svg[^>]*recharts-surface[\s\S]*?<\/svg>/g) ?? [];
    expect(svgs).toHaveLength(2);
    expect(svgs[1]).toMatch(/>20</);
    expect(svgs[1]).toMatch(/>30</);
  });

  it('el eje X se ajusta al entorno de trabajo (60 a 220 m/min), no hasta 370', () => {
    const svgs = html('p2').match(/<svg[^>]*recharts-surface[\s\S]*?<\/svg>/g) ?? [];
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      const eje = svg.slice(svg.indexOf('recharts-xAxis'), svg.indexOf('recharts-yAxis'));
      const ticks = [...eje.matchAll(/recharts-cartesian-axis-tick-value"[^>]*>(?:<tspan[^>]*>)?([^<]+)</g)].map((m) => m[1]);
      expect(ticks).toEqual(['60', '80', '100', '120', '140', '160', '180', '200', '220']);
    }
  });

  it('los números de la hoja de gráficos coinciden con los del resto del informe (no se recalcula nada)', () => {
    const p1 = plain(html('p1'));
    const p2 = plain(html('p2'));
    const p3 = plain(html('p3'));
    expect(p1).toContain('-17.6%');
    expect(p2).toContain('-17.6%');
    expect(p1).toContain('$0.79'); expect(p1).toContain('$0.65');
    expect(p3).toContain('USD 0.79'); expect(p3).toContain('USD 0.65');
    expect(p2).toContain('USD 0.79'); expect(p2).toContain('USD 0.65');
    expect(p3).toContain('20 pzs/filo'); expect(p3).toContain('30 pzs/filo');
  });

  it('notas legibles: ningún texto de la hoja usa menos de 11 px (8,25 pt; mínimo 8 pt)', () => {
    const h = html('p2');
    expect(h).not.toMatch(/text-\[(?:[0-9]|10)px\]/);
    expect(h).toContain('text-[11px]');
  });

  it('encabezado SECOCUT (isotipo/marca), título, página y pie con "Valores sugeridos"', () => {
    const t = plain(html('p2'));
    expect(t).toContain('SECOCUT');
    expect(t).toContain('Análisis Gráfico');
    expect(t).toContain('Valores sugeridos — sujetos a verificación y ajuste en máquina');
  });

  it('la nota de la vida conserva su texto (Taylor, "No constituye una medición")', () => {
    const t = plain(html('p2'));
    expect(t).toContain('C = Vc·Tⁿ');
    expect(t).toContain('No constituye una medición');
  });
});

describe('sin datos de vida del filo: la hoja lleva solo la curva de costos, más grande, y explica por qué', () => {
  it('sin sección de vida, con gráfico de 560 px y la nota', () => {
    const h = html('p2', { life: false });
    expect(h).not.toContain('data-testid="pdf-grafico-vida"');
    expect(h).toContain('height="560"');
    expect(plain(h)).toContain('La curva de vida del filo no se grafica');
    expect(count(h, 'stroke-dasharray="5 4"')).toBe(2);
  });

  it('un tiempo de corte en 0 (la vida en piezas no es finita) también deja solo la curva de costos', () => {
    const h = html('p2', { inputs: { ...CASO_24000, tcPremiumInput: 0 } });
    expect(h).not.toContain('data-testid="pdf-grafico-vida"');
  });
});

describe('pie legal y nota de IA', () => {
  it('"Valores sugeridos" en las 3 hojas; la nota de IA solo en la última', () => {
    const [h1, h2, h3] = [html('p1'), html('p2'), html('p3')].map(plain);
    for (const t of [h1, h2, h3]) expect(t).toContain('Valores sugeridos — sujetos a verificación y ajuste en máquina');
    expect(h3).toContain('asistencia de inteligencia artificial');
    expect(h1).not.toContain('inteligencia artificial');
    expect(h2).not.toContain('inteligencia artificial');
  });

  it('la nota de IA y el pie se leen a 11 px', () => {
    expect(html('p3')).not.toMatch(/text-\[(?:7|8|9)px\]">\s*Este informe/);
    expect(html('p3')).toMatch(/text-\[11px\][^>]*>\s*Este informe fue elaborado/);
  });
});

describe('datos largos', () => {
  const LARGO = 'CNMG 120408-MR9 TK1501 con portaherramientas SDJCR 2525M11 refrigeración interna alta presión (lote especial de producción) '.repeat(3);

  it('un nombre de herramienta de ~380 caracteres se recorta a 90 en la hoja 3 (no empuja el pie fuera de la hoja)', () => {
    const t = plain(html('p3', { inputs: { ...CASO_24000, toolNameCurrent: LARGO, toolNamePremium: LARGO } }));
    expect(t).not.toContain(LARGO);
    expect(t).toContain(LARGO.slice(0, 40));
    expect(t).toContain('…');
  });

  it('los nombres largos no cambian los gráficos (la hoja 2 no los muestra)', () => {
    expect(html('p2', { inputs: { ...CASO_24000, toolNameCurrent: LARGO, toolNamePremium: LARGO } })).toBe(html('p2'));
  });
});

describe('golden de la hoja 2 (regresión del marcado)', () => {
  it('con vida del filo', () => { expectGolden('pdf-pagina-2.graficos.html', html('p2')); });
  it('sin vida del filo', () => { expectGolden('pdf-pagina-2.graficos-sin-vida.html', html('p2', { life: false })); });
});
