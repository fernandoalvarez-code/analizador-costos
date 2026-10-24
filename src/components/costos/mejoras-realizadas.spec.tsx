// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import { hoyISO } from '@/components/costos/implementaciones-dialogs';
import { numero, usd0, usd4 } from '@/components/costos/formato';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type Implementacion, type Pieza } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Mejoras realizadas: registrar, medir el logro contra el potencial, anular, y el formato de decimales. Oráculos de CAR-001:
// 9,3570 USD/pza, 233.926 USD/año, 10 mejoras, ahorro potencial USD 44.015.
// FRÁGIL: depende de los textos de implementaciones-dialogs.tsx y de la sección "Mejoras realizadas" de diagnostico-pieza.tsx.
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

const implementacion = (over: Partial<Implementacion> = {}): Implementacion => ({
  id: 'i1', categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', titulo: 'El tiempo de corte domina la operación',
  fecha: '2026-10-20', nota: NOTA, por: 'u9', porEmail: 'luis@secocut.com', registradaEn: '2026-10-20T15:00:00.000Z', costoPiezaAntes: 9.357, ahorroEstimadoAnual: 12000, ...over,
});
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
const dialogo = () => within(document.body).getByTestId('dialogo-implementada');
const botonImplementada = (c: C, indice = 0) => within(c.getAllByTestId('mejora')[indice]).getByText('Marcar como implementada') as HTMLButtonElement;
const abrirRealizadas = (c: C) => fireEvent.click(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas/ }));
function registrar(c: C, nota = NOTA, fecha?: string) {
  fireEvent.click(botonImplementada(c));
  if (fecha) fireEvent.change(within(dialogo()).getByLabelText('Fecha en que se implementó'), { target: { value: fecha } });
  fireEvent.change(within(dialogo()).getByLabelText('Qué se cambió (obligatorio)'), { target: { value: nota } });
  fireEvent.click(within(dialogo()).getByTestId('confirmar-implementada'));
}
/** Op20 con 20 % menos de tiempo de corte, escrito en la pantalla de datos (los dos campos de corte por pieza de Op20). */
function cargarCorteNuevoOp20(c: C) {
  fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
  fireEvent.click(c.getByLabelText('Editar Desbaste y contorno'));
  const cortes = within(c.getByTestId('operacion-editor')).getAllByLabelText('Corte por pieza (mm:ss)') as HTMLInputElement[];
  for (const [i, valor] of ['1:55', '0:38'].entries()) { fireEvent.focus(cortes[i]); fireEvent.change(cortes[i], { target: { value: valor } }); } // 2:24 → 1:55 (≈ −20 %), 0:48 → 0:38
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

describe('sin implementaciones', () => {
  it('todo igual que antes: 10 mejoras, USD 44.015 y no hay sección de mejoras realizadas', () => {
    const c = montar();
    expect(c.getByTestId('potencial').textContent).toContain('10 mejoras en esta pieza');
    expect(c.getByTestId('potencial').textContent).toContain('USD 44.015/año');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
  });
});

describe('botón "Marcar como implementada"', () => {
  it('con la pieza guardada y sin cambios pendientes está habilitado', () => {
    const c = montar();
    expect(botonImplementada(c).disabled).toBe(false);
    expect(c.queryByTestId('leyenda-guardar-primero')).toBeNull();
  });
  it('con cambios sin guardar está deshabilitado con "Guardá la pieza primero"; al guardarse vuelve a habilitarse', async () => {
    const c = montar();
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.change(c.getAllByLabelText('Nombre')[0], { target: { value: 'Carcasa v2' } });
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.getByTestId('estado-pieza').textContent).toBe('Cambios sin guardar');
    expect(botonImplementada(c).disabled).toBe(true);
    expect(botonImplementada(c).title).toBe('Guardá la pieza primero');
    expect(c.getAllByTestId('leyenda-guardar-primero')[0].textContent).toBe('Guardá la pieza primero.');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('estado-pieza').textContent).toBe('Guardado');
    expect(botonImplementada(c).disabled).toBe(false);
  });
  it('una pieza nueva (sin guardar) no puede registrar', () => {
    const c = montar(null);
    fireEvent.click(c.getByRole('tab', { name: 'Diagnóstico' }));
    expect(c.queryAllByText('Marcar como implementada').length === 0 || c.queryAllByText('Marcar como implementada').every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe('diálogo', () => {
  it('muestra el aviso fijo, la fecha de hoy por defecto y no usa window.confirm', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar();
    fireEvent.click(botonImplementada(c));
    expect(within(dialogo()).getByTestId('aviso-punto-de-partida').textContent).toBe('Registrá la mejora ANTES de cargar los datos nuevos: el costo actual queda como punto de partida.');
    const fecha = within(dialogo()).getByLabelText('Fecha en que se implementó') as HTMLInputElement;
    expect(fecha.value).toBe(hoyISO());
    expect(fecha.max).toBe(hoyISO());
    expect(confirmar).not.toHaveBeenCalled();
  });
  it.each([['vacía', ''], ['solo espacios', '      '], ['de 4 caracteres', 'abcd']])('nota %s: no se acepta, con error visible, y no se registra nada', (_n, nota) => {
    const c = montar();
    registrar(c, nota);
    expect(within(dialogo()).getByTestId('error-nota').textContent).toBe('La nota es obligatoria: escribí al menos 5 caracteres sobre qué se cambió.');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
  });
  it('con 5 caracteres se acepta', () => {
    const c = montar();
    registrar(c, 'abcde');
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
  });
  it('fecha futura: no se acepta; fecha vacía tampoco', () => {
    const c = montar();
    const manana = new Date(); manana.setDate(manana.getDate() + 1);
    const yyyy = manana.getFullYear(); const mm = String(manana.getMonth() + 1).padStart(2, '0'); const dd = String(manana.getDate()).padStart(2, '0');
    registrar(c, NOTA, `${yyyy}-${mm}-${dd}`);
    expect(within(dialogo()).getByTestId('error-fecha').textContent).toBe('La fecha no puede ser futura.');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
    fireEvent.change(within(dialogo()).getByLabelText('Fecha en que se implementó'), { target: { value: '' } });
    fireEvent.click(within(dialogo()).getByTestId('confirmar-implementada'));
    expect(within(dialogo()).getByTestId('error-fecha').textContent).toBe('Ingresá la fecha en que se implementó.');
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
  });
  it('una fecha de ayer sí se acepta', () => {
    const c = montar();
    registrar(c, NOTA, '2020-01-01');
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy();
  });
});

describe('registrar una mejora', () => {
  it('queda "Mejoras realizadas (1)" con logrado 0 y "Aún sin cambios en los datos"; la mejora NO desaparece de la lista', () => {
    const c = montar();
    registrar(c);
    expect(c.getByTestId('potencial').textContent).toContain('10 mejoras en esta pieza'); // sigue sugerida
    const seccion = within(c.getByTestId('mejoras-realizadas'));
    expect(seccion.getByRole('button', { name: /Mejoras realizadas \(1\)/ }).getAttribute('aria-expanded')).toBe('false');
    expect(c.queryByTestId('mejora-realizada')).toBeNull(); // plegada
    abrirRealizadas(c);
    const item = within(c.getByTestId('mejora-realizada'));
    expect(item.getByTestId('categoria-realizada').textContent).toBe('Productividad');
    expect(c.getByTestId('mejora-realizada').textContent).toContain('Op 20 · Desbaste y contorno');
    expect(item.getByTestId('nota-realizada').textContent).toBe(NOTA);
    expect(item.getByTestId('fecha-realizada').textContent).toMatch(/^Implementada el \d{2}\/\d{2}\/\d{4}:/);
    expect(item.getByTestId('autor-realizada').textContent).toMatch(/^Registrada por ana@secocut\.com · /);
    expect(item.getByTestId('estimado-realizada').textContent).toBe('Estimado al registrar: ≈ USD 12.000/año · costo antes USD 9,3570 por pieza');
    expect(item.getByTestId('logrado-realizada').textContent).toContain('≈ USD 0/año');
    expect(item.getByTestId('sin-cambios-realizada').textContent).toBe('Aún sin cambios en los datos');
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toBe('Logrado ≈ USD 0/año · Pendiente ≈ USD 44.015/año · Potencial total USD 44.015/año');
  });
  it('se guarda con el guardado automático: punto de partida 9,3570, clave estable, fecha, nota, autor y estimado 12.000', async () => {
    const c = montar();
    registrar(c, NOTA, '2026-10-20');
    expect(c.getByTestId('estado-pieza').textContent).toBe('Cambios sin guardar');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(c.getByTestId('estado-pieza').textContent).toBe('Guardado');
    const guardadas = ultimaGuardada().implementaciones!;
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({
      categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: 'Productividad|op20|', titulo: 'El tiempo de corte domina la operación',
      fecha: '2026-10-20', nota: NOTA, por: 'u1', porEmail: 'ana@secocut.com',
    });
    expect(guardadas[0].posicionId).toBeUndefined();
    expect(guardadas[0].costoPiezaAntes.toFixed(4)).toBe('9.3570');
    expect(Math.round(guardadas[0].ahorroEstimadoAnual)).toBe(12000);
    expect(Number.isNaN(Date.parse(guardadas[0].registradaEn))).toBe(false);
    expect(guardadas[0].id.length).toBeGreaterThan(3);
  });
  it('una mejora por herramienta guarda también la posición', async () => {
    const c = montar();
    const indice = c.getAllByTestId('mejora').findIndex((m) => within(m).getByTestId('categoria-mejora').textContent === 'Herramienta');
    fireEvent.click(botonImplementada(c, indice));
    fireEvent.change(within(dialogo()).getByLabelText('Qué se cambió (obligatorio)'), { target: { value: 'Cambio de calidad de la broca' } });
    fireEvent.click(within(dialogo()).getByTestId('confirmar-implementada'));
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().implementaciones![0]).toMatchObject({ categoria: 'Herramienta', opId: 'op30', posicionId: 'op30-h1', claveMejora: 'Herramienta|op30|op30-h1' });
  });
  it('dos registros se agregan al final, en orden cronológico', async () => {
    const c = montar();
    registrar(c, 'Primer cambio en la fresa');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    registrar(c, 'Segundo cambio en la broca', '2026-10-21');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().implementaciones!.map((i) => i.nota)).toEqual(['Primer cambio en la fresa', 'Segundo cambio en la broca']);
    expect(new Set(ultimaGuardada().implementaciones!.map((i) => i.id)).size).toBe(2);
  });
});

describe('logrado real', () => {
  it('al cargar el dato nuevo (menos tiempo de corte en Op20) el logro pasa a ser positivo y resta del pendiente', async () => {
    const c = montar();
    registrar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    cargarCorteNuevoOp20(c);
    abrirRealizadas(c);
    const logrado = within(c.getByTestId('mejora-realizada')).getByTestId('logrado-realizada');
    const monto = Number(/≈ USD (\d[\d.]*)\/año/.exec(logrado.textContent ?? '')?.[1]?.replace(/\./g, ''));
    expect(monto).toBeGreaterThan(5000);
    expect(within(c.getByTestId('mejora-realizada')).queryByTestId('sin-cambios-realizada')).toBeNull();
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain(`Logrado ≈ ${usd0(monto)}/año`);
    // la barra de progreso refleja logrado / potencial total
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });
  it('un logro negativo se muestra negativo, no 0: costo antes 9,0000 con la pieza en 9,3570 → (9,0 − 9,3570235) × 25.000 ≈ −8.926', () => {
    // a mano: 0,3570235 × 25.000 = 8.925,59
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ costoPiezaAntes: 9 })]; }));
    abrirRealizadas(c);
    const logrado = within(c.getByTestId('mejora-realizada')).getByTestId('logrado-realizada');
    expect(logrado.textContent).toContain('≈ USD −8.926/año');
    expect(logrado.querySelector('span')!.className).toContain('text-red-700');
    expect(within(c.getByTestId('mejora-realizada')).queryByTestId('sin-cambios-realizada')).toBeNull();
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain('Logrado ≈ USD −8.926/año');
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBe(0);
  });
  it('dos registros encadenados: los logros por implementación suman el total', () => {
    // a mano: primera antes 9,6000 → segunda antes 9,4000: logro 1 = 0,2 × 25.000 = 5.000; segunda antes 9,4000 vs actual 9,3570235: 0,0429765 × 25.000 = 1.074,41
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ id: 'i1', costoPiezaAntes: 9.6 }), implementacion({ id: 'i2', costoPiezaAntes: 9.4, nota: 'Segundo ajuste' })]; }));
    abrirRealizadas(c);
    const items = c.getAllByTestId('mejora-realizada');
    expect(within(items[0]).getByTestId('logrado-realizada').textContent).toContain('≈ USD 5.000/año');
    expect(within(items[1]).getByTestId('logrado-realizada').textContent).toContain('≈ USD 1.074/año');
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain('Logrado ≈ USD 6.074/año'); // (9,6 − 9,3570235) × 25.000 = 6.074,41
  });
});

