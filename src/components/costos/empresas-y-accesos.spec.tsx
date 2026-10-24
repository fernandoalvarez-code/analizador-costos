// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sección "Empresas y accesos (Costos de mecanizado)": selector de empresa, "Nueva empresa" y el panel de accesos de la empresa elegida.
// (Crear empresa vivía en el selector de /costos; se mudó acá: son los mismos casos, en su nueva ubicación.)
// FRÁGIL: depende de los nombres que importa empresa-context.tsx de '@/firebase' y de crearRepositorioCostos.
const { state, FIRESTORE } = vi.hoisted(() => {
  const FIRESTORE = {};
  return {
    FIRESTORE,
    state: {
      user: null as null | { uid: string; email: string; emailVerified: boolean },
      perfil: { data: null as null | Record<string, unknown>, isLoading: true },
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
// El panel de accesos tiene sus propios tests (acceso-clientes.spec.tsx): acá solo importa para qué empresa se monta.
vi.mock('./acceso-clientes', () => ({ default: ({ empresaId }: { empresaId: string }) => <div data-testid="acceso-clientes-stub">accesos de {empresaId}</div> }));

import EmpresasYAccesos from './empresas-y-accesos';

const EMPRESA_A = { id: 'emp-a', nombre: 'Autopartes Ejemplo S.A.', plantas: ['Planta 1'] };
const EMPRESA_B = { id: 'emp-b', nombre: 'Metalúrgica Ejemplo S.R.L.', plantas: ['Planta Norte'] };
const montar = () => render(<EmpresasYAccesos />);
const selector = (c: HTMLElement) => c.querySelector('select#costos-empresa') as HTMLSelectElement | null;
const opciones = (c: HTMLElement) => [...(selector(c)?.options ?? [])].map((o) => o.textContent);

beforeEach(() => {
  window.localStorage.clear();
  state.user = { uid: 'admin-secocut', email: 'admin@secocut.com', emailVerified: true };
  state.perfil = { data: { role: 'admin' }, isLoading: false };
  state.repo.obtenerEmpresa.mockReset();
  state.repo.listarEmpresas.mockReset().mockResolvedValue([EMPRESA_A, EMPRESA_B]);
  state.repo.crearEmpresa.mockReset().mockResolvedValue('emp-nueva');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('contenido', () => {
  it('título, selector con todas las empresas, "+ Nueva empresa" y el panel de accesos de la empresa elegida (sin enlace a sí misma)', async () => {
    const c = montar();
    expect(c.getByText('Empresas y accesos (Costos de mecanizado)')).toBeTruthy();
    expect(c.getByTestId('empresas-y-accesos').id).toBe('empresas-y-accesos'); // ancla de "Gestionar clientes"
    expect((await c.findByTestId('acceso-clientes-stub')).textContent).toBe('accesos de emp-a');
    expect(state.repo.listarEmpresas).toHaveBeenCalledTimes(1);
    expect(opciones(c.container)).toEqual(['Autopartes Ejemplo S.A.', 'Metalúrgica Ejemplo S.R.L.']);
    expect(c.getByText('+ Nueva empresa')).toBeTruthy();
    expect(c.queryByTestId('enlace-gestionar-clientes')).toBeNull();
  });
  it('al elegir otra empresa, el panel de accesos pasa a la elegida', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.change(selector(c.container)!, { target: { value: 'emp-b' } });
    expect(c.getByTestId('acceso-clientes-stub').textContent).toBe('accesos de emp-b');
  });
  it('mientras carga muestra "Cargando empresas…" (no queda en blanco)', async () => {
    let resolver: (v: unknown) => void = () => {};
    state.repo.listarEmpresas.mockReturnValue(new Promise((r) => { resolver = r; }));
    const c = montar();
    expect(c.getByTestId('empresas-cargando').textContent).toContain('Cargando empresas…');
    resolver([EMPRESA_A]);
    await c.findByTestId('acceso-clientes-stub');
    expect(c.queryByTestId('empresas-cargando')).toBeNull();
  });
  it('si falla la lectura de empresas, muestra el error con "Reintentar"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.repo.listarEmpresas.mockRejectedValueOnce(new Error('permission-denied'));
    const c = montar();
    const error = await c.findByTestId('empresas-error');
    expect(error.textContent).toContain('No se pudo cargar la empresa');
    state.repo.listarEmpresas.mockResolvedValue([EMPRESA_A]);
    fireEvent.click(within(error).getByText('Reintentar'));
    expect((await c.findByTestId('acceso-clientes-stub')).textContent).toBe('accesos de emp-a');
  });
  it('sin ninguna empresa todavía: mensaje y "+ Nueva empresa" disponible, sin panel de accesos', async () => {
    state.repo.listarEmpresas.mockResolvedValue([]);
    const c = montar();
    expect((await c.findByTestId('empresas-vacio')).textContent).toBe('Todavía no hay empresas. Creá la primera con «+ Nueva empresa».');
    expect(c.getByText('+ Nueva empresa')).toBeTruthy();
    expect(c.queryByTestId('acceso-clientes-stub')).toBeNull();
  });
});

describe('crear empresa desde la sección', () => {
  it('crea con nombre y plantas ("Planta 1, , Planta 2, Planta 1" → ["Planta 1","Planta 2"]), la agrega y la selecciona; el panel de accesos pasa a la nueva', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: '  Taller Nuevo  ' } });
    fireEvent.change(c.getByLabelText(/Plantas/), { target: { value: 'Planta 1, , Planta 2, Planta 1' } });
    fireEvent.click(c.getByText('Crear'));
    await waitFor(() => expect(state.repo.crearEmpresa).toHaveBeenCalledWith({ nombre: 'Taller Nuevo', plantas: ['Planta 1', 'Planta 2'] }));
    await waitFor(() => expect(opciones(c.container)).toContain('Taller Nuevo'));
    expect(selector(c.container)!.value).toBe('emp-nueva');
    expect(c.getByTestId('acceso-clientes-stub').textContent).toBe('accesos de emp-nueva');
    expect(c.queryByTestId('form-nueva-empresa')).toBeNull(); // el formulario se cierra
    expect(window.localStorage.getItem('costos:empresa:admin-secocut')).toBe('emp-nueva');
  });
  it('plantas "A, B, A" se guardan como ["A","B"]', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: 'Dos plantas' } });
    fireEvent.change(c.getByLabelText(/Plantas/), { target: { value: 'A, B, A' } });
    fireEvent.click(c.getByText('Crear'));
    await waitFor(() => expect(state.repo.crearEmpresa).toHaveBeenCalledWith({ nombre: 'Dos plantas', plantas: ['A', 'B'] }));
  });
  it('las plantas son opcionales', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: 'Sin plantas' } });
    fireEvent.click(c.getByText('Crear'));
    await waitFor(() => expect(state.repo.crearEmpresa).toHaveBeenCalledWith({ nombre: 'Sin plantas', plantas: [] }));
  });
  it('el nombre vacío da el error visible "El nombre de la empresa es obligatorio." y no se escribe nada', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.click(c.getByText('Crear'));
    expect(within(c.getByTestId('form-nueva-empresa')).getByRole('alert').textContent).toBe('El nombre de la empresa es obligatorio.');
    expect(state.repo.crearEmpresa).not.toHaveBeenCalled();
  });
  it('si falla la creación, muestra el error y deja el formulario abierto', async () => {
    state.repo.crearEmpresa.mockRejectedValue(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: 'Nueva' } });
    fireEvent.click(c.getByText('Crear'));
    expect((await within(c.getByTestId('form-nueva-empresa')).findByRole('alert')).textContent).toBe('No se pudo crear la empresa. Reintentá.');
    expect(c.getByTestId('form-nueva-empresa')).toBeTruthy();
  });
  it('"Cancelar" cierra el formulario', async () => {
    const c = montar();
    await c.findByTestId('acceso-clientes-stub');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.click(c.getByText('Cancelar'));
    expect(c.queryByTestId('form-nueva-empresa')).toBeNull();
  });
});
