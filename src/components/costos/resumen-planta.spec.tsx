// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumenPlanta from '@/components/costos/resumen-planta';
import { MAQUINAS, PIEZA_A, PIEZA_B, PIEZA_C, TRES_PIEZAS } from '@/components/costos/planta-datos-prueba';
import { CALC_VERSION } from '@/lib/costos-mecanizado/types';

// Resumen de planta con 3 resúmenes inventados de totales conocidos (ver planta-datos-prueba.ts). Todo lo esperado está
// calculado A MANO: costo anual 16.000 · herramientas + cambios = 3.150 + 850 = 4.000 = 25 % · ahorro 2.600 ·
// máquinas m1 = 10.000 y m2 = 6.000 · rubros: corte 8.000, herramientas 3.150, tiempos muertos 1.700, scrap 1.350, preparación 950, cambios 850.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const EMP = 'emp-a';
const repo = { listarTodosLosResumenes: vi.fn(), listarMaquinas: vi.fn(), leerReglas: vi.fn(), recalcularResumenesDesactualizados: vi.fn() };
const maquinasDoc = MAQUINAS.map((m) => ({ ...m, costoHora: 30 }));
const reglas = (reglasVersion = 0) => ({ reglasVersion } as never);

type C = ReturnType<typeof render>;
const montar = (esAdmin = false) => render(<ResumenPlanta empresaId={EMP} repo={repo as never} esAdmin={esAdmin} />);
const montarYCargar = async (esAdmin = false) => { const c = montar(esAdmin); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); return c; };
const texto = (c: C, id: string) => c.getByTestId(id).textContent ?? '';
function diferido<T>() {
  let resolver!: (v: T) => void; let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  repo.listarTodosLosResumenes.mockResolvedValue(TRES_PIEZAS);
  repo.listarMaquinas.mockResolvedValue(maquinasDoc);
  repo.leerReglas.mockResolvedValue(reglas(0));
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('1. KPIs', () => {
  it('3 piezas · USD 16.000 · 25 % herramientas (incluye cambios) · ahorro potencial USD 2.600 (16 % del costo)', async () => {
    const c = await montarYCargar();
    expect(texto(c, 'kpi-piezas')).toContain('3');
    expect(texto(c, 'kpi-costo-anual')).toContain('USD 16.000');
    expect(texto(c, 'kpi-pct-herramientas')).toContain('25 %');
    expect(texto(c, 'kpi-pct-herramientas')).toContain('Incluye cambios');
    expect(texto(c, 'kpi-ahorro')).toContain('USD 2.600');
    expect(texto(c, 'kpi-ahorro')).toContain('16 % del costo');
    expect(texto(c, 'kpi-ahorro')).toContain('Ahorro potencial');
  });
  it('nunca dice "Oportunidades"', async () => {
    const c = await montarYCargar();
    expect(c.container.textContent).not.toMatch(/Oportunidad/i);
  });
});

describe('2. Dónde está tu mayor costo', () => {
  it('2 de 3 piezas = 80 % del costo (A sola es 62,5 %; A + B, 87,5 %)', async () => {
    const c = await montarYCargar();
    expect(texto(c, 'linea-pareto')).toBe('2 de 3 piezas = 80 % del costo de mecanizado.');
  });
  it('la pieza más cara del año es A-001 Zeta con USD 10.000/año', async () => {
    const c = await montarYCargar();
    expect(texto(c, 'linea-pieza-cara')).toBe('Pieza más cara del año: A-001 Zeta · USD 10.000/año.');
  });
  it('la máquina con más costo muestra el NOMBRE (Torno CNC, USD 10.000/año) y el rubro principal de la planta (tiempo de corte)', async () => {
    const c = await montarYCargar();
    expect(texto(c, 'linea-maquina')).toBe('Máquina con más costo: Torno CNC (USD 10.000/año) · rubro principal de la planta: tiempo de corte.');
    expect(texto(c, 'linea-maquina')).not.toContain('m1');
  });
  it('una máquina que ya no existe se muestra con su id y "(eliminada)"', async () => {
    repo.listarMaquinas.mockResolvedValue([{ id: 'm2', nombre: 'Centro vertical', costoHora: 1 }]);
    const c = await montarYCargar();
    expect(texto(c, 'linea-maquina')).toContain('m1 (eliminada)');
  });
});

describe('3. Top 10 piezas', () => {
  it('ordenadas por costo anual: A 10.000 · B 4.000 · C 2.000, con % acumulado 62,5 · 87,5 · 100', async () => {
    const c = await montarYCargar();
    const filas = c.getAllByTestId('fila-top');
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining('A-001 · ZetaUSD 10.00062,5 % acum.'),
      expect.stringContaining('B-002 · AlfaUSD 4.00087,5 % acum.'),
      expect.stringContaining('C-003 · MuUSD 2.000100,0 % acum.'),
    ]);
  });
  it('las barras son proporcionales a la más cara (100 % · 40 % · 20 %)', async () => {
    const c = await montarYCargar();
    expect(c.getAllByTestId('barra-top').map((b) => (b as HTMLElement).style.width)).toEqual(['100%', '40%', '20%']);
  });
  it('las barras se apilan por rubro con los colores del diagnóstico (corte #12305a…)', async () => {
    const c = await montarYCargar();
    const barraA = c.getAllByTestId('barra-top')[0];
    expect(barraA.children).toHaveLength(6); // los 6 rubros de A pesan más de 0,5 %
    expect(barraA.innerHTML).toContain('bg-[#12305a]');
    expect(barraA.innerHTML).toContain('bg-[#e3a008]');
    // corte de A = 5.000 de 10.000 = 50 % del ancho
    expect((barraA.children[0] as HTMLElement).style.width).toBe('50%');
  });
  it('clic en una pieza la abre (enlace al Diagnóstico)', async () => {
    const c = await montarYCargar();
    expect(within(c.getAllByTestId('fila-top')[1]).getByRole('link').getAttribute('href')).toBe('/costos/piezas/b');
  });
  it('con más de 10 piezas muestra solo las 10 primeras', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ ...PIEZA_C, id: `x${i}`, codigo: `X-${i}`, resumen: { ...PIEZA_C.resumen, costoAnual: 1000 - i } })));
    const c = await montarYCargar();
    expect(c.getAllByTestId('fila-top')).toHaveLength(10);
  });
});

