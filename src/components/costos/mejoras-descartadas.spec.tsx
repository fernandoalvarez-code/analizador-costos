// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor, { DEBOUNCE_GUARDADO_PIEZA_MS } from '@/components/costos/pieza-editor';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type Pieza } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Descartar mejoras con motivo desde el Diagnóstico. Oráculos de CAR-001: 10 mejoras, ahorro USD 44.015; sin la Productividad de Op20
// (USD 12.000) quedan 9 y USD 32.015.
// FRÁGIL: depende de los textos del diálogo y del registro (descartar-mejora-dialog.tsx, diagnostico-pieza.tsx).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const USUARIO = { uid: 'u1', email: 'ana@secocut.com' };
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };
const MOTIVO = 'La máquina no admite más avance';

const carcasa = (ajustar?: (p: Pieza) => void): PiezaDoc => {
  const p = crearCarcasa();
  ajustar?.(p);
  return { ...p, id: 'car-001' } as PiezaDoc;
};
const montar = (inicial: PiezaDoc = carcasa(), usuario: typeof USUARIO | null = USUARIO) =>
  render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} usuario={usuario ?? undefined} />);
type C = ReturnType<typeof render>;
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const potencial = (c: C) => c.queryByTestId('potencial')?.textContent ?? null;
/** Cantidad total de mejoras activas (la lista muestra solo las 5 primeras): sale del encabezado "N mejoras en esta pieza". */
const cantidad = (c: C) => Number(/^(\d+) mejoras?/.exec(c.queryByTestId('potencial')?.textContent ?? '')?.[1] ?? 0);
const ultimaGuardada = () => repo.actualizarPieza.mock.calls.at(-1)![2] as Pieza;
const dialogo = () => within(document.body).getByTestId('dialogo-descartar');
const abrirDescartar = (c: C, indice = 0) => fireEvent.click(within(c.getAllByTestId('mejora')[indice]).getByText('Descartar'));
function descartar(c: C, motivo = MOTIVO, tipo?: string, indice = 0) {
  abrirDescartar(c, indice);
  if (tipo) fireEvent.change(within(dialogo()).getByLabelText('Tipo de motivo'), { target: { value: tipo } });
  fireEvent.change(within(dialogo()).getByLabelText('Motivo (obligatorio)'), { target: { value: motivo } });
  fireEvent.click(within(dialogo()).getByTestId('confirmar-descarte'));
}
const abrirRegistro = (c: C) => fireEvent.click(within(c.getByTestId('mejoras-descartadas')).getByRole('button', { name: /Mejoras descartadas/ }));

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

describe('sin descartes', () => {
  it('CAR-001 muestra 10 mejoras y USD 44.015; la primera es Productividad de Op20 y no hay registro', () => {
    const c = montar();
    expect(cantidad(c)).toBe(10);
    expect(potencial(c)).toContain('10 mejoras en esta pieza');
    expect(potencial(c)).toContain('USD 44.015/año');
    expect(within(c.getAllByTestId('mejora')[0]).getByTestId('categoria-mejora').textContent).toBe('Productividad');
    expect(within(c.getAllByTestId('mejora')[0]).getByTestId('ahorro-mejora').textContent).toContain('USD 12.000/año');
    expect(c.queryByTestId('mejoras-descartadas')).toBeNull();
  });
  it('sin usuario (solo lectura) no se ofrece "Descartar"', () => {
    const c = montar(carcasa(), null);
    expect(c.queryAllByText('Descartar')).toHaveLength(0);
  });
});

