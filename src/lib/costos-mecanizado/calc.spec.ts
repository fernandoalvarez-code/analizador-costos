import { describe, expect, it } from 'vitest';
import {
  avisoLote, avisoVidaUtilFilo, calcPieza, calcPlanta, calcResumen, compararOpciones, loteEfectivo, materialEfectivo, sensibilidades,
  type PiezaConResumen,
} from '@/lib/costos-mecanizado/calc';
import { CALC_VERSION, REGLAS_POR_DEFECTO, type OpcionHerramienta, type Pieza } from '@/lib/costos-mecanizado/types';
import { ALTERNATIVA_OP30, COSTO_HORA, ORACULOS, crearCarcasa } from '../../../tests/fixtures/costos-control';

// Los valores esperados están ESCRITOS A MANO en tests/fixtures/costos-control.ts y en este archivo (calculados por fuera del
// motor con las fórmulas del SPEC). Tolerancia 0,001 en USD/pza. Los anuales y delta anual del SPEC vienen redondeados al USD
// entero: se comparan redondeando el valor calculado. El precio máximo (542,12) viene con dos decimales.
const cercano = (real: number, esperado: number) => expect(Math.abs(real - esperado)).toBeLessThan(0.001);

/** Copia profunda de la carcasa con un cambio. */
function carcasa(cambio?: (p: Pieza) => void): Pieza {
  const p = crearCarcasa();
  cambio?.(p);
  return p;
}

describe('a) caso base (SPEC 4.7)', () => {
  const r = calcPieza(crearCarcasa(), COSTO_HORA);

  it('costo por operación', () => {
    const o = ORACULOS.base.op;
    [o.op10, o.op20, o.op30, o.op40, o.op50].forEach((esperado, i) => cercano(r.operaciones[i].totalOp, esperado));
  });
  it('pieza 9,3570 USD sin material y 233.926 USD por año', () => {
    cercano(r.costoPieza, ORACULOS.base.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.base.anual);
  });
  it('"pieza con material" = costo de mecanizado + 9,50', () => { cercano(r.costoPiezaConMaterial, 9.357 + 9.5); });
  it('desglose de Op30', () => {
    const o = r.operaciones[2];
    const e = ORACULOS.base.op30;
    cercano(o.corte, e.corte); cercano(o.tiemposMuertos, e.aux); cercano(o.preparacion, e.setup);
    cercano(o.herramientas, e.herr); cercano(o.cambios, e.camb); cercano(o.scrap, e.scrap);
  });
  it('lote efectivo 500, material 9,50, 4 máquinas, op de mayor costo = Op20 y rubro principal = tiempo de corte', () => {
    expect(r.loteEfectivo).toBe(500);
    expect(r.materialEfectivo).toBe(9.5);
    expect(r.maquinaIds).toEqual(['CV2', 'CH', 'CV1', 'T1']);
    expect(r.opMayorCosto).toBe('op20');
    expect(r.rubroPrincipal).toBe('corte');
  });
  it('alternativa de Op30: delta −0,6708 USD/pza, −16.771 USD/año y precio máximo 542,12', () => {
    const p = carcasa((x) => x.operaciones[2].herramientas[0].opciones.push(ALTERNATIVA_OP30));
    const [enUso, alt] = compararOpciones(p, COSTO_HORA, 'op30', 'op30-h1');
    expect(enUso.esEnUso).toBe(true);
    expect(enUso.deltaPorPieza).toBe(0);
    expect(alt.esEnUso).toBe(false);
    cercano(alt.deltaPorPieza, ORACULOS.base.alt.deltaPorPieza);
    expect(Math.round(alt.deltaAnual)).toBe(ORACULOS.base.alt.deltaAnual);
    expect(Math.abs((alt.precioMaximo as number) - ORACULOS.base.alt.precioMaximo)).toBeLessThan(0.005);
  });
  it('una opción que nunca empata (cuesta más aun gratis) tiene precioMaximo null', () => {
    const cara: OpcionHerramienta = { ...ALTERNATIVA_OP30, id: 'x', precio: 0, piezasPorFilo: 10, cortePorPiezaMin: 5 };
    const p = carcasa((x) => x.operaciones[2].herramientas[0].opciones.push(cara));
    expect(compararOpciones(p, COSTO_HORA, 'op30', 'op30-h1')[1].precioMaximo).toBeNull();
  });
  it('compararOpciones con posición u operación inexistente -> []', () => {
    expect(compararOpciones(crearCarcasa(), COSTO_HORA, 'op30', 'no-existe')).toEqual([]);
    expect(compararOpciones(crearCarcasa(), COSTO_HORA, 'no-existe', 'op30-h1')).toEqual([]);
  });
  it('solo la opción EN USO entra en la cuenta: cambiar la seleccionada cambia el costo', () => {
    const p = carcasa((x) => { const pos = x.operaciones[2].herramientas[0]; pos.opciones.push(ALTERNATIVA_OP30); pos.seleccionada = 1; });
    const op30 = calcPieza(p, COSTO_HORA).operaciones[2];
    const base = calcPieza(crearCarcasa(), COSTO_HORA).operaciones[2];
    expect(op30.totalOp).toBeLessThan(base.totalOp);
  });
});

