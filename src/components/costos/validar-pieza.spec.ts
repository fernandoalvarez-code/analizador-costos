import { describe, expect, it } from 'vitest';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';
import { MENSAJES, opcionNueva, operacionNueva, piezaNueva, posicionNueva, rutaOp, rutaOpcion, validarPieza } from '@/components/costos/validar-pieza';
import type { Pieza } from '@/lib/costos-mecanizado/types';

// Mínimos obligatorios (ADDENDUM punto 5) con mensaje por campo. Un dato inválido NO se guarda.
const MAQUINAS = ['T1', 'CV1', 'CV2', 'CH'];
const valida = () => crearCarcasa();
const con = (cambio: (p: Pieza) => void) => { const p = valida(); cambio(p); return validarPieza(p, MAQUINAS); };

describe('validarPieza', () => {
  it('la pieza de control (CAR-001) es válida', () => { expect(validarPieza(valida(), MAQUINAS)).toEqual({}); });
  it('una pieza nueva solo falla en código y nombre', () => {
    expect(Object.keys(validarPieza(piezaNueva(), MAQUINAS)).sort()).toEqual(['codigo', 'nombre']);
  });
  it('código y nombre obligatorios (también con solo espacios)', () => {
    expect(con((p) => { p.codigo = '  '; }).codigo).toBe(MENSAJES.codigo);
    expect(con((p) => { p.nombre = ''; }).nombre).toBe(MENSAJES.nombre);
  });
  it.each([[0], [0.5], [NaN], [-3]])('piezas por año %s: inválido (mínimo 1)', (v) => {
    expect(con((p) => { p.volumenAnual = v; }).volumenAnual).toBe(MENSAJES.volumen);
  });
  it('piezas por año = 1 es válido', () => { expect(con((p) => { p.volumenAnual = 1; }).volumenAnual).toBeUndefined(); });
  it('lote efectivo ≥ 1: piezas por lote 0 o vacío (modo lote) y lotes por año 0 (modo lotes por año)', () => {
    expect(con((p) => { p.piezasPorLote = 0; }).piezasPorLote).toBe(MENSAJES.piezasPorLote);
    expect(con((p) => { p.piezasPorLote = NaN; }).piezasPorLote).toBe(MENSAJES.piezasPorLote);
    expect(con((p) => { p.modoProduccion = 'lotesAnio'; p.lotesPorAnio = 0; }).lotesPorAnio).toBe(MENSAJES.lotesPorAnio);
  });
  it('en máquina dedicada no se piden lotes', () => {
    expect(con((p) => { p.modoProduccion = 'dedicada'; p.piezasPorLote = undefined; }).piezasPorLote).toBeUndefined();
  });
  it('material: costo ≥ 0 si lo pone el propio; monto ≥ 0 si el cliente cobra', () => {
    expect(con((p) => { p.material = { quienPone: 'propio', costoPorPieza: -1 }; })['material.costoPorPieza']).toBe(MENSAJES.materialCosto);
    expect(con((p) => { p.material = { quienPone: 'propio', costoPorPieza: 0 }; })['material.costoPorPieza']).toBeUndefined();
    expect(con((p) => { p.material = { quienPone: 'cliente', clienteCobraScrap: true, cobroPorPiezaPerdida: -2 }; })['material.cobroPorPiezaPerdida']).toBe(MENSAJES.materialCobro);
    expect(con((p) => { p.material = { quienPone: 'cliente', clienteCobraScrap: false }; })['material.cobroPorPiezaPerdida']).toBeUndefined();
  });
  it('operación: nombre obligatorio, máquina existente, tiempos ≥ 0, scrap entre 0 y 100', () => {
    const e = con((p) => {
      const o = p.operaciones[0];
      o.nombre = ''; o.maquinaId = 'borrada'; o.tiemposMuertosMin = -1; o.setupMin = NaN; o.scrapPct = 101;
    });
    expect(e[rutaOp('op10', 'nombre')]).toBe(MENSAJES.opNombre);
    expect(e[rutaOp('op10', 'maquinaId')]).toBe(MENSAJES.opMaquina);
    expect(e[rutaOp('op10', 'tiemposMuertosMin')]).toBe(MENSAJES.tiempo);
    expect(e[rutaOp('op10', 'setupMin')]).toBe(MENSAJES.tiempo);
    expect(e[rutaOp('op10', 'scrapPct')]).toBe(MENSAJES.scrap);
  });
  it('scrap 0 y 100 son válidos', () => {
    expect(con((p) => { p.operaciones[0].scrapPct = 0; })[rutaOp('op10', 'scrapPct')]).toBeUndefined();
    expect(con((p) => { p.operaciones[0].scrapPct = 100; })[rutaOp('op10', 'scrapPct')]).toBeUndefined();
    expect(con((p) => { p.operaciones[0].scrapPct = -0.1; })[rutaOp('op10', 'scrapPct')]).toBe(MENSAJES.scrap);
  });
  describe('herramienta (ADDENDUM punto 5)', () => {
    const r = (campo: string) => rutaOpcion('op10', 'op10-h1', 'op10-h1-o1', campo);
    const opcion = (p: Pieza) => p.operaciones[0].herramientas[0].opciones[0];
    it('piezas por filo ≥ 0,01: 0 inválido, 0,01 válido', () => {
      expect(con((p) => { opcion(p).piezasPorFilo = 0; })[r('piezasPorFilo')]).toBe(MENSAJES.piezasPorFilo);
      expect(con((p) => { opcion(p).piezasPorFilo = 0.009; })[r('piezasPorFilo')]).toBe(MENSAJES.piezasPorFilo);
      expect(con((p) => { opcion(p).piezasPorFilo = 0.01; })[r('piezasPorFilo')]).toBeUndefined();
    });
    it('insertos por herramienta ≥ 1 y filos por inserto ≥ 1', () => {
      expect(con((p) => { opcion(p).insertosPorHerramienta = 0; })[r('insertosPorHerramienta')]).toBe(MENSAJES.insertos);
      expect(con((p) => { opcion(p).filosPorInserto = 0; })[r('filosPorInserto')]).toBe(MENSAJES.filos);
      expect(con((p) => { opcion(p).insertosPorHerramienta = 1; opcion(p).filosPorInserto = 1; })[r('filosPorInserto')]).toBeUndefined();
    });
    it('precios y tiempos ≥ 0', () => {
      const e = con((p) => { const o = opcion(p); o.precio = -1; o.cortePorPiezaMin = -1; o.cambioMin = -1; });
      expect(e[r('precio')]).toBe(MENSAJES.precio);
      expect(e[r('cortePorPiezaMin')]).toBe(MENSAJES.tiempo);
      expect(e[r('cambioMin')]).toBe(MENSAJES.tiempo);
    });
    it('porcentajes de rotura entre 0 y 100 (solo si están cargados)', () => {
      const e = con((p) => { const o = opcion(p); o.roturaPct = 101; o.roturaScrapPct = -1; o.roturaExtraMin = -2; });
      expect(e[r('roturaPct')]).toBe(MENSAJES.porcentaje);
      expect(e[r('roturaScrapPct')]).toBe(MENSAJES.porcentaje);
      expect(e[r('roturaExtraMin')]).toBe(MENSAJES.tiempo);
      expect(con(() => {})[r('roturaPct')]).toBeUndefined();
    });
    it('nombre de la opción obligatorio y una posición sin opciones es inválida', () => {
      expect(con((p) => { opcion(p).nombre = ''; })[r('nombre')]).toBe(MENSAJES.optNombre);
      expect(Object.values(con((p) => { p.operaciones[0].herramientas[0].opciones = []; }))).toContain(MENSAJES.posicionSinOpciones);
    });
    it('un campo vacío (NaN) es inválido', () => {
      expect(con((p) => { opcion(p).precio = NaN; })[r('precio')]).toBe(MENSAJES.precio);
    });
  });
});

describe('valores iniciales', () => {
  it('operación nueva con la máquina dada, una herramienta y una opción; ids únicos', () => {
    const o = operacionNueva('CV1');
    expect(o.maquinaId).toBe('CV1');
    expect(o.herramientas).toHaveLength(1);
    expect(o.herramientas[0].opciones).toHaveLength(1);
    expect(operacionNueva('CV1').id).not.toBe(o.id);
    expect(posicionNueva().id).not.toBe(posicionNueva().id);
    expect(opcionNueva().id).not.toBe(opcionNueva().id);
  });
  it('una operación nueva con máquina válida no tiene errores propios', () => {
    const p = piezaNueva(); p.codigo = 'X'; p.nombre = 'X'; p.operaciones.push(operacionNueva('CV1'));
    expect(validarPieza(p, MAQUINAS)).toEqual({});
  });
});