describe('diálogo de descarte', () => {
  it('no usa window.confirm', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const c = montar();
    descartar(c);
    expect(confirmar).not.toHaveBeenCalled();
  });
  it('motivo vacío o de menos de 5 caracteres no se acepta: error visible, el diálogo sigue abierto y nada se descarta', () => {
    const c = montar();
    abrirDescartar(c);
    fireEvent.click(within(dialogo()).getByTestId('confirmar-descarte'));
    expect(within(dialogo()).getByTestId('error-motivo').textContent).toBe('El motivo es obligatorio: escribí al menos 5 caracteres.');
    fireEvent.change(within(dialogo()).getByLabelText('Motivo (obligatorio)'), { target: { value: 'abcd' } });
    fireEvent.click(within(dialogo()).getByTestId('confirmar-descarte'));
    expect(within(dialogo()).getByTestId('error-motivo')).toBeTruthy();
    fireEvent.change(within(dialogo()).getByLabelText('Motivo (obligatorio)'), { target: { value: '     ' } });
    fireEvent.click(within(dialogo()).getByTestId('confirmar-descarte'));
    expect(within(dialogo()).getByTestId('error-motivo')).toBeTruthy();
    expect(cantidad(c)).toBe(10);
    expect(c.queryByTestId('mejoras-descartadas')).toBeNull();
  });
  it('con 5 caracteres se acepta', () => {
    const c = montar();
    descartar(c, 'abcde');
    expect(cantidad(c)).toBe(9);
  });
  it('el motivo se limita a 500 caracteres', () => {
    const c = montar();
    abrirDescartar(c);
    expect((within(dialogo()).getByLabelText('Motivo (obligatorio)') as HTMLTextAreaElement).maxLength).toBe(500);
  });
  it('lista los 5 tipos de motivo y Cancelar no descarta', () => {
    const c = montar();
    abrirDescartar(c);
    const opciones = [...(within(dialogo()).getByLabelText('Tipo de motivo') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(opciones).toEqual(['Ya se probó', 'Limitación de la máquina', 'Exigencia del cliente', 'Calidad o tolerancia', 'Otro']);
    fireEvent.click(within(dialogo()).getByText('Cancelar'));
    expect(cantidad(c)).toBe(10);
  });
});

describe('descartar y reactivar', () => {
  it('descartar Productividad de Op20: quedan 9 mejoras y el ahorro baja a USD 32.015', () => {
    const c = montar();
    descartar(c);
    expect(cantidad(c)).toBe(9);
    expect(potencial(c)).toContain('9 mejoras en esta pieza');
    expect(potencial(c)).toContain('USD 32.015/año');
    expect(c.getAllByTestId('categoria-mejora').map((e) => e.textContent)[0]).toBe('Herramienta');
  });
  it('se guarda con el guardado automático: entrada con tipo, motivo, uid, email, fecha ISO y ahorro al descartar', async () => {
    const c = montar();
    descartar(c, MOTIVO, 'limitacion-maquina');
    expect(c.getByTestId('estado-pieza').textContent).toBe('Cambios sin guardar');
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(1);
    expect(c.getByTestId('estado-pieza').textContent).toBe('Guardado');
    const entrada = ultimaGuardada().mejorasDescartadas!['Productividad|op20|'];
    expect(Object.keys(ultimaGuardada().mejorasDescartadas!)).toEqual(['Productividad|op20|']);
    expect(entrada).toMatchObject({ motivoTipo: 'limitacion-maquina', motivo: MOTIVO, por: 'u1', porEmail: 'ana@secocut.com' });
    expect(Number.isNaN(Date.parse(entrada.fecha))).toBe(false);
    expect(Math.round(entrada.ahorroAnualAlDescartar)).toBe(12000);
  });
  it('si otro usuario modificó la pieza, se ve el aviso de conflicto de siempre y no se pisa', async () => {
    // La pieza guardada tiene updatedAt 1000; en Firestore ahora hay otra versión (2000)
    repo.obtenerPieza.mockResolvedValue({ ...carcasa(), updatedAt: { toMillis: () => 2000 } });
    const c = montar({ ...carcasa(), updatedAt: { toMillis: () => 1000 } } as unknown as PiezaDoc);
    descartar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('aviso-conflicto')).toBeTruthy();
    expect(c.getByTestId('estado-pieza').textContent).toBe('Otro usuario modificó esta pieza');
    expect(repo.actualizarPieza).not.toHaveBeenCalled();
  });
  it('si el guardado falla, se ve "No se pudo guardar." con Reintentar', async () => {
    repo.actualizarPieza.mockRejectedValueOnce(new Error('permission-denied'));
    const c = montar();
    descartar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(c.getByTestId('estado-pieza').textContent).toBe('No se pudo guardar.');
    expect(c.getByTestId('reintentar-guardado-pieza')).toBeTruthy();
  });
  it('registro visible: "Mejoras descartadas (1)" plegable con motivo, autor, fecha y ahorro al descartar', () => {
    const c = montar();
    descartar(c, MOTIVO, 'exigencia-cliente');
    const seccion = within(c.getByTestId('mejoras-descartadas'));
    expect(seccion.getByRole('button', { name: /Mejoras descartadas \(1\)/ }).getAttribute('aria-expanded')).toBe('false');
    expect(c.queryByTestId('mejora-descartada')).toBeNull(); // plegada
    abrirRegistro(c);
    const item = within(c.getByTestId('mejora-descartada'));
    expect(item.getByTestId('categoria-descartada').textContent).toBe('Productividad');
    expect(c.getByTestId('mejora-descartada').textContent).toContain('Op 20 · Desbaste y contorno');
    expect(item.getByTestId('motivo-descartada').textContent).toBe(`Exigencia del cliente: ${MOTIVO}`);
    expect(item.getByTestId('autor-descartada').textContent).toMatch(/^Descartada por ana@secocut\.com · \d{1,2}\/\d{1,2}\/\d{2,4}/);
    expect(item.getByTestId('ahorro-descartada').textContent).toBe('Ahorro estimado al descartar: ≈ USD 12.000/año');
    expect(item.queryByTestId('ya-no-se-sugiere')).toBeNull();
    abrirRegistro(c); // se vuelve a plegar
    expect(c.queryByTestId('mejora-descartada')).toBeNull();
  });
  it('Reactivar: vuelve a sugerirse (10 mejoras, USD 44.015), desaparece del registro y se guarda con el mapa vacío', async () => {
    const c = montar();
    descartar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    abrirRegistro(c);
    fireEvent.click(within(c.getByTestId('mejora-descartada')).getByText('Reactivar'));
    expect(cantidad(c)).toBe(10);
    expect(potencial(c)).toContain('USD 44.015/año');
    expect(c.queryByTestId('mejoras-descartadas')).toBeNull();
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(2);
    expect(ultimaGuardada().mejorasDescartadas).toEqual({}); // el campo no se borra: así Firestore reemplaza el mapa
  });
  it('descartar las 10: "no hay mejoras", sin ahorro potencial, y el registro tiene las 10', () => {
    const c = montar();
    for (let i = 0; i < 10; i++) descartar(c, `Motivo número ${i + 1}`);
    expect(cantidad(c)).toBe(0);
    expect(c.queryByTestId('potencial')).toBeNull();
    expect(c.getByTestId('sin-mejoras-pendientes').textContent).toContain('Sin mejoras pendientes en esta pieza (10 descartadas, 0 implementadas).'); // antes: "Con los datos cargados no hay mejoras…"
    expect(within(c.getByTestId('mejoras-descartadas')).getByRole('button', { name: /Mejoras descartadas \(10\)/ })).toBeTruthy();
  });
  it('una descartada que ya no se dispararía con los datos actuales figura igual, con la leyenda', () => {
    const inicial = carcasa((p) => {
      p.operaciones.find((o) => o.id === 'op20')!.herramientas.forEach((h) => { h.opciones[0].cortePorPiezaMin = 0.05; });
      p.mejorasDescartadas = {
        'Productividad|op20|': { motivoTipo: 'ya-probado', motivo: 'Ya lo probamos el año pasado', por: 'u9', porEmail: 'luis@secocut.com', fecha: '2026-09-01T12:00:00.000Z', ahorroAnualAlDescartar: 12000 },
      };
    });
    const c = montar(inicial);
    abrirRegistro(c);
    const item = within(c.getByTestId('mejora-descartada'));
    expect(item.getByTestId('ya-no-se-sugiere').textContent).toBe('ya no se sugiere con los datos actuales');
    expect(item.getByTestId('autor-descartada').textContent).toContain('luis@secocut.com');
  });
});

