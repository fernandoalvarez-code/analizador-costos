// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import { hoyISO } from '@/components/costos/implementaciones-dialogs';
import { numero, usd0, usd4 } from '@/components/costos/formato';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type Implementacion, type LineaBase, type Pieza } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Línea base y ahorro logrado continuo, hitos de mejoras realizadas y formato de decimales. Oráculos de CAR-001: 9,3570235 USD/pza,
// 25.000 piezas/año, 233.926 USD/año, 10 mejoras y USD 44.015 de ahorro potencial. Con Op20 al 80 % del corte: 8,8624736 USD/pza → logrado
// (9,3570235 − 8,8624736) × 25.000 = 12.363,75 USD/año.
// FRÁGIL: depende de los textos de implementaciones-dialogs.tsx y del recuadro "Ahorro logrado" de diagnostico-pieza.tsx.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const USUARIO = { uid: 'u1', email: 'ana@secocut.com' };
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };
const NOTA = 'Se subió el avance de la fresa de alto avance';
const COSTO_BASE = 9.3570235;
const TEXTO_SIN_LINEA_BASE = 'Sin línea base: todavía no se mide el ahorro logrado. Fijala cuando la carga de la pieza esté terminada y validada.';
const AVISO_REHACER = 'Esto reinicia el acumulado de ahorro logrado: lo logrado hasta ahora se pierde como acumulado (los hitos quedan en el historial).';

const implementacion = (over: Partial<Implementacion> = {}): Implementacion => ({
  id: 'i1', categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', titulo: 'El tiempo de corte domina la operación',
  fecha: '2026-10-20', nota: NOTA, por: 'u9', porEmail: 'luis@secocut.com', registradaEn: '2026-10-20T15:00:00.000Z', costoPiezaAntes: 9.357, ahorroEstimadoAnual: 12000, ...over,
});
const lineaBase = (over: Partial<LineaBase> = {}): LineaBase => ({
  costoPiezaBase: COSTO_BASE, fecha: '2026-10-19T15:00:00.000Z', por: 'u9', porEmail: 'luis@secocut.com', volumenAnualBase: 25000, ...over,
});
/** Op20 con 20 % menos de corte (las dos herramientas): 8,8624736 USD/pza. */
const corteAl80 = (p: Pieza) => { for (const h of p.operaciones.find((o) => o.id === 'op20')!.herramientas) h.opciones[0].cortePorPiezaMin *= 0.8; };
const carcasa = (ajustar?: (p: Pieza) => void): PiezaDoc => {
  const p = crearCarcasa();
  ajustar?.(p);
  return { ...p, id: 'car-001' } as PiezaDoc;
};
const montar = (inicial: PiezaDoc | null = carcasa()) =>
  render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} usuario={USUARIO} />);