describe('b) roturas en Op20 · Alto avance (30 %, 5 min extra, 50 % tira la pieza)', () => {
  const p = carcasa((x) => Object.assign(x.operaciones[1].herramientas[0].opciones[0], { roturaPct: 30, roturaExtraMin: 5, roturaScrapPct: 50 }));
  const r = calcPieza(p, COSTO_HORA);
  it('costo por operación, pieza y anual', () => {
    const o = ORACULOS.roturas.op;
    [o.op10, o.op20, o.op30, o.op40, o.op50].forEach((esperado, i) => cercano(r.operaciones[i].totalOp, esperado));
    cercano(r.costoPieza, ORACULOS.roturas.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.roturas.anual);
  });
  it('en Op20: cambios 0,0828 (incluye el tiempo de roturas) y scrap 0,0992 (incluye piezas perdidas)', () => {
    cercano(r.operaciones[1].cambios, ORACULOS.roturas.op20.cambios);
    cercano(r.operaciones[1].scrap, ORACULOS.roturas.op20.scrap);
  });
});

describe('c) material', () => {
  const tot = (p: Pieza) => calcPieza(p, COSTO_HORA);
  it('el cliente pone el material y NO cobra el scrap', () => {
    const p = carcasa((x) => { x.material = { quienPone: 'cliente', clienteCobraScrap: false }; });
    const r = tot(p);
    expect(materialEfectivo(p)).toBe(0);
    ORACULOS.material.clienteNoCobraScrap.op.forEach((esperado, i) => cercano(r.operaciones[i].totalOp, esperado));
    cercano(r.costoPieza, ORACULOS.material.clienteNoCobraScrap.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.material.clienteNoCobraScrap.anual);
  });
  it('el cliente pone el material y cobra 12 USD por pieza perdida', () => {
    const p = carcasa((x) => { x.material = { quienPone: 'cliente', clienteCobraScrap: true, cobroPorPiezaPerdida: 12 }; });
    const r = tot(p);
    expect(materialEfectivo(p)).toBe(12);
    ORACULOS.material.clienteCobra12.op.forEach((esperado, i) => cercano(r.operaciones[i].totalOp, esperado));
    cercano(r.costoPieza, ORACULOS.material.clienteCobra12.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.material.clienteCobra12.anual);
  });
  it('el cliente cobra pero sin monto: material 0', () => {
    expect(materialEfectivo({ material: { quienPone: 'cliente', clienteCobraScrap: true } })).toBe(0);
  });
});

