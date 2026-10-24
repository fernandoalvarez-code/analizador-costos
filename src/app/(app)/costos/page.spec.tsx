// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// /costos ya no tiene la administración de clientes: ni el panel "Acceso de clientes" ni "+ Nueva empresa" (admin incluido). El admin ve junto al selector
// el enlace "Gestionar clientes" a Configuración; el vendedor y el cliente no lo ven. El resto del tablero no cambia.
// FRÁGIL: depende de los nombres que importan empresa-context.tsx y la página de '@/firebase'.
const { state, FIRESTORE } = vi.hoisted(() => {
  const FIRESTORE = {};
  return {
    FIRESTORE,
    state: {
      user: null as null | { uid: string; email: string; emailVerified: boolean },
      perfil: { data: null as null | Record<string, unknown>, isLoading: false },
      repo: { obtenerEmpresa: vi.fn(), listarEmpresas: vi.fn(), crearEmpresa: vi.fn() },
    },
  };
});
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: state.user, loading: false }),
  useFirestore: () => FIRESTORE,
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => state.perfil,
  doc: vi.fn(() => ({})),
}));
vi.mock('@/lib/costos-mecanizado/firestore', () => ({ crearRepositorioCostos: () => state.repo }));
vi.mock('@/components/costos/resumen-planta', () => ({ default: () => <div data-testid="resumen-planta-stub" /> }));
vi.mock('@/components/costos/acceso-clientes', () => ({ default: () => <div data-testid="acceso-clientes-stub" /> }));

import CostosLayout from '@/app/(app)/costos/layout';
import CostosPage from '@/app/(app)/costos/page';

const EMPRESA_A = { id: 'emp-a', nombre: 'Autopartes Ejemplo S.A.', plantas: ['Planta 1'] };
const EMPRESA_B = { id: 'emp-b', nombre: 'Metalúrgica Ejemplo S.R.L.', plantas: [] };
const montar = () => render(<CostosLayout><CostosPage /></CostosLayout>);

beforeEach(() => {
  window.localStorage.clear();
  state.repo.obtenerEmpresa.mockReset().mockResolvedValue(EMPRESA_A);
  state.repo.listarEmpresas.mockReset().mockResolvedValue([EMPRESA_A, EMPRESA_B]);
  state.repo.crearEmpresa.mockReset();
});
afterEach(() => cleanup());

describe('admin SECOCUT', () => {
  beforeEach(() => {
    state.user = { uid: 'admin1', email: 'admin@secocut.com', emailVerified: true };
    state.perfil = { data: { role: 'admin' }, isLoading: false };
  });
  it('sin el panel de accesos ni "+ Nueva empresa"; con el selector, el tablero y el enlace "Gestionar clientes" a /settings#empresas-y-accesos', async () => {
    const c = montar();
    await c.findByTestId('resumen-planta-stub');
    expect(c.queryByTestId('acceso-clientes-stub')).toBeNull();
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
    expect(c.queryByTestId('form-nueva-empresa')).toBeNull();
    expect(c.container.querySelector('select#costos-empresa')).toBeTruthy();
    expect(c.getByTestId('tarjeta-empresa').textContent).toContain('Autopartes Ejemplo S.A.');
    const enlace = c.getByRole('link', { name: 'Gestionar clientes' });
    expect(enlace.getAttribute('href')).toBe('/settings#empresas-y-accesos');
  });
});

describe('vendedor y cliente de empresa', () => {
  it('el vendedor (@secocut verificado con empresas asignadas) ve el selector pero no el enlace ni nada de administración', async () => {
    state.user = { uid: 'v1', email: 'vendedor@secocut.com', emailVerified: true };
    state.perfil = { data: { role: 'user', empresasAsignadas: ['emp-a', 'emp-b'] }, isLoading: false };
    const c = montar();
    await c.findByTestId('resumen-planta-stub');
    expect(c.container.querySelector('select#costos-empresa')).toBeTruthy();
    expect(c.queryByText('Gestionar clientes')).toBeNull();
    expect(c.queryByTestId('acceso-clientes-stub')).toBeNull();
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
  });
  it('el cliente (empresaId, no @secocut) ve su empresa fija: sin selector, sin enlace y sin administración', async () => {
    state.user = { uid: 'c1', email: 'jefe@autopartes.test', emailVerified: true };
    state.perfil = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: false };
    const c = montar();
    await c.findByTestId('resumen-planta-stub');
    expect(c.container.querySelector('select#costos-empresa')).toBeNull();
    expect(c.queryByText('Gestionar clientes')).toBeNull();
    expect(c.queryByTestId('acceso-clientes-stub')).toBeNull();
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
    expect(c.getByTestId('tarjeta-empresa').textContent).toContain('Autopartes Ejemplo S.A.');
  });
});