type C = ReturnType<typeof render>;
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const ultimaGuardada = () => repo.actualizarPieza.mock.calls.at(-1)![2] as Pieza;
const dialogo = (id: string) => within(document.body).getByTestId(id);
const botonImplementada = (c: C, indice = 0) => within(c.getAllByTestId('mejora')[indice]).getByText('Marcar como implementada') as HTMLButtonElement;
const botonLineaBase = (c: C) => c.getByTestId('boton-linea-base') as HTMLButtonElement;
const abrirRealizadas = (c: C) => fireEvent.click(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas/ }));
const fechaLocal = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const montoLogrado = (c: C) => Number((c.getByTestId('valor-logrado').textContent ?? '').replace(/^USD /, '').replace(/\./g, '').replace('−', '-'));
function registrar(c: C, nota = NOTA, fecha?: string, indiceMejora = 0) {
  fireEvent.click(botonImplementada(c, indiceMejora));
  if (fecha) fireEvent.change(within(dialogo('dialogo-implementada')).getByLabelText('Fecha en que se implementó'), { target: { value: fecha } });
  fireEvent.change(within(dialogo('dialogo-implementada')).getByLabelText('Qué se cambió (obligatorio)'), { target: { value: nota } });
  fireEvent.click(within(dialogo('dialogo-implementada')).getByTestId('confirmar-implementada'));
}
function fijarLineaBase(c: C, nota?: string) {
  fireEvent.click(botonLineaBase(c));
  if (nota) fireEvent.change(within(dialogo('dialogo-linea-base')).getByLabelText('Nota (opcional)'), { target: { value: nota } });
  fireEvent.click(within(dialogo('dialogo-linea-base')).getByTestId('confirmar-linea-base'));
}
/** Escribe en la pantalla de datos el corte de Op20 y vuelve al Diagnóstico. */
function cargarCorteOp20(c: C, cortes: [string, string]) {
  fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
  if (!c.queryByTestId('operacion-editor')) fireEvent.click(c.getByLabelText('Editar Desbaste y contorno')); // si ya estaba abierta, el clic la cerraría
  const campos = within(c.getByTestId('operacion-editor')).getAllByLabelText('Corte por pieza (mm:ss)') as HTMLInputElement[];
  for (const [i, valor] of cortes.entries()) { fireEvent.focus(campos[i]); fireEvent.change(campos[i], { target: { value: valor } }); }
  fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(repo).forEach((f) => f.mockReset());
  repo.actualizarPieza.mockResolvedValue(undefined);
  repo.listarTodosLosResumenes.mockResolvedValue([]);
  repo.obtenerPieza.mockResolvedValue(null);
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('sin línea base', () => {
  it('el recuadro "Ahorro logrado" avisa que todavía no se mide, muestra solo el potencial y no muestra "Logrado"', () => {
    const c = montar();
    const recuadro = within(c.getByTestId('ahorro-logrado'));
    expect(recuadro.getByTestId('sin-linea-base').textContent).toBe(TEXTO_SIN_LINEA_BASE);
    expect(recuadro.getByTestId('potencial-sin-linea-base').textContent).toBe('Potencial ≈ USD 44.015/año (10 mejoras activas)');
    expect(c.queryByTestId('texto-logrado-pendiente')).toBeNull();
    expect(c.queryByTestId('valor-logrado')).toBeNull();
    expect(botonLineaBase(c).textContent).toBe('Fijar línea base');
    // lo de siempre
    expect(c.getByTestId('potencial').textContent).toContain('10 mejoras en esta pieza');
    expect(c.getByTestId('potencial').textContent).toContain('USD 44.015/año');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
  });
  it('MIGRACIÓN: una pieza con hitos del Prompt 9 y sin línea base los muestra como historial, no tiene logrado y pide fijarla', () => {
    const c = montar(carcasa((p) => { corteAl80(p); p.implementaciones = [implementacion({ costoPiezaAntes: 9.357 })]; }));
    expect(c.getByTestId('sin-linea-base').textContent).toBe(TEXTO_SIN_LINEA_BASE);
    expect(c.queryByTestId('valor-logrado')).toBeNull(); // no se inventa una línea base a partir de costoPiezaAntes
    expect(botonLineaBase(c).textContent).toBe('Fijar línea base');
    abrirRealizadas(c);
    expect(c.getAllByTestId('mejora-realizada')).toHaveLength(1);
    expect(c.getByTestId('nota-realizada').textContent).toBe(NOTA);
  });
});

describe('fijar la línea base', () => {
  it('con la pieza guardada y sin cambios está habilitado; con cambios sin guardar, deshabilitado con "Guardá la pieza primero" y "Marcar como implementada" sigue habilitado', async () => {
    const c = montar();
    expect(botonLineaBase(c).disabled).toBe(false);
    expect(c.queryByTestId('leyenda-guardar-primero')).toBeNull();
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.change(c.getAllByLabelText('Nombre')[0], { target: { value: 'Carcasa v2' } });
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.getByTestId('estado-pieza').textContent).toBe('Cambios sin guardar');
    expect(botonLineaBase(c).disabled).toBe(true);
    expect(botonLineaBase(c).title).toBe('Guardá la pieza primero');
    expect(c.getByTestId('leyenda-guardar-primero').textContent).toBe('Guardá la pieza primero.');
    expect(botonImplementada(c).disabled).toBe(false); // ya no exige estado guardado
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('estado-pieza').textContent).toBe('Guardado');
    expect(botonLineaBase(c).disabled).toBe(false);
  });
  it('una pieza nueva (sin guardar) no puede fijar la línea base', () => {
    const c = montar(null);
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.queryByTestId('boton-linea-base') === null || (c.getByTestId('boton-linea-base') as HTMLButtonElement).disabled).toBe(true);
  });
  it('el diálogo no usa window.confirm, muestra el costo actual y no trae el aviso de reinicio (todavía no hay línea base)', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar();
    fireEvent.click(botonLineaBase(c));
    expect(within(dialogo('dialogo-linea-base')).getByText('Fijar línea base', { selector: 'h2' })).toBeTruthy();
    expect(dialogo('dialogo-linea-base').textContent).toContain('USD 9,3570 por pieza');
    expect(within(document.body).queryByTestId('aviso-rehacer-linea-base')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });
  it('al fijarla: muestra costo, fecha y quién; logrado 0, pendiente 44.015 y "Todavía no se registraron mejoras"; se guarda en la pieza', async () => {
    const c = montar();
    fijarLineaBase(c, 'Carga validada con el jefe de planta');
    expect(c.queryByTestId('sin-linea-base')).toBeNull();
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toBe('Logrado ≈ USD 0/año · Pendiente ≈ USD 44.015/año · Potencial total USD 44.015/año');
    expect(c.getByTestId('linea-base-info').textContent).toBe(`Línea base: USD 9,3570 por pieza, fijada el ${fechaLocal(new Date())} por ana@secocut.com — Carga validada con el jefe de planta`);
    expect(c.getByTestId('ultima-mejora').textContent).toBe('Todavía no se registraron mejoras');
    expect(botonLineaBase(c).textContent).toBe('Rehacer línea base');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    const lb = ultimaGuardada().lineaBase!;
    expect(lb.costoPiezaBase).toBeCloseTo(COSTO_BASE, 6);
    expect(lb).toMatchObject({ por: 'u1', porEmail: 'ana@secocut.com', volumenAnualBase: 25000, nota: 'Carga validada con el jefe de planta' });
    expect(Number.isNaN(Date.parse(lb.fecha))).toBe(false);
    expect(ultimaGuardada().lineasBaseAnteriores).toBeUndefined();
  });
  it('sin nota, la línea base no lleva el campo nota', async () => {
    const c = montar();
    fijarLineaBase(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect('nota' in ultimaGuardada().lineaBase!).toBe(false);
    expect(c.getByTestId('linea-base-info').textContent).not.toContain('—');
  });
});