describe('d) modos de producción (volumen 25.000)', () => {
  const pieza = (cambio: (p: Pieza) => void) => carcasa(cambio);
  it('dedicada: lote = volumen anual', () => {
    const p = pieza((x) => { x.modoProduccion = 'dedicada'; });
    const r = calcPieza(p, COSTO_HORA);
    expect(loteEfectivo(p)).toBe(ORACULOS.modos.dedicada.lote);
    cercano(r.costoPieza, ORACULOS.modos.dedicada.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.modos.dedicada.anual);
  });
  it('lote de 100 piezas', () => {
    const p = pieza((x) => { x.piezasPorLote = 100; });
    const r = calcPieza(p, COSTO_HORA);
    cercano(r.costoPieza, ORACULOS.modos.lote100.pieza);
    expect(Math.round(r.costoAnual)).toBe(ORACULOS.modos.lote100.anual);
  });
  it('250 lotes por año = lote de 100 piezas', () => {
    const p = pieza((x) => { x.modoProduccion = 'lotesAnio'; x.lotesPorAnio = 250; });
    expect(loteEfectivo(p)).toBe(100);
    cercano(calcPieza(p, COSTO_HORA).costoPieza, ORACULOS.modos.lotesAnio250.pieza);
  });
  it('50 lotes por año = el caso base (lote de 500)', () => {
    const p = pieza((x) => { x.modoProduccion = 'lotesAnio'; x.lotesPorAnio = 50; });
    expect(loteEfectivo(p)).toBe(500);
    cercano(calcPieza(p, COSTO_HORA).costoPieza, ORACULOS.modos.lotesAnio50.pieza);
  });
});

describe('e) sensibilidades de la Broca Ø8,5 de Op30 (% del costo de la pieza)', () => {
  const s = calcPieza(crearCarcasa(), COSTO_HORA).operaciones[2].herramientasDetalle[0].sensibilidades;
  const e = ORACULOS.sensibilidades;
  it('precio +10 % = 1,0687 (sube)', () => { cercano(s.precioMas10.pct, e.precioMas10); expect(s.precioMas10.direccion).toBe('sube'); });
  it('vida +10 % = 0,9873 (baja)', () => { cercano(s.vidaMas10.pct, e.vidaMas10); expect(s.vidaMas10.direccion).toBe('baja'); expect(s.vidaMas10.cambioPct).toBeLessThan(0); });
  it('corta 10 % más rápido = 1,2423 (baja)', () => { cercano(s.cortaMasRapido10.pct, e.cortaMasRapido10); expect(s.cortaMasRapido10.direccion).toBe('baja'); });
  it('subir vc 10 % = 4,7853 (SUBE: positivo = el costo sube)', () => {
    cercano(s.subirVc10.pct, e.subirVc10);
    expect(s.subirVc10.direccion).toBe('sube');
    expect(s.subirVc10.cambioPct).toBeGreaterThan(0);
  });
  it('subir vc 10 % puede BAJAR el costo cuando el corte pesa mucho más que la herramienta', () => {
    // corte 10, herramienta 0,1: 0,4641 × 0,1 − 0,0909 × 10 < 0
    const x = sensibilidades({ corte: 10, consumo: 0.1, cambios: 0 }, 10.1);
    expect(x.subirVc10.direccion).toBe('baja');
    expect(x.subirVc10.cambioPct).toBeLessThan(0);
  });
  it('sin costo de pieza no divide por cero', () => {
    const x = sensibilidades({ corte: 1, consumo: 1, cambios: 1 }, 0);
    expect(Number.isFinite(x.precioMas10.pct)).toBe(true);
    expect(x.precioMas10.pct).toBe(0);
  });
});

describe('incidencia por herramienta (SPEC 4.5)', () => {
  const d = calcPieza(crearCarcasa(), COSTO_HORA).operaciones[2].herramientasDetalle[0];
  it('costo de la herramienta = corte + consumo + cambios + roturas (USD/pza), participaciones y sensibilidad al precio', () => {
    // Broca Ø8,5 en Op30: corte 0,2625 · consumo 1,0 · cambios 0,0162 · sin roturas ni scrap por rotura
    cercano(d.corte, 0.2625); cercano(d.consumo, 1.0); cercano(d.cambios, 0.0162);
    cercano(d.costoHerr, 1.2787);
    cercano(d.partOp, 1.2787 / 1.919);
    cercano(d.partPieza, 1.2787 / 9.357);
    cercano(d.sensPrecio, 1.0162 / 1.919);
    expect(d.nivelSensPrecio).toBe('Alto'); // 53 % > 15 %
  });
  it('vida útil por filo = piezas por filo × corte por pieza (min)', () => { cercano(d.vidaUtilFiloMin, 180 * 0.45); });
  it('niveles de sensibilidad al precio: Bajo < 5 %, Medio 5–15 %, Alto > 15 %', () => {
    const op = calcPieza(crearCarcasa(), COSTO_HORA).operaciones[1].herramientasDetalle[0]; // Alto avance en Op20: ~7 %
    expect(op.nivelSensPrecio).toBe('Medio');
    const bajo = calcPieza(crearCarcasa(), COSTO_HORA).operaciones[4].herramientasDetalle[0]; // CNMG en Op50: ~3 %
    expect(bajo.nivelSensPrecio).toBe('Bajo');
  });
});