describe('4. Costo anual por máquina y por rubro', () => {
  it('por máquina (con el nombre): Torno CNC USD 10.000 (63 %) · Centro vertical USD 6.000 (38 %)', async () => {
    const c = await montarYCargar();
    const barras = c.getAllByTestId('barra-maquina').map((b) => b.textContent);
    expect(barras).toEqual(['Torno CNCUSD 10.000 63 %', 'Centro verticalUSD 6.000 38 %']);
  });
  it('por rubro, de mayor a menor: corte 8.000 · herramientas 3.150 · tiempos muertos 1.700 · scrap 1.350 · preparación 950 · cambios 850', async () => {
    const c = await montarYCargar();
    const barras = c.getAllByTestId('barra-rubro-planta');
    expect(barras.map((b) => b.getAttribute('data-rubro'))).toEqual(['corte', 'herramientas', 'tiemposMuertos', 'scrap', 'preparacion', 'cambios']);
    expect(barras.map((b) => b.textContent)).toEqual([
      'Tiempo de corteUSD 8.000 50 %', 'Herramientas (consumo)USD 3.150 20 %', 'Tiempos muertosUSD 1.700 11 %',
      'ScrapUSD 1.350 8 %', 'PreparaciónUSD 950 6 %', 'Cambios de herr.USD 850 5 %',
    ]);
  });
});

