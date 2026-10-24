// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Configuración: la sección "Empresas y accesos (Costos de mecanizado)" es SOLO del admin SECOCUT verificado (misma condición que UsersManagement)
// y es la que monta el provider de empresas: para cualquier otro usuario no se renderiza NI se lee ninguna empresa desde acá.
// La protección real sigue en el servidor y las reglas; esto fija que la pantalla no la muestra ni dispara lecturas.
// FRÁGIL: depende de los nombres que importa settings/page.tsx y empresa-context.tsx de '@/firebase'.
const { state, FIRESTORE } = vi.hoisted(() => {
  const FIRESTORE = {};
  return {
    FIRESTORE,
    state: {
      user: null as null | { uid: string; email: string; emailVerified: boolean; displayName?: string },
      perfil: { data: null as null | Record<string, unknown>, isLoading: false },
      repo: { obtenerEmpresa: vi.fn(), listarEmpresas: vi.fn(), crearEmpresa: vi.fn() },
    },
  };
});
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: state.user, loading: false }),
  useFirestore: () => FIRESTORE,
  useAuth: () => ({}),
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => state.perfil,
  updateDocumentNonBlocking: vi.fn(),
  doc: vi.fn(() => ({})),
  storage: {},
}));
vi.mock('firebase/auth', () => ({ updateProfile: vi.fn() }));
vi.mock('firebase/firestore', () => ({ setDoc: vi.fn(), onSnapshot: vi.fn(() => () => {}) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/app/users-management', () => ({ default: () => <div data-testid="users-management" /> }));
vi.mock('@/lib/costos-mecanizado/firestore', () => ({ crearRepositorioCostos: () => state.repo }));
vi.mock('@/components/costos/acceso-clientes', () => ({ default: ({ empresaId }: { empresaId: string }) => <div data-testid="acceso-clientes-stub">accesos de {empresaId}</div> }));

import SettingsPage from '@/app/(app)/settings/page';

const EMPRESA_A = { id: 'emp-a', nombre: 'Autopartes Ejemplo S.A.', plantas: [] };
const montar = () => render(<SettingsPage />);
const SECCION = 'empresas-y-accesos';
/** Deja pasar las promesas pendientes: si hubiera una lectura de empresas, ya se habría disparado. */
const asentar = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 20)); };

beforeEach(() => {
  state.user = { uid: 'u1', email: 'admin@secocut.com', emailVerified: true };
  state.perfil = { data: { role: 'admin' }, isLoading: false };
  state.repo.obtenerEmpresa.mockReset().mockResolvedValue(EMPRESA_A);
  state.repo.listarEmpresas.mockReset().mockResolvedValue([EMPRESA_A]);
  state.repo.crearEmpresa.mockReset();
});
afterEach(() => cleanup());

describe('admin SECOCUT verificado', () => {
  it('ve la sección (con el selector de empresa y el panel de accesos de la elegida), junto a la gestión de usuarios', async () => {
    const c = montar();
    expect(c.getByTestId('users-management')).toBeTruthy();
    expect(c.getByTestId(SECCION).querySelector('h2, h3')?.textContent ?? c.getByTestId(SECCION).textContent).toContain('Empresas y accesos (Costos de mecanizado)');
    expect((await c.findByTestId('acceso-clientes-stub')).textContent).toBe('accesos de emp-a');
    expect(c.container.querySelector('select#costos-empresa')).toBeTruthy();
    expect(c.getByText('+ Nueva empresa')).toBeTruthy();
    expect(state.repo.listarEmpresas).toHaveBeenCalledTimes(1);
  });
});

describe('quien NO es admin SECOCUT verificado: no se ve la sección y no se lee ninguna empresa desde Configuración', () => {
  it.each([
    ['usuario común @secocut (role user)', { uid: 'u2', email: 'vendedor@secocut.com', emailVerified: true }, { role: 'user' }],
    ['vendedor @secocut con empresas asignadas', { uid: 'u3', email: 'vendedor@secocut.com', emailVerified: true }, { role: 'user', empresasAsignadas: ['emp-a'] }],
    ['cliente de empresa (empresaId, no @secocut)', { uid: 'u4', email: 'jefe@autopartes.test', emailVerified: true }, { role: 'user', empresaId: 'emp-a' }],
    ['admin con el email SIN verificar', { uid: 'u5', email: 'admin@secocut.com', emailVerified: false }, { role: 'admin' }],
    ['admin con email de otro dominio', { uid: 'u6', email: 'admin@otro.com', emailVerified: true }, { role: 'admin' }],
    ['usuario sin perfil todavía (cargando)', { uid: 'u7', email: 'admin@secocut.com', emailVerified: true }, null],
  ])('%s', async (_n, user, perfil) => {
    state.user = user;
    state.perfil = { data: perfil, isLoading: perfil === null };
    const c = montar();
    await asentar();
    expect(c.queryByTestId(SECCION)).toBeNull();
    expect(c.queryByText('Empresas y accesos (Costos de mecanizado)')).toBeNull();
    expect(c.queryByTestId('acceso-clientes-stub')).toBeNull();
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
    expect(state.repo.listarEmpresas).not.toHaveBeenCalled();
    expect(state.repo.obtenerEmpresa).not.toHaveBeenCalled();
    expect(state.repo.crearEmpresa).not.toHaveBeenCalled();
  });
});