describe('el logrado crece con los datos, sin registrar nada', () => {
  it('línea base 9,3570235 y datos nuevos de Op20 al 80 %: logrado ≈ USD 12.364 (= 12.363,75), sin implementaciones registradas', async () => {
    const c = montar();
    fijarLineaBase(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    cargarCorteOp20(c, ['1:55', '0:38']); // 2:24 → 1:55 (≈ −20 %), 0:48 → 0:38 (≈ −20 %)
    expect(montoLogrado(c)).toBeGreaterThan(5000);
    expect(c.getByTestId('ultima-mejora').textContent).toBe('Todavía no se registraron mejoras');
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain('Pendiente ≈');
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });
  it('con la pieza literal al 80 % y la línea base: Logrado ≈ USD 12.364 exacto al mostrar', () => {
    const c = montar(carcasa((p) => { corteAl80(p); p.lineaBase = lineaBase(); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 12.364'); // 12.363,75
  });
  it('un segundo cambio de datos sigue acumulando: Op20 al 60 % → 24.727,50 (el doble, el modelo es lineal en el corte)', () => {
    const c = montar(carcasa((p) => { for (const h of p.operaciones.find((o) => o.id === 'op20')!.herramientas) h.opciones[0].cortePorPiezaMin *= 0.6; p.lineaBase = lineaBase(); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 24.727'); // 24.727,495
  });
  it('un logrado negativo se muestra negativo, no 0: línea base 9,0000 con la pieza en 9,3570235 → (9 − 9,3570235) × 25.000 = −8.925,59 ≈ −8.926', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase({ costoPiezaBase: 9 }); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD −8.926');
    expect(c.getByTestId('valor-logrado').className).toContain('text-red-700');
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBe(0);
  });
});

describe('rehacer la línea base', () => {
  const conLogro = () => carcasa((p) => { corteAl80(p); p.lineaBase = lineaBase(); });
  it('el diálogo avisa que reinicia el acumulado y exige confirmar: cancelar no cambia nada', () => {
    const c = montar(conLogro());
    expect(botonLineaBase(c).textContent).toBe('Rehacer línea base');
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 12.364');
    fireEvent.click(botonLineaBase(c));
    expect(within(dialogo('dialogo-linea-base')).getByTestId('aviso-rehacer-linea-base').textContent).toBe(AVISO_REHACER);
    fireEvent.click(within(dialogo('dialogo-linea-base')).getByText('Cancelar'));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 12.364');
    expect(c.queryByTestId('estado-pieza')).toBeNull(); // cancelar no cambió nada: sin cambios pendientes
  });
  it('al confirmar: el logrado vuelve a 0, la anterior queda en lineasBaseAnteriores y se guarda', async () => {
    const c = montar(conLogro());
    fijarLineaBase(c, 'Nueva etapa');
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 0');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    const g = ultimaGuardada();
    expect(g.lineaBase!.costoPiezaBase).toBeCloseTo(8.8624736, 6); // el costo actual
    expect(g.lineaBase!.nota).toBe('Nueva etapa');
    expect(g.lineasBaseAnteriores).toHaveLength(1);
    expect(g.lineasBaseAnteriores![0]).toMatchObject({ costoPiezaBase: COSTO_BASE, porEmail: 'luis@secocut.com' });
  });
  it('rehacer dos veces acumula el historial en orden', async () => {
    const c = montar(conLogro());
    fijarLineaBase(c, 'Segunda');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    fijarLineaBase(c, 'Tercera');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().lineasBaseAnteriores!.map((l) => l.nota)).toEqual([undefined, 'Segunda']);
    expect(ultimaGuardada().lineaBase!.nota).toBe('Tercera');
  });
});

describe('diálogo de registrar una mejora', () => {
  it('muestra el aviso nuevo ("queda como historial"), la fecha de hoy por defecto y no usa window.confirm', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar();
    fireEvent.click(botonImplementada(c));
    expect(within(dialogo('dialogo-implementada')).getByTestId('aviso-punto-de-partida').textContent).toBe('Registrá qué se cambió: queda como historial de la pieza.');
    expect(dialogo('dialogo-implementada').textContent).not.toContain('ANTES de cargar');
    const fecha = within(dialogo('dialogo-implementada')).getByLabelText('Fecha en que se implementó') as HTMLInputElement;
    expect(fecha.value).toBe(hoyISO());
    expect(fecha.max).toBe(hoyISO());
    expect(confirmar).not.toHaveBeenCalled();
  });
  it.each([['vacía', ''], ['solo espacios', '      '], ['de 4 caracteres', 'abcd']])('nota %s: no se acepta, con error visible, y no se registra nada', (_n, nota) => {
    const c = montar();
    registrar(c, nota);
    expect(within(dialogo('dialogo-implementada')).getByTestId('error-nota').textContent).toBe('La nota es obligatoria: escribí al menos 5 caracteres sobre qué se cambió.');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
  });
  it('con 5 caracteres se acepta', () => {
    const c = montar();
    registrar(c, 'abcde');
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
  });
  it('fecha futura: no se acepta; fecha vacía tampoco; una fecha pasada sí', () => {
    const c = montar();
    const manana = new Date(); manana.setDate(manana.getDate() + 1);
    const yyyy = manana.getFullYear(); const mm = String(manana.getMonth() + 1).padStart(2, '0'); const dd = String(manana.getDate()).padStart(2, '0');
    registrar(c, NOTA, `${yyyy}-${mm}-${dd}`);
    expect(within(dialogo('dialogo-implementada')).getByTestId('error-fecha').textContent).toBe('La fecha no puede ser futura.');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
    fireEvent.change(within(dialogo('dialogo-implementada')).getByLabelText('Fecha en que se implementó'), { target: { value: '' } });
    fireEvent.click(within(dialogo('dialogo-implementada')).getByTestId('confirmar-implementada'));
    expect(within(dialogo('dialogo-implementada')).getByTestId('error-fecha').textContent).toBe('Ingresá la fecha en que se implementó.');
    fireEvent.change(within(dialogo('dialogo-implementada')).getByLabelText('Fecha en que se implementó'), { target: { value: '2020-01-01' } });
    fireEvent.click(within(dialogo('dialogo-implementada')).getByTestId('confirmar-implementada'));
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
  });
});

describe('registrar una mejora (hito del historial)', () => {
  it('queda "Mejoras realizadas (1)" con fecha, nota, quién y estimado, SIN cifra de logro por hito; la mejora no desaparece de la lista', () => {
    const c = montar();
    registrar(c);
    expect(c.getByTestId('potencial').textContent).toContain('10 mejoras en esta pieza');
    expect(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas \(1\)/ }).getAttribute('aria-expanded')).toBe('false');
    abrirRealizadas(c);
    const item = within(c.getByTestId('mejora-realizada'));
    expect(item.getByTestId('categoria-realizada').textContent).toBe('Productividad');
    expect(c.getByTestId('mejora-realizada').textContent).toContain('Op 20 · Desbaste y contorno');
    expect(item.getByTestId('nota-realizada').textContent).toBe(NOTA);
    expect(item.getByTestId('fecha-realizada').textContent).toMatch(/^Implementada el \d{2}\/\d{2}\/\d{4}:/);
    expect(item.getByTestId('autor-realizada').textContent).toMatch(/^Registrada por ana@secocut\.com · /);
    expect(item.getByTestId('estimado-realizada').textContent).toBe('Estimado al registrar: ≈ USD 12.000/año');
    expect(item.queryByTestId('logrado-realizada')).toBeNull();
    expect(item.queryByTestId('sin-cambios-realizada')).toBeNull();
  });
  it('se guarda con el guardado automático (sin exigir pieza guardada): clave estable, fecha, nota, autor y estimado 12.000', async () => {
    const c = montar();
    registrar(c, NOTA, '2026-10-20');
    expect(c.getByTestId('estado-pieza').textContent).toBe('Cambios sin guardar');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('estado-pieza').textContent).toBe('Guardado');
    const g = ultimaGuardada().implementaciones!;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({
      categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', fecha: '2026-10-20', nota: NOTA, por: 'u1', porEmail: 'ana@secocut.com',
    });
    expect(g[0].posicionId).toBeUndefined();
    expect(g[0].costoPiezaAntes.toFixed(4)).toBe('9.3570'); // dato histórico
    expect(Math.round(g[0].ahorroEstimadoAnual)).toBe(12000);
  });
  it('se puede registrar con cambios sin guardar (no exige estado "Guardado")', () => {
    const c = montar();
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.change(c.getAllByLabelText('Nombre')[0], { target: { value: 'Carcasa v2' } });
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    registrar(c);
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
  });
  it('"Última mejora": con dos hitos muestra el más reciente por registradaEn, con su autor y fecha', () => {
    const c = montar(carcasa((p) => {
      p.lineaBase = lineaBase();
      p.implementaciones = [
        implementacion({ id: 'i2', registradaEn: '2026-10-25T15:00:00.000Z', porEmail: 'eva@secocut.com', nota: 'Segundo cambio, el más nuevo' }),
        implementacion({ id: 'i1', registradaEn: '2026-10-20T15:00:00.000Z', porEmail: 'luis@secocut.com', nota: 'Primer cambio' }),
      ];
    }));
    expect(c.getByTestId('ultima-mejora').textContent).toBe(`Última mejora: ${fechaLocal(new Date('2026-10-25T15:00:00.000Z'))}, eva@secocut.com — Segundo cambio, el más nuevo`);
  });
  it('registrar una mejora actualiza "Última mejora" con la fecha de hoy y quien la registró', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); }));
    expect(c.getByTestId('ultima-mejora').textContent).toBe('Todavía no se registraron mejoras');
    registrar(c, 'Cambio de avance en Op20');
    expect(c.getByTestId('ultima-mejora').textContent).toBe(`Última mejora: ${fechaLocal(new Date())}, ana@secocut.com — Cambio de avance en Op20`);
  });
  it('dos registros se agregan al final, en orden cronológico', async () => {
    const c = montar();
    registrar(c, 'Primer cambio en la fresa');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    registrar(c, 'Segundo cambio en la broca', '2026-10-21', 1); // otra mejora: registrar la MISMA sin cambiar el costo pide confirmar (ver mejoras-claridad.spec)
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().implementaciones!.map((i) => i.nota)).toEqual(['Primer cambio en la fresa', 'Segundo cambio en la broca']);
  });
  it('el flujo completo: fijar, cargar datos nuevos (logrado sube sin registrar), registrar la mejora y seguir acumulando con otro cambio', async () => {
    const c = montar();
    fijarLineaBase(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    cargarCorteOp20(c, ['1:55', '0:38']);
    const primero = montoLogrado(c);
    expect(primero).toBeGreaterThan(5000);
    registrar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('ultima-mejora').textContent).toMatch(/^Última mejora: \d{2}\/\d{2}\/\d{4}, ana@secocut\.com — Se subió el avance/);
    expect(montoLogrado(c)).toBe(primero); // registrar no cambia el logrado
    cargarCorteOp20(c, ['1:26', '0:29']); // otro ~25 % menos
    expect(montoLogrado(c)).toBeGreaterThan(primero);
  });
});

