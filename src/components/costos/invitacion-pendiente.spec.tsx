// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Pantalla de invitación (usuario sin empresaId en /costos): con invitación, sin invitación, email sin verificar y error al aceptar.
// FRÁGIL: depende de '@/firebase' (useUser), de useEmpresa y de fetch.
const { state, recargar } = vi.hoisted(() => ({
  state: { user: null as null | { uid: string; email: string; emailVerified: boolean; getIdToken: () => Promise<string> } },
  recargar: vi.fn(),
}));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: state.user, loading: false }) }));
vi.mock('./empresa-context', () => ({ useEmpresa: () => ({ recargar }) }));

import InvitacionPendiente from './invitacion-pendiente';

const INVITACION = { invitacionId: 'inv1', empresaNombre: 'Autopartes Ejemplo S.A.', expiresAt: '2026-10-27T12:00:00.000Z' };
const fetchMock = vi.fn();
const respuesta = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  state.user = { uid: 'cli1', email: 'jefe@autopartes.test', emailVerified: true, getIdToken: async () => 'id-token' };
  recargar.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('con invitación', () => {
  beforeEach(() => { fetchMock.mockResolvedValueOnce(respuesta(200, { invitacion: INVITACION })); });

  it('consulta /mia con el ID token y muestra "Te invitaron a {empresa}" con Aceptar y Ahora no', async () => {
    const c = render(<InvitacionPendiente />);
    expect((await c.findByRole('heading')).textContent).toBe('Te invitaron a Autopartes Ejemplo S.A.');
    expect(c.getByText('Aceptar')).toBeTruthy();
    expect(c.getByText('Ahora no')).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/costos/invitaciones/mia');
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe('Bearer id-token');
  });

  it('Aceptar llama a canjear con el id de la invitación, muestra el estado y recarga', async () => {
    let resolver: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
    const c = render(<InvitacionPendiente />);
    await c.findByText('Aceptar');
    fireEvent.click(c.getByText('Aceptar'));
    await c.findByText('Aceptando…');
    expect((c.getByText('Aceptando…') as HTMLButtonElement).disabled).toBe(true);
    expect((c.getByText('Ahora no') as HTMLButtonElement).disabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/costos/invitaciones/canjear');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ invitacionId: 'inv1' });
    expect(recargar).not.toHaveBeenCalled();
    await act(async () => { resolver(respuesta(200, { ok: true })); });
    expect((await c.findByTestId('costos-invitacion-aceptada')).textContent).toMatch(/Invitación aceptada/);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('error al aceptar: mensaje claro, sin el motivo interno, y se puede reintentar', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(403, { error: 'Sin permisos' }));
    const c = render(<InvitacionPendiente />);
    await c.findByText('Aceptar');
    fireEvent.click(c.getByText('Aceptar'));
    const error = await c.findByTestId('costos-invitacion-error');
    expect(error.textContent).toBe('No se pudo aceptar la invitación. Pedile a SECOCUT que te invite de nuevo.');
    expect(error.textContent).not.toMatch(/Sin permisos|venc|usada/i);
    expect(recargar).not.toHaveBeenCalled();
    expect((c.getByText('Aceptar') as HTMLButtonElement).disabled).toBe(false);
  });

  it('error de red al aceptar: el mismo mensaje', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const c = render(<InvitacionPendiente />);
    await c.findByText('Aceptar');
    fireEvent.click(c.getByText('Aceptar'));
    expect((await c.findByTestId('costos-invitacion-error')).textContent).toMatch(/No se pudo aceptar la invitación/);
  });

  it('Ahora no vuelve al mensaje "No tenés empresa asignada" sin llamar a canjear', async () => {
    const c = render(<InvitacionPendiente />);
    await c.findByText('Ahora no');
    fireEvent.click(c.getByText('Ahora no'));
    expect(c.getByTestId('costos-sin-empresa').textContent).toBe('No tenés empresa asignada.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('sin invitación', () => {
  it('muestra "No tenés empresa asignada."', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { invitacion: null }));
    const c = render(<InvitacionPendiente />);
    expect((await c.findByTestId('costos-sin-empresa')).textContent).toBe('No tenés empresa asignada.');
    expect(c.queryByText('Aceptar')).toBeNull();
  });
  it('si la consulta falla, muestra el mismo mensaje de siempre (no se inventa una invitación)', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(500, { error: 'x' }));
    const c = render(<InvitacionPendiente />);
    expect((await c.findByTestId('costos-sin-empresa')).textContent).toBe('No tenés empresa asignada.');
  });
});

describe('email sin verificar', () => {
  it('pide verificar el email y no consulta ninguna invitación', async () => {
    state.user = { uid: 'cli1', email: 'jefe@autopartes.test', emailVerified: false, getIdToken: async () => 'id-token' };
    const c = render(<InvitacionPendiente />);
    expect(c.getByTestId('costos-verificar-email').textContent).toBe('Verificá tu email para aceptar la invitación.');
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