describe('anular el registro', () => {
  it('con confirmación en un diálogo propio: quita la entrada, desaparece la sección y se guarda sin la entrada', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion()]; }));
    abrirRealizadas(c);
    fireEvent.click(c.getByText('Anular registro'));
    const dlg = within(document.body).getByTestId('dialogo-anular-implementacion');
    fireEvent.click(within(dlg).getByText('Cancelar'));
    expect(c.getByTestId('mejoras-realizadas')).toBeTruthy(); // cancelar no anula
    fireEvent.click(c.getByText('Anular registro'));
    fireEvent.click(within(within(document.body).getByTestId('dialogo-anular-implementacion')).getByTestId('confirmar-anular-implementacion'));
    expect(c.queryByTestId('mejoras-realizadas')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().implementaciones).toEqual([]); // el arreglo queda vacío: la actualización en Firestore lo reemplaza
  });
  it('al anular un registro del medio, el logrado se recalcula con los que quedan', () => {
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ id: 'i1', costoPiezaAntes: 9.6 }), implementacion({ id: 'i2', costoPiezaAntes: 9.4, nota: 'Segundo ajuste' })]; }));
    abrirRealizadas(c);
    fireEvent.click(within(c.getAllByTestId('mejora-realizada')[1]).getByText('Anular registro'));
    fireEvent.click(within(within(document.body).getByTestId('dialogo-anular-implementacion')).getByTestId('confirmar-anular-implementacion'));
    expect(c.getAllByTestId('mejora-realizada')).toHaveLength(1);
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain('Logrado ≈ USD 6.074/año'); // sigue siendo (9,6 − actual) × 25.000
  });
});

describe('por operación', () => {
  it('Op20 lista sus mejoras realizadas (fecha y nota, sin cifra) y Op30 no', () => {
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ fecha: '2026-10-20' })]; }));
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.click(c.getByLabelText('Editar Desbaste y contorno'));
    const bloque = within(c.getByTestId('operacion-editor')).getByTestId('realizadas-operacion');
    expect(bloque.textContent).toContain('Mejoras realizadas en esta operación');
    expect(within(bloque).getByTestId('realizada-operacion').textContent).toBe(`20/10/2026 · Productividad: ${NOTA}`);
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
  it('la explicación de las mejoras usa 4 decimales (Herramienta de Op30: costo por pieza con 4 decimales)', () => {
    const c = montar();
    const textos = c.getAllByTestId('mejora').map((m) => m.textContent ?? '');
    for (const t of textos.filter((x) => /USD \d+,\d+ por pieza/.test(x))) {
      for (const m of t.matchAll(/USD (\d+,\d+) por pieza/g)) expect(m[1]).toMatch(/^\d+,\d{4}$/);
    }
  });
});