describe('anular el registro', () => {
  it('con confirmación en un diálogo propio: quita el hito y se guarda sin la entrada; la línea base no cambia', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); p.implementaciones = [implementacion()]; }));
    abrirRealizadas(c);
    fireEvent.click(c.getByText('Anular registro'));
    fireEvent.click(within(dialogo('dialogo-anular-implementacion')).getByText('Cancelar'));
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
    fireEvent.click(c.getByText('Anular registro'));
    fireEvent.click(within(dialogo('dialogo-anular-implementacion')).getByTestId('confirmar-anular-implementacion'));
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
    expect(c.getByTestId('ultima-mejora').textContent).toBe('Todavía no se registraron mejoras');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().implementaciones).toEqual([]);
    expect(ultimaGuardada().lineaBase!.costoPiezaBase).toBeCloseTo(COSTO_BASE, 6);
  });
});

describe('por operación', () => {
  it('Op20 lista sus hitos (fecha, nota y autor, sin cifra) y Op30 no', () => {
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ fecha: '2026-10-20' })]; }));
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.click(c.getByLabelText('Editar Desbaste y contorno'));
    const bloque = within(c.getByTestId('operacion-editor')).getByTestId('realizadas-operacion');
    expect(bloque.textContent).toContain('Mejoras realizadas en esta operación');
    expect(within(bloque).getByTestId('realizada-operacion').textContent).toBe(`20/10/2026 · Productividad: ${NOTA} — luis@secocut.com`);
    expect(bloque.textContent).not.toMatch(/USD/);
    fireEvent.click(c.getByLabelText('Editar Agujereado'));
    expect(within(c.getByTestId('operacion-editor')).queryByTestId('realizadas-operacion')).toBeNull();
  });
});

describe('formato de decimales: costo por pieza con 4 decimales, anuales enteros', () => {
  it('numero y usd4: 12,075 se ve USD 12,0750; los anuales con usd0 no llevan decimales', () => {
    expect(usd4(12.075)).toBe('USD 12,0750');
    expect(usd4(2.167)).toBe('USD 2,1670');
    expect(numero(9.35702, 4)).toBe('9,3570');
    expect(usd0(12000.4)).toBe('USD 12.000');
  });
  it('el banner "Mayor costo" muestra el costo por pieza con 4 decimales (USD 3,8959) y el anual entero', () => {
    const c = montar();
    expect(c.getByTestId('mayor-costo-detalle').textContent).toMatch(/^USD 3,8959 por pieza · USD 97\.399 por año/);
  });
  it('cada mejora muestra el ahorro por pieza con 4 decimales: Productividad Op20 = 20 % × 2,40 = USD 0,4800 por pieza', () => {
    const c = montar();
    expect(c.getAllByTestId('mejora')[0].textContent).toContain('USD 0,4800 por pieza');
    expect(c.getAllByTestId('mejora')[0].textContent).toContain('≈ USD 12.000/año');
  });
});