describe('f) mínimos obligatorios, aplicados DENTRO del motor', () => {
  const una = (opcion: Partial<OpcionHerramienta>, op: Partial<Pieza['operaciones'][number]> = {}, pieza: Partial<Pieza> = {}): Pieza => ({
    id: 'p', codigo: 'P', nombre: 'P', volumenAnual: 1000, modoProduccion: 'dedicada', material: { quienPone: 'propio', costoPorPieza: 0 },
    operaciones: [{
      id: 'o', nombre: 'O', maquinaId: 'M', tiemposMuertosMin: 0, setupMin: 0, scrapPct: 0, ...op,
      herramientas: [{ id: 'h', seleccionada: 0, opciones: [{ id: 'x', nombre: 'X', precio: 1, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 1, cortePorPiezaMin: 0, cambioMin: 0, ...opcion }] }],
    }],
    ...pieza,
  });
  const M60 = { M: 60 }; // 1 USD por minuto

  it('piezas por filo 0 se trata como 0,01 (consumo = 1 / 0,01 = 100) y no divide por cero', () => {
    const r = calcPieza(una({ piezasPorFilo: 0 }), M60);
    expect(Number.isFinite(r.costoPieza)).toBe(true);
    expect(r.operaciones[0].herramientas).toBeCloseTo(100, 9);
  });
  it('piezas por filo negativo o NaN también se trata como 0,01', () => {
    expect(calcPieza(una({ piezasPorFilo: -5 }), M60).operaciones[0].herramientas).toBeCloseTo(100, 9);
    expect(calcPieza(una({ piezasPorFilo: NaN }), M60).operaciones[0].herramientas).toBeCloseTo(100, 9);
  });
  it('lote 0 -> lote efectivo 1 (preparación = setup completo)', () => {
    const p = una({}, { setupMin: 30 }, { modoProduccion: 'lote', piezasPorLote: 0 });
    expect(loteEfectivo(p)).toBe(1);
    expect(calcPieza(p, M60).operaciones[0].preparacion).toBeCloseTo(30, 9);
  });
  it('lotes por año 0 -> 1 lote al año (sin dividir por cero)', () => {
    const p = una({}, {}, { modoProduccion: 'lotesAnio', lotesPorAnio: 0, volumenAnual: 1000 });
    expect(loteEfectivo(p)).toBe(1000);
  });
  it('filos por inserto 0 -> 1 (consumo = insertos × precio / piezas por filo)', () => {
    const r = calcPieza(una({ filosPorInserto: 0, insertosPorHerramienta: 2, precio: 3, piezasPorFilo: 6 }), M60);
    expect(r.operaciones[0].herramientas).toBeCloseTo(1, 9); // 2 × 3 / (6 × 1)
  });
  it('insertos por herramienta 0 -> 1', () => {
    const r = calcPieza(una({ insertosPorHerramienta: 0, precio: 3, piezasPorFilo: 6 }), M60);
    expect(r.operaciones[0].herramientas).toBeCloseTo(0.5, 9); // 1 × 3 / 6
  });
  it('volumen anual 0 -> 1', () => {
    const r = calcPieza(una({}, {}, { volumenAnual: 0 }), M60);
    expect(r.volumenAnual).toBe(1);
    expect(r.costoAnual).toBeCloseTo(r.costoPieza, 9);
  });
  it('precios, tiempos y costo hora negativos se tratan como 0', () => {
    const r = calcPieza(una({ precio: -10, cortePorPiezaMin: -3, cambioMin: -2 }, { tiemposMuertosMin: -1, setupMin: -5 }), { M: -60 });
    expect(r.costoPieza).toBe(0);
  });
  it('porcentajes fuera de 0–100: scrap 150 % -> 100 %, scrap negativo -> 0', () => {
    const material = { quienPone: 'propio' as const, costoPorPieza: 10 };
    const r100 = calcPieza(una({ precio: 0 }, { scrapPct: 150 }, { material }), M60);
    expect(r100.operaciones[0].scrap).toBeCloseTo(10, 9); // 100 % del valor acumulado (material 10)
    expect(calcPieza(una({ precio: 0 }, { scrapPct: -20 }, { material }), M60).operaciones[0].scrap).toBe(0);
  });
  it('rotura 150 % -> 100 %: rq = 1 / piezas por filo', () => {
    const r = calcPieza(una({ precio: 0, piezasPorFilo: 1, roturaPct: 150, roturaExtraMin: 2 }), M60);
    expect(r.operaciones[0].cambios).toBeCloseTo(2, 9); // rq 1 × 2 min × 1 USD/min
  });
  it('una pieza sin operaciones no rompe nada', () => {
    const r = calcPieza(una({}, {}, { operaciones: [] }), M60);
    expect(r.costoPieza).toBe(0);
    expect(r.opMayorCosto).toBe('');
    expect(r.rubroPrincipal).toBeNull();
  });
  it('una posición sin opciones se ignora', () => {
    const p = una({});
    p.operaciones[0].herramientas[0].opciones = [];
    expect(calcPieza(p, M60).costoPieza).toBe(0);
  });
  it('una máquina sin costo hora cargado cuenta como 0', () => {
    expect(calcPieza(una({ precio: 0, cortePorPiezaMin: 5 }), {}).costoPieza).toBe(0);
  });
});

