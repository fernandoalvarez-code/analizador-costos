import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTaylorCurve, type UseTaylorCurveInputs } from '@/hooks/use-taylor-curve';
import { computeMachineScale } from '@/lib/machine-scale';
import { calcularRaTeorico } from '@/lib/taylor-helpers';
import { MATERIALS } from '@/lib/taylor-data';
import { hasValidVidaFiloReference } from '@/components/calculator/VidaFiloChart';
import { PdfPaginaDashboard } from '@/components/calculator/PdfPaginaDashboard';
import { PdfPaginaGraficos } from '@/components/calculator/PdfPaginaGraficos';
import { PdfPaginaDesgloseTecnico } from '@/components/calculator/PdfPaginaDesgloseTecnico';

/**
 * INFORME COMPLETO con la tarjeta de máquinas en paralelo y la hoja de gráficos unificada (las dos funciones juntas).
 * Caso: 24.000 pzs/mes, inserto USD 12 (actual) y USD 20 (propuesta), 4 filos, Vc 122 y 130 m/min, avance 0,2 en ambas,
 * rendimiento 20 y 30 pzs/filo, con 10 máquinas × 8 h × 1 turno × 22 días.
 * Datos que completan el caso (supuestos, declarados): tarifa USD 20/h, cambio de filo de 5 min (valor de casa), tiempo
 * de corte actual 2,0 min y propuesto proporcional a la Vc (2,0 × 122/130 = 1,877 min, mismo avance).
 *   costo por pieza = tarifa/60 · (tc + cambio/pcs) + (precio/filos)/pcs
 *   actual    = 0,3333 · (2,0   + 5/20) + 3,00/20 = 0,7500 + 0,1500 = USD 0,90
 *   propuesta = 0,3333 · (1,877 + 5/30) + 5,00/30 = 0,6820 + 0,1667 = USD 0,85   ->   -5,8 %
 *   horas requeridas = 24.000 · (tc + cambio/pcs) / 60 = 900 y 817,5 hs/mes; 10 máquinas × 176 = 1.760 hs/mes
 */
const CASO: UseTaylorCurveInputs = {
  operationType: 'turning', materialId: MATERIALS[1].nombre, machineCostHr: 20, toolChangeTime: 5, machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85,
  coolantInternal: false, drillingOrientation: 'vertical', profundidadAgujero: '', monthlyProduction: 24000, horasPorTurno: 8, turnosPorDia: 1, isStressTestActive: false,
  toolNameCurrent: 'CNMA120412 KCK20', toolCostCurrent: 12, apCurrent: 1, feedCurrent: 0.2, vcCurrent: 122, pcsCurrent: 20, tcCurrent: 2.0, zCurrent: '', edgesCurrent: 4, dcCurrent: 50, aeCurrent: '', lifeModeCurrent: 'piezas',
  toolNamePremium: 'CNMA120412-MR9 TK1501', toolCostPremium: 20, apPremium: 1, feedPremium: 0.2, vcPremium: 130, pcsPremium: 30, tcPremiumInput: (2.0 * 122) / 130, zPremium: '', edgesPremium: 4, dcPremium: 50, aePremium: '', lifeModePremium: 'piezas',
};

