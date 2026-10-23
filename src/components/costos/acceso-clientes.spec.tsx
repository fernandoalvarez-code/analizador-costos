// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Panel "Acceso de clientes" (admin SECOCUT): invitar, revocar y vendedores asignados, con estados de guardado y errores visibles.
// FRÁGIL: depende de '@/firebase', de getDocs/query/where/collection de firebase/firestore y de fetch.
const { state, FIRESTORE } = vi.hoisted(() => ({
  FIRESTORE: {},
  state: {
    user: { uid: 'admin1', getIdToken: async () => 'id-token' },
    vendedores: [] as { id: string; email: string }[],
    vendedoresFalla: false,
  },
}));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: state.user, loading: false }), useFirestore: () => FIRESTORE }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})), query: vi.fn(() => ({})), where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => {
    if (state.vendedoresFalla) throw new Error('permission-denied');
    return { docs: state.vendedores.map((v) => ({ id: v.id, get: (c: string) => (c === 'email' ? v.email : undefined) })) };
  }),
}));

import AccesoClientes from './acceso-clientes';

const INV = (id: string, email: string, estado: 'pendiente' | 'usada' | 'vencida') => ({
  id, email, estado, createdAt: '2026-10-19T12:00:00.000Z', expiresAt: '2026-10-26T12:00:00.000Z', usadaAt: estado === 'usada' ? '2026-10-20T12:00:00.000Z' : null,
});
const fetchMock = vi.fn();
const respuesta = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
/** Una respuesta por llamada, por orden. */
const callsTo = (metodo: string, url: RegExp) => fetchMock.mock.calls.filter(([u, i]) => url.test(u) && (i?.method ?? 'GET') === metodo);

beforeEach(() => {
  state.vendedores = []; state.vendedoresFalla = false;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('invitaciones', () => {
  it('lista con estado pendiente / usada / vencida y "Revocar" solo en las pendientes', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { invitaciones: [INV('p', 'p@c.com', 'pendiente'), INV('u', 'u@c.com', 'usada'), INV('v', 'v@c.com', 'vencida')] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    const lista = await c.findByTestId('lista-invitaciones');
    expect(within(c.getByTestId('invitacion-p')).getByText('Pendiente')).toBeTruthy();
    expect(within(c.getByTestId('invitacion-u')).getByText('Usada')).toBeTruthy();
    expect(within(c.getByTestId('invitacion-v')).getByText('Vencida')).toBeTruthy();
    expect(within(lista).getAllByText('Revocar')).toHaveLength(1);
    expect(within(c.getByTestId('invitacion-p')).getByText('Revocar')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/costos/invitaciones?empresaId=emp-a');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer id-token');
  });

  it('invitar: POST con empresaId y email, estados Invitando… → mensaje de éxito, y vuelve a listar', async () => {
    let resolver: (v: unknown) => void = () => {};
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [] }))
      .mockReturnValueOnce(new Promise((r) => { resolver = r; }))
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [INV('n', 'nuevo@c.com', 'pendiente')] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('Todavía no hay invitaciones.');
    fireEvent.change(c.getByLabelText('Email a invitar'), { target: { value: ' nuevo@c.com ' } });
    fireEvent.click(c.getByText('Invitar'));
    expect((await c.findByTestId('estado-invitar')).textContent).toBe('Guardando…');
    expect((c.getByText('Invitando…') as HTMLButtonElement).disabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[1];
    expect([url, init.method, JSON.parse(init.body)]).toEqual(['/api/costos/invitaciones', 'POST', { empresaId: 'emp-a', email: 'nuevo@c.com' }]);
    resolver(respuesta(200, { id: 'n', expiresAt: '2026-10-27T12:00:00.000Z' }));
    await waitFor(() => expect(c.getByTestId('estado-invitar').textContent).toMatch(/Invitación lista/));
    await c.findByTestId('invitacion-n');
    expect((c.getByLabelText('Email a invitar') as HTMLInputElement).value).toBe('');
  });

  it('invitar con error: mensaje visible y el email queda para reintentar', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { invitaciones: [] })).mockResolvedValueOnce(respuesta(404, { error: 'No encontrado' }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('Todavía no hay invitaciones.');
    fireEvent.change(c.getByLabelText('Email a invitar'), { target: { value: 'nuevo@c.com' } });
    fireEvent.click(c.getByText('Invitar'));
    const estado = await c.findByTestId('estado-invitar');
    await waitFor(() => expect(estado.getAttribute('role')).toBe('alert'));
    expect(estado.textContent).toBe('No se pudo crear la invitación. Reintentá.');
    expect((c.getByLabelText('Email a invitar') as HTMLInputElement).value).toBe('nuevo@c.com');
  });

  it('invitar sin email: error visible y no llama al servidor', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { invitaciones: [] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('Todavía no hay invitaciones.');
    fireEvent.click(c.getByText('Invitar'));
    expect((await c.findByTestId('estado-invitar')).textContent).toBe('Ingresá el email de la persona a invitar.');
    expect(callsTo('POST', /invitaciones/)).toHaveLength(0);
  });

  it('revocar: DELETE de la invitación pendiente, estado y lista actualizada', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [INV('p', 'p@c.com', 'pendiente')] }))
      .mockResolvedValueOnce(respuesta(200, { ok: true }))
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByTestId('invitacion-p');
    fireEvent.click(c.getByText('Revocar'));
    await waitFor(() => expect(c.getByTestId('estado-revocar').textContent).toBe('Invitación revocada.'));
    expect(callsTo('DELETE', /\/api\/costos\/invitaciones\/p$/)).toHaveLength(1);
    await c.findByText('Todavía no hay invitaciones.');
  });

  it('revocar con error: mensaje visible', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [INV('p', 'p@c.com', 'pendiente')] }))
      .mockResolvedValueOnce(respuesta(404, { error: 'No encontrado' }))
      .mockResolvedValueOnce(respuesta(200, { invitaciones: [INV('p', 'p@c.com', 'usada')] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByTestId('invitacion-p');
    fireEvent.click(c.getByText('Revocar'));
    await waitFor(() => expect(c.getByTestId('estado-revocar').textContent).toBe('No se pudo revocar la invitación. Reintentá.'));
  });

  it('si la lista no carga, avisa y permite reintentar', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(500, {})).mockResolvedValueOnce(respuesta(200, { invitaciones: [] }));
    const c = render(<AccesoClientes empresaId="emp-a" />);
    expect((await c.findByTestId('error-invitaciones')).textContent).toMatch(/No se pudieron cargar las invitaciones/);
    fireEvent.click(within(c.getByTestId('error-invitaciones')).getByText('Reintentar'));
    await c.findByText('Todavía no hay invitaciones.');
  });
});