describe('avisos no bloqueantes (ADDENDUM punto 6)', () => {
  it('vida útil por filo: < 5 min o > 90 min -> verificar el dato; 5 y 90 exactos no avisan', () => {
    expect(avisoVidaUtilFilo(4.99)).toMatch(/verificar/i);
    expect(avisoVidaUtilFilo(90.01)).toMatch(/verificar/i);
    expect(avisoVidaUtilFilo(5)).toBeNull();
    expect(avisoVidaUtilFilo(90)).toBeNull();
    expect(avisoVidaUtilFilo(30)).toBeNull();
  });
  const dedicada = (volumenAnual: number) => ({ volumenAnual, modoProduccion: 'dedicada' as const });
  it('lote < 50 piezas avisa; 50 exacto no', () => {
    expect(avisoLote({ ...dedicada(10), piezasPorLote: 0 })).toMatch(/lote/i);
    expect(avisoLote({ volumenAnual: 5000, modoProduccion: 'lote', piezasPorLote: 49 })).toMatch(/lote/i);
    expect(avisoLote({ volumenAnual: 5000, modoProduccion: 'lote', piezasPorLote: 50 })).toBeNull();
  });
  it('más de 2.000 preparaciones por año avisa; 2.000 exactas no', () => {
    expect(avisoLote({ volumenAnual: 200100, modoProduccion: 'lote', piezasPorLote: 100 })).toMatch(/preparaciones/i); // 2.001
    expect(avisoLote({ volumenAnual: 200000, modoProduccion: 'lote', piezasPorLote: 100 })).toBeNull(); // 2.000
  });
});

describe('calcResumen (ADDENDUM punto 4: por pieza, sin material)', () => {
  const resumen = calcResumen(crearCarcasa(), COSTO_HORA);
  it('costoPieza SIN material, costoAnual = costoPieza × volumen', () => {
    cercano(resumen.costoPieza, ORACULOS.base.pieza);
    expect(Math.round(resumen.costoAnual)).toBe(ORACULOS.base.anual);
  });
  it('minutos por pieza, op de mayor costo, rubro principal, máquinas y versiones', () => {
    cercano(resumen.minutosPieza, 9.69); // corte 6,2 (0,8+3,2+0,6+0,5+1,1) + muertos 3,1 + setup (45+60+30+20+40)/500 = 0,39
    expect(resumen.opMayorCosto).toBe('op20');
    expect(resumen.opMayorCostoNombre).toBe('Desbaste y contorno');
    expect(resumen.rubroPrincipal).toBe('corte');
    expect(resumen.maquinaIds).toEqual(['CV2', 'CH', 'CV1', 'T1']);
    expect(resumen.calcVersion).toBe(CALC_VERSION);
    expect(resumen.reglasVersion).toBe(0); // defaults del código
  });
  it('USD/pza por máquina y por rubro suman el costo de la pieza', () => {
    cercano(Object.values(resumen.porMaquinaUsdPza).reduce((s, v) => s + v, 0), ORACULOS.base.pieza);
    cercano(Object.values(resumen.porRubroUsdPza).reduce((s, v) => s + v, 0), ORACULOS.base.pieza);
    cercano(resumen.porMaquinaUsdPza.CV1, 1.919 + 1.1821); // Op30 + Op40
    cercano(resumen.porMaquinaUsdPza.CH, 3.8959);
    cercano(resumen.porRubroUsdPza.corte, 4.0583); // 0,4667 + 2,4 + 0,35 + 0,2917 + 0,55
  });
  it('mejoras: 10 en el caso base, ahorro potencial anual y reglasVersion de las reglas usadas', () => {
    expect(resumen.cantMejoras).toBe(10);
    expect(resumen.ahorroPotencialAnual).toBeGreaterThan(12000); // solo la de Productividad en Op20 ya son 12.000
    expect(calcResumen(crearCarcasa(), COSTO_HORA, { ...REGLAS_POR_DEFECTO, reglasVersion: 7 }).reglasVersion).toBe(7);
  });
});