describe('7. Estados', () => {
  it('cargando: solo el estado de carga, sin KPIs ni tabla ni mensajes equivocados', () => {
    repo.listarTodosLosResumenes.mockReturnValue(new Promise(() => {}));
    const c = montar();
    expect(c.getByTestId('planta-cargando')).toBeTruthy();
    for (const id of ['kpis-planta', 'tabla-piezas', 'planta-vacia', 'planta-error', 'resumen-planta']) expect(c.queryByTestId(id)).toBeNull();
  });
  it('error de lectura: aviso y "Reintentar" vuelve a leer', async () => {
    repo.listarTodosLosResumenes.mockRejectedValueOnce(new Error('permission-denied'));
    const c = await montarYCargar();
    expect(texto(c, 'planta-error')).toContain('No se pudieron leer las piezas.');
    expect(c.queryByTestId('kpis-planta')).toBeNull();
    fireEvent.click(c.getByText('Reintentar'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(c.getByTestId('kpis-planta')).toBeTruthy();
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(2);
  });
  it('empresa sin piezas: mensaje claro y "+ Nueva pieza"', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([]);
    const c = await montarYCargar();
    expect(texto(c, 'planta-vacia')).toContain('Todavía no cargaste piezas');
    expect(c.getByText('+ Nueva pieza').closest('a')?.getAttribute('href')).toBe('/costos/piezas/nueva');
    expect(c.queryByTestId('kpis-planta')).toBeNull();
  });
  it('lee UNA sola vez al entrar; filtrar y ordenar no vuelven a leer', async () => {
    const c = await montarYCargar();
    fireEvent.change(c.getByLabelText('Buscar por código o nombre'), { target: { value: 'alfa' } });
    fireEvent.click(c.getByTestId('ordenar-codigo'));
    fireEvent.change(c.getByLabelText('Pasa por la máquina'), { target: { value: 'm1' } });
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(1);
    expect(repo.listarMaquinas).toHaveBeenCalledTimes(1);
    expect(repo.leerReglas).toHaveBeenCalledTimes(1);
  });
  it('al volver a la pantalla (se monta de nuevo) lee de nuevo y refleja lo guardado', async () => {
    const primera = await montarYCargar();
    expect(texto(primera, 'kpi-costo-anual')).toContain('USD 16.000');
    primera.unmount();
    repo.listarTodosLosResumenes.mockResolvedValue([{ ...PIEZA_A, resumen: { ...PIEZA_A.resumen, costoPieza: 12, costoAnual: 12000 } }, PIEZA_B, PIEZA_C]); // A pasa de 10 a 12 USD/pza (1.000 pzs): 12.000 + 4.000 + 2.000
    const segunda = await montarYCargar();
    expect(texto(segunda, 'kpi-costo-anual')).toContain('USD 18.000');
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(2);
  });
  it('una pieza sin resumen no entra en los cálculos de la planta y se cuenta como desactualizada', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([PIEZA_A, { ...PIEZA_B, resumen: undefined as never }]);
    const c = await montarYCargar();
    expect(texto(c, 'kpi-piezas')).toContain('1');
    expect(texto(c, 'kpi-costo-anual')).toContain('USD 10.000');
    expect(texto(c, 'aviso-desactualizadas')).toContain('1 pieza tiene el resumen calculado con reglas anteriores');
  });
});