describe('vendedores asignados', () => {
  beforeEach(() => { fetchMock.mockResolvedValue(respuesta(200, { invitaciones: [] })); });

  it('lista los vendedores de la empresa', async () => {
    state.vendedores = [{ id: 'v2', email: 'zeta@secocut.com' }, { id: 'v1', email: 'ana@secocut.com' }];
    const c = render(<AccesoClientes empresaId="emp-a" />);
    const lista = await c.findByTestId('lista-vendedores');
    expect([...lista.querySelectorAll('li span')].map((s) => s.textContent)).toEqual(['ana@secocut.com', 'zeta@secocut.com']);
  });

  it('agregar: POST asignar y vuelve a listar', async () => {
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('No hay vendedores asignados a esta empresa.');
    state.vendedores = [{ id: 'v1', email: 'ana@secocut.com' }];
    fireEvent.change(c.getByLabelText('Email del vendedor'), { target: { value: 'ana@secocut.com' } });
    fireEvent.click(c.getByText('Agregar'));
    await waitFor(() => expect(c.getByTestId('estado-vendedor').textContent).toBe('Vendedor asignado.'));
    const [llamada] = callsTo('POST', /vendedores/);
    expect(JSON.parse(llamada[1].body)).toEqual({ email: 'ana@secocut.com', empresaId: 'emp-a', accion: 'asignar' });
    await c.findByTestId('lista-vendedores');
  });

  it('quitar: POST quitar con el email del vendedor', async () => {
    state.vendedores = [{ id: 'v1', email: 'ana@secocut.com' }];
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByTestId('lista-vendedores');
    state.vendedores = [];
    fireEvent.click(c.getByText('Quitar'));
    await waitFor(() => expect(c.getByTestId('estado-vendedor').textContent).toBe('Vendedor quitado.'));
    const [llamada] = callsTo('POST', /vendedores/);
    expect(JSON.parse(llamada[1].body)).toEqual({ email: 'ana@secocut.com', empresaId: 'emp-a', accion: 'quitar' });
    await c.findByText('No hay vendedores asignados a esta empresa.');
  });

  it('estado "Guardando…" real mientras espera al servidor', async () => {
    let resolver: (v: unknown) => void = () => {};
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('No hay vendedores asignados a esta empresa.');
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
    fireEvent.change(c.getByLabelText('Email del vendedor'), { target: { value: 'ana@secocut.com' } });
    fireEvent.click(c.getByText('Agregar'));
    await waitFor(() => expect(c.getByTestId('estado-vendedor').textContent).toBe('Guardando…'));
    expect((c.getByText('Guardando…', { selector: 'button' }) as HTMLButtonElement).disabled).toBe(true);
    resolver(respuesta(200, { ok: true }));
    await waitFor(() => expect(c.getByTestId('estado-vendedor').textContent).toBe('Vendedor asignado.'));
  });

  it('cuenta no válida (404): mensaje visible que explica qué se necesita', async () => {
    const c = render(<AccesoClientes empresaId="emp-a" />);
    await c.findByText('No hay vendedores asignados a esta empresa.');
    fetchMock.mockResolvedValueOnce(respuesta(404, { error: 'No encontrado' }));
    fireEvent.change(c.getByLabelText('Email del vendedor'), { target: { value: 'otro@gmail.com' } });
    fireEvent.click(c.getByText('Agregar'));
    await waitFor(() => expect(c.getByTestId('estado-vendedor').getAttribute('role')).toBe('alert'));
    expect(c.getByTestId('estado-vendedor').textContent).toMatch(/cuenta @secocut\.com con el email verificado/);
  });

  it('si no se pueden leer los vendedores, avisa', async () => {
    state.vendedoresFalla = true;
    const c = render(<AccesoClientes empresaId="emp-a" />);
    expect((await c.findByTestId('error-vendedores')).textContent).toMatch(/No se pudieron cargar los vendedores asignados/);
  });
});