describe('resumen: nombre de la operación de mayor costo y versión', () => {
  it('CAR-001: la operación de mayor costo es "Desbaste y contorno" (Op20, 3,896 USD/pza)', () => {
    const r = calcResumen(crearCarcasa(), COSTO_HORA);
    expect(r.opMayorCosto).toBe('op20');
    expect(r.opMayorCostoNombre).toBe('Desbaste y contorno');
  });
  it('una pieza sin operaciones: id y nombre vacíos ("")', () => {
    const vacia: Pieza = { ...crearCarcasa(), operaciones: [] };
    const r = calcResumen(vacia, COSTO_HORA);
    expect(r.opMayorCosto).toBe('');
    expect(r.opMayorCostoNombre).toBe('');
  });
  it('si cambia la operación más cara, cambia el nombre (Op10 pasa a ser la de mayor costo con 10 veces el tiempo de corte)', () => {
    const p = crearCarcasa();
    p.operaciones[0].herramientas[0].opciones[0].cortePorPiezaMin = 80; // Planeado: 0,8 -> 80 min
    expect(calcResumen(p, COSTO_HORA).opMayorCostoNombre).toBe('Planeado 2 caras');
  });
  it('CALC_VERSION subió a 6 (el resumen suma descartadoAnual) y el resumen la guarda', () => {
    expect(CALC_VERSION).toBe(6);
    expect(calcResumen(crearCarcasa(), COSTO_HORA).calcVersion).toBe(6);
  });
});