type Page = 'p1' | 'p2' | 'p3';
function Hoja({ page, machines }: { page: Page; machines: string | number }) {
  const i = CASO;
  const t = useTaylorCurve(i);
  const lifeData = t.curveDataInfo.data.map((d: any) => ({ speed: d.speed, lifeActual: d.lifePcsActual, lifePremium: d.lifePcsPremium }));
  const hasVida = hasValidVidaFiloReference(lifeData, Number(i.vcCurrent), Number(i.vcPremium));
  const machineScale = t.capacityCheck
    ? computeMachineScale({ hrsComp: t.capacityCheck.hrsCompExact, hrsSeco: t.capacityCheck.hrsSecoExact, machines, hoursPerShift: 8, shiftsPerDay: 1, daysPerMonth: 22 })
    : null;
  if (page === 'p1') {
    return (
      <PdfPaginaDashboard logos={{ company: '', brand: '' }} saveClientName="Cliente" pieceName="Pieza" curveDataInfo={t.curveDataInfo} monthlyProduction={i.monthlyProduction}
        tcCurrent={i.tcCurrent} tcPremiumInput={i.tcPremiumInput} toolChangeTime={i.toolChangeTime} horasPorTurno={i.horasPorTurno} turnosPorDia={i.turnosPorDia}
        capacityCheck={t.capacityCheck} machineScale={machineScale} pageNumber={1} totalPages={3} />
    );
  }
  if (page === 'p2') {
    return (
      <PdfPaginaGraficos costData={t.curveDataInfo.data} vcActual={Number(i.vcCurrent)} vcPremium={Number(i.vcPremium)} actualCostCurrent={t.curveDataInfo.actualCostCurrent}
        actualCostPremium={t.curveDataInfo.actualCostPremium} isStressTestActive={false} limiteTermicoActual={null} lifeData={hasVida ? lifeData : null} lifeUnit="pzas/filo"
        logoUrl="" pageNumber={2} totalPages={3} />
    );
  }
  return (
    <PdfPaginaDesgloseTecnico operationType={i.operationType} toolNameCurrent={i.toolNameCurrent} toolNamePremium={i.toolNamePremium} toolCostCurrent={i.toolCostCurrent} toolCostPremium={i.toolCostPremium}
      dcCurrent={i.dcCurrent} dcPremium={i.dcPremium} apCurrent={i.apCurrent} apPremium={i.apPremium} profundidadAgujero={i.profundidadAgujero} tcCurrent={i.tcCurrent} tcPremiumInput={i.tcPremiumInput}
      vcCurrent={i.vcCurrent} vcPremium={i.vcPremium} feedCurrent={i.feedCurrent} feedPremium={i.feedPremium} pcsCurrent={i.pcsCurrent} pcsPremium={i.pcsPremium}
      lifeModeCurrent={i.lifeModeCurrent} lifeModePremium={i.lifeModePremium} raActual={calcularRaTeorico(i.feedCurrent, i.toolNameCurrent)} raPropuesta={calcularRaTeorico(i.feedPremium, i.toolNamePremium)}
      curveDataInfo={t.curveDataInfo} logoUrl="" pageNumber={3} totalPages={3} />
  );
}
const html = (page: Page, machines: string | number = 10) => renderToStaticMarkup(<Hoja page={page} machines={machines} />);
const plain = (h: string) => h.replace(/<[^>]*>/g, '');

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z')); });
afterAll(() => vi.useRealTimers());

describe('informe completo: 3 hojas, tarjeta de máquinas en la hoja 1 y gráficos unificados en la 2', () => {
  it('cada hoja dice "Página N de 3" y existen exactamente las hojas 1, 2 y 3', () => {
    const [h1, h2, h3] = [html('p1'), html('p2'), html('p3')];
    expect(h1).toContain('id="pdf-pagina-1"'); expect(plain(h1)).toContain('Página 1 de 3');
    expect(h2).toContain('id="pdf-pagina-2"'); expect(plain(h2)).toContain('Página 2 de 3');
    expect(h3).toContain('id="pdf-pagina-3"'); expect(plain(h3)).toContain('Página 3 de 3');
  });

  it('hoja 1: la tarjeta de máquinas (10 máq. × 8 h × 1 turno × 22 días = 1.760 hs/mes) con sus números', () => {
    const t = plain(html('p1'));
    expect(t).toContain('Utilización teórica');
    expect(t).toContain('Base: 10 máq. × 8 h × 1 turno × 22 días = 1.760 hs/mes disponibles');
    expect(t).toMatch(/Utilización teórica: 51 % → 46 %/);       // 900 / 1.760 y 817,5 / 1.760
    expect(t).toContain('Capacidad requerida: 900 hs/mes');
  });

  it('hoja 2: franja de costos con -5.8 % (USD 0,90 → 0,85) y franja de vida con +50.0 % (20 → 30)', () => {
    const t = plain(html('p2'));
    expect(t).toContain('-5.8%');
    expect(t).toMatch(/USD 0\.90\s*→\s*USD 0\.85/);
    expect(t).toMatch(/20\s*→\s*30/);
    expect(t).toContain('+50.0%');
    expect(t).not.toContain('Utilización teórica'); // la tarjeta vive solo en la hoja 1
  });

  it('el -5.8 % es el mismo en la hoja 1 y en la hoja 2 (los números no se recalculan)', () => {
    expect(plain(html('p1'))).toContain('-5.8%');
    expect(plain(html('p2'))).toContain('-5.8%');
    expect(plain(html('p3'))).toContain('USD 0.90');
    expect(plain(html('p3'))).toContain('USD 0.85');
  });

  it('con N vacío la hoja 1 no lleva la tarjeta y lo demás es igual (misma página sin el bloque)', () => {
    const con = html('p1', 10);
    const sin = html('p1', '');
    expect(sin).not.toContain('escala-maquinas-resultado');
    expect(con.replace(/<div data-testid="escala-maquinas-resultado"[^>]*>.*?<\/div>/, '')).toBe(sin);
  });

  it('pie legal en las 3 hojas; la nota de IA solo en la última', () => {
    const t = [html('p1'), html('p2'), html('p3')].map(plain);
    for (const x of t) expect(x).toContain('Valores sugeridos — sujetos a verificación y ajuste en máquina');
    expect(t[2]).toContain('asistencia de inteligencia artificial');
    expect(t[0]).not.toContain('inteligencia artificial');
  });
});