describe('se conserva al editar y al duplicar', () => {
  it('editar los datos de la pieza no pierde mejorasDescartadas', async () => {
    const c = montar();
    descartar(c);
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.change(c.getAllByLabelText('Nombre')[0], { target: { value: 'Carcasa v2' } });
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(repo.actualizarPieza).toHaveBeenCalledTimes(2);
    expect(ultimaGuardada().nombre).toBe('Carcasa v2');
    expect(Object.keys(ultimaGuardada().mejorasDescartadas!)).toEqual(['Productividad|op20|']);
  });
  it('una pieza que abre con descartes ya guardados los muestra (9 mejoras, USD 32.015) y los vuelve a guardar al editar', async () => {
    const c = montar(carcasa((p) => {
      p.mejorasDescartadas = { 'Productividad|op20|': { motivoTipo: 'otro', motivo: 'Decisión del cliente', por: 'u1', porEmail: 'ana@secocut.com', fecha: '2026-10-01T12:00:00.000Z', ahorroAnualAlDescartar: 12000 } };
    }));
    expect(cantidad(c)).toBe(9);
    expect(potencial(c)).toContain('USD 32.015/año');
    fireEvent.click(c.getByRole('tab', { name: 'Cargar / editar datos' }));
    fireEvent.change(c.getAllByLabelText('Nombre')[0], { target: { value: 'Otra' } });
    await avanzar(DEBOUNCE_GUARDADO_PIEZA_MS);
    expect(ultimaGuardada().mejorasDescartadas!['Productividad|op20|'].motivo).toBe('Decisión del cliente');
  });
});