describe('h) calcPlanta con 2 piezas', () => {
  // Pieza B hecha a mano: 1.000 pzs/año, dedicada, sin material, una sola operación en Centro vertical 1 (35 USD/h) con una
  // herramienta gratuita de 1 min de corte. Costo = 1 min × 35/60 = 0,5833 USD/pza = 583,33 USD/año.
  const piezaB: Pieza = {
    id: 'sop-002', codigo: 'SOP-002', nombre: 'Soporte', volumenAnual: 1000, modoProduccion: 'dedicada', material: { quienPone: 'propio', costoPorPieza: 0 },
    operaciones: [{
      id: 'b10', nombre: 'Fresado', maquinaId: 'CV1', tiemposMuertosMin: 0, setupMin: 0, scrapPct: 0,
      herramientas: [{ id: 'bh', seleccionada: 0, opciones: [{ id: 'bo', nombre: 'Fresa', precio: 0, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 100, cortePorPiezaMin: 1, cambioMin: 0 }] }],
    }],
  };
  const piezas = [crearCarcasa(), piezaB];
  const filas: PiezaConResumen[] = piezas.map((p) => ({ id: p.id as string, codigo: p.codigo, nombre: p.nombre, volumenAnual: p.volumenAnual, resumen: calcResumen(p, COSTO_HORA) }));
  const planta = calcPlanta(filas);

  it('pieza B: 0,5833 USD/pza', () => { cercano(calcPieza(piezaB, COSTO_HORA).costoPieza, 35 / 60); });
  it('totales: 2 piezas y 233.926 + 583,33 = 234.509,33 USD por año', () => {
    expect(planta.piezasAnalizadas).toBe(2);
    expect(Math.abs(planta.costoAnual - 234509.33)).toBeLessThan(1);
  });
  it('pareto 80 %: la Carcasa sola (99,75 %) ya lo alcanza -> 1 pieza; la más cara es la Carcasa', () => {
    expect(planta.piezasPara80).toBe(1);
    expect(planta.pareto.map((f) => f.id)).toEqual(['car-001', 'sop-002']);
    expect(Math.abs(planta.pareto[0].acumuladoPct - 99.75)).toBeLessThan(0.01);
    expect(planta.pareto[1].acumuladoPct).toBeCloseTo(100, 9);
    expect(planta.piezaMasCara?.id).toBe('car-001');
  });
  it('por máquina (USD/año): CH 97.397 · CV1 77.528 + 583 · CV2 33.258 · T1 25.743, con tolerancia por el redondeo de los oráculos', () => {
    const m = planta.porMaquinaAnual;
    expect(Math.abs(m.CH - 3.8959 * 25000)).toBeLessThan(3);
    expect(Math.abs(m.CV1 - ((1.919 + 1.1821) * 25000 + 583.33))).toBeLessThan(3);
    expect(Math.abs(m.CV2 - 1.3303 * 25000)).toBeLessThan(3);
    expect(Math.abs(m.T1 - 1.0297 * 25000)).toBeLessThan(3);
    expect(planta.maquinaMayorCosto?.maquinaId).toBe('CH');
  });
  it('por rubro: suman el costo anual y coinciden con la suma de las piezas (rubro principal: tiempo de corte)', () => {
    const sumaRubros = Object.values(planta.porRubroAnual).reduce((s, v) => s + v, 0);
    expect(Math.abs(sumaRubros - planta.costoAnual)).toBeLessThan(0.01);
    const sumaMaquinas = Object.values(planta.porMaquinaAnual).reduce((s, v) => s + v, 0);
    expect(Math.abs(sumaMaquinas - planta.costoAnual)).toBeLessThan(0.01);
    expect(planta.rubroPrincipal).toBe('corte');
    // coherente con la suma de las piezas: corte anual = corte de la Carcasa × 25.000 + 583,33 de la pieza B
    expect(Math.abs(planta.porRubroAnual.corte - (4.0583 * 25000 + 583.33))).toBeLessThan(3);
  });
  it('% herramientas = (herramientas + cambios) / total; ahorro potencial = suma de las piezas', () => {
    const esperado = (planta.porRubroAnual.herramientas + planta.porRubroAnual.cambios) / planta.costoAnual;
    expect(planta.pctHerramientas).toBeCloseTo(esperado, 12);
    expect(planta.pctHerramientas).toBeGreaterThan(0.2); // (2,4336 + 0,1717) / 9,357 ≈ 27,8 %
    expect(planta.pctHerramientas).toBeLessThan(0.3);
    expect(planta.ahorroPotencialAnual).toBeCloseTo(filas[0].resumen.ahorroPotencialAnual + filas[1].resumen.ahorroPotencialAnual, 9);
  });
  it('multiplica por el volumen anual de cada pieza', () => {
    const doble = calcPlanta(filas.map((f) => ({ ...f, volumenAnual: f.volumenAnual * 2 })));
    expect(doble.costoAnual).toBeCloseTo(planta.costoAnual * 2, 6);
  });
  it('pareto con piezas parejas: hacen falta más para llegar al 80 %', () => {
    const iguales = Array.from({ length: 10 }, (_, i) => ({ ...filas[1], id: `p${i}` }));
    const r = calcPlanta(iguales);
    expect(r.piezasPara80).toBe(8); // 10 piezas iguales: 80 % exacto con 8
  });
  it('planta vacía', () => {
    const r = calcPlanta([]);
    expect(r.piezasAnalizadas).toBe(0);
    expect(r.costoAnual).toBe(0);
    expect(r.piezasPara80).toBe(0);
    expect(r.piezaMasCara).toBeNull();
    expect(r.maquinaMayorCosto).toBeNull();
    expect(r.rubroPrincipal).toBeNull();
    expect(r.pctHerramientas).toBe(0);
  });
});