describe('6. Resumen desactualizado y "Recalcular resúmenes"', () => {
  const conViejas = () => {
    repo.leerReglas.mockResolvedValue(reglas(500));
    repo.listarTodosLosResumenes.mockResolvedValue([
      { ...PIEZA_A, resumen: { ...PIEZA_A.resumen, reglasVersion: 100 } }, // vieja
      { ...PIEZA_B, resumen: { ...PIEZA_B.resumen, reglasVersion: 500 } }, // al día
      { ...PIEZA_C, resumen: { ...PIEZA_C.resumen, reglasVersion: 500, calcVersion: CALC_VERSION - 1 } }, // fórmulas viejas
    ]);
  };
  it('muestra el conteo arriba y la insignia solo en las piezas desactualizadas (reglas o calcVersion)', async () => {
    conViejas();
    const c = await montarYCargar(true);
    expect(texto(c, 'aviso-desactualizadas')).toContain('2 piezas tienen el resumen calculado con reglas anteriores');
    const insignias = c.getAllByTestId('fila-pieza').map((f) => [f.querySelector('a')?.textContent, !!within(f).queryByTestId('insignia-reglas-fila')]);
    expect(insignias).toEqual([['A-001', true], ['B-002', false], ['C-003', true]]);
  });
  it('sin piezas desactualizadas: ni aviso ni botón', async () => {
    const c = await montarYCargar(true);
    expect(c.queryByTestId('aviso-desactualizadas')).toBeNull();
    expect(c.queryByText('Recalcular resúmenes')).toBeNull();
    expect(c.queryByTestId('insignia-reglas-fila')).toBeNull();
  });
  it('el botón "Recalcular resúmenes" lo ve SOLO el admin SECOCUT (los demás ven el aviso y las insignias)', async () => {
    conViejas();
    const noAdmin = await montarYCargar(false);
    expect(noAdmin.getByTestId('aviso-desactualizadas')).toBeTruthy();
    expect(noAdmin.getAllByTestId('insignia-reglas-fila')).toHaveLength(2);
    expect(noAdmin.queryByText('Recalcular resúmenes')).toBeNull();
    cleanup();
    conViejas();
    const admin = await montarYCargar(true);
    expect(admin.getByText('Recalcular resúmenes')).toBeTruthy();
  });
  it('mientras corre queda deshabilitado; al terminar informa cuántas se recalcularon y recarga la lista', async () => {
    conViejas();
    const d = diferido<{ recalculadas: number; fallidas: number }>();
    repo.recalcularResumenesDesactualizados.mockReturnValue(d.promesa);
    const c = await montarYCargar(true);
    fireEvent.click(c.getByText('Recalcular resúmenes'));
    const boton = c.getByText('Recalculando…') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(repo.recalcularResumenesDesactualizados).toHaveBeenCalledWith(EMP);
    // al terminar, la lista recargada ya viene al día
    repo.listarTodosLosResumenes.mockResolvedValue(TRES_PIEZAS.map((f) => ({ ...f, resumen: { ...f.resumen, reglasVersion: 500 } })));
    await act(async () => { d.resolver({ recalculadas: 2, fallidas: 0 }); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(repo.listarTodosLosResumenes).toHaveBeenCalledTimes(2);
    expect(texto(c, 'resultado-recalculo-planta')).toBe('Se recalcularon 2 piezas');
    expect(c.queryByTestId('aviso-desactualizadas')).toBeNull();
    expect(c.queryByTestId('insignia-reglas-fila')).toBeNull();
  });
  it('con fallidas: "M no se pudieron recalcular" y "Reintentar" (que vuelve a correr el recálculo)', async () => {
    conViejas();
    repo.recalcularResumenesDesactualizados.mockResolvedValueOnce({ recalculadas: 1, fallidas: 1 }).mockResolvedValueOnce({ recalculadas: 1, fallidas: 0 });
    const c = await montarYCargar(true);
    fireEvent.click(c.getByText('Recalcular resúmenes'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(texto(c, 'resultado-recalculo-planta')).toBe('Se recalculó 1 pieza · 1 no se pudieron recalcular');
    fireEvent.click(c.getByTestId('reintentar-recalculo-planta'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(repo.recalcularResumenesDesactualizados).toHaveBeenCalledTimes(2);
    expect(texto(c, 'resultado-recalculo-planta')).toContain('Se recalculó 1 pieza');
  });
  it('si el recálculo falla por completo: avisa y permite reintentar', async () => {
    conViejas();
    repo.recalcularResumenesDesactualizados.mockRejectedValueOnce(new Error('permission-denied'));
    const c = await montarYCargar(true);
    fireEvent.click(c.getByText('Recalcular resúmenes'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(texto(c, 'error-recalculo-planta')).toBe('No se pudo recalcular. Reintentá.');
    expect(c.getByTestId('reintentar-recalculo-planta')).toBeTruthy();
    expect((c.getByText('Recalcular resúmenes') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Mejoras realizadas vs potencial (tarjeta del tablero)', () => {
  const con = (f: (typeof TRES_PIEZAS)[number], parcial: Record<string, unknown>) => ({ ...f, resumen: { ...f.resumen, ...parcial } });
  it('Logrado 700 · Pendiente 2.600 · Potencial total 3.300 · 21 % · 3 implementadas; 1 pieza sin línea base; 1 desactualizada; última mejora de la planta', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([
      con(PIEZA_A, { logradoAnual: 1000, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 1, ultimaMejoraFecha: '2026-10-20T12:00:00.000Z', ultimaMejoraPor: 'ana@secocut.com' }),
      con(PIEZA_B, { logradoAnual: -300, tieneLineaBase: true, ahorroPotencialAnual: 500, cantImplementadas: 2, ultimaMejoraFecha: '2026-10-25T12:00:00.000Z', ultimaMejoraPor: 'luis@secocut.com' }),
      con(PIEZA_C, { logradoAnual: 0, tieneLineaBase: false, ahorroPotencialAnual: 100, cantImplementadas: 0 }),
      { ...PIEZA_C, id: 'd', codigo: 'D-004', resumen: { ...PIEZA_C.resumen, logradoAnual: 999, tieneLineaBase: true, ahorroPotencialAnual: 999, cantImplementadas: 9, calcVersion: CALC_VERSION - 1 } },
    ]);
    const c = await montarYCargar();
    expect(texto(c, 'tablero-logrado')).toContain('USD 700');
    expect(texto(c, 'tablero-logrado')).toContain('3 mejoras implementadas');
    expect(texto(c, 'tablero-pendiente')).toContain('USD 2.600');
    expect(texto(c, 'tablero-potencial-total')).toContain('USD 3.300');
    expect(texto(c, 'tablero-pct-logrado')).toContain('21 %'); // 700 / 3.300 = 21,2 %
    expect(texto(c, 'tablero-sin-linea-base')).toBe('1 pieza sin línea base (no suma al logrado).');
    expect(texto(c, 'tablero-excluidas')).toBe('No incluye 1 pieza con el resumen calculado con reglas anteriores.');
    expect(texto(c, 'tablero-ultima-mejora')).toMatch(/^Última mejora de la planta: \d{2}\/\d{2}\/2026, luis@secocut\.com, pieza B-002$/);
    expect(c.getByTestId('aviso-desactualizadas')).toBeTruthy();
  });
  it('sin implementaciones ni línea base: Logrado USD 0, las 3 piezas "sin línea base" y sin última mejora', async () => {
    const c = await montarYCargar();
    expect(texto(c, 'tablero-logrado')).toContain('USD 0');
    expect(texto(c, 'tablero-pendiente')).toContain('USD 2.600');
    expect(texto(c, 'tablero-pct-logrado')).toContain('0 %');
    expect(texto(c, 'tablero-sin-linea-base')).toBe('3 piezas sin línea base (no suman al logrado).');
    expect(c.queryByTestId('tablero-ultima-mejora')).toBeNull();
    expect(c.queryByTestId('tablero-excluidas')).toBeNull();
  });
  it('un logrado negativo se muestra negativo', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([con(PIEZA_A, { logradoAnual: -500, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 1 })]);
    const c = await montarYCargar();
    expect(texto(c, 'tablero-logrado')).toContain('USD −500');
    expect(texto(c, 'tablero-potencial-total')).toContain('USD 1.500');
    expect(c.queryByTestId('tablero-sin-linea-base')).toBeNull();
  });
});

describe('Mejoras realizadas vs potencial: aviso de logrado sin mejoras registradas', () => {
  const con = (f: (typeof TRES_PIEZAS)[number], parcial: Record<string, unknown>) => ({ ...f, resumen: { ...f.resumen, ...parcial } });
  it('logrado total > 0 y 0 mejoras implementadas: aviso corto debajo de las cifras, sin cambiar ninguna cifra', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([con(PIEZA_A, { logradoAnual: 1000, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 0 })]);
    const c = await montarYCargar();
    expect(texto(c, 'tablero-logrado-sin-mejoras')).toBe('Hay ahorro sin mejoras registradas: puede ser una corrección de datos o falta registrar qué se cambió.');
    expect(texto(c, 'tablero-logrado')).toContain('USD 1.000');
    expect(texto(c, 'tablero-pendiente')).toContain('USD 2.000');
    expect(texto(c, 'tablero-potencial-total')).toContain('USD 3.000');
  });
  it('con al menos 1 mejora implementada, o con logrado 0, no se muestra', async () => {
    repo.listarTodosLosResumenes.mockResolvedValue([con(PIEZA_A, { logradoAnual: 1000, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 1 })]);
    expect((await montarYCargar()).queryByTestId('tablero-logrado-sin-mejoras')).toBeNull();
    cleanup();
    repo.listarTodosLosResumenes.mockResolvedValue([con(PIEZA_A, { logradoAnual: 0, tieneLineaBase: true, ahorroPotencialAnual: 2000, cantImplementadas: 0 })]);
    expect((await montarYCargar()).queryByTestId('tablero-logrado-sin-mejoras')).toBeNull();
  });
});
