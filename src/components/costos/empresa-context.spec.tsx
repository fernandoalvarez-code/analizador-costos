// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Selector de empresa y compuerta del módulo: cliente con empresa fija, vendedor con las suyas, admin con todas (y "+ Nueva empresa"),
// sin empresas, y el perfil que no llega. FRÁGIL: depende de los nombres que importa empresa-context.tsx de '@/firebase'.
const { state, FIRESTORE } = vi.hoisted(() => {
  const FIRESTORE = {};
  return {
    FIRESTORE,
    state: {
      user: null as null | { uid: string; email: string; emailVerified: boolean },
      userLoading: false,
      perfil: { data: null as null | Record<string, unknown>, isLoading: true },
      repo: {
        obtenerEmpresa: vi.fn(), listarEmpresas: vi.fn(), crearEmpresa: vi.fn(),
      },
    },
  };
});
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: state.user, loading: state.userLoading }),
  useFirestore: () => FIRESTORE,
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => state.perfil,
  doc: vi.fn(() => ({})),
}));
vi.mock('@/lib/costos-mecanizado/firestore', () => ({ crearRepositorioCostos: () => state.repo }));

import CostosMarco from '@/components/costos/costos-marco';
import { EmpresaProvider } from '@/components/costos/empresa-context';
import { PERFIL_TOPE_MS } from '@/hooks/use-secocut-admin-access';

const EMPRESA_A = { id: 'emp-a', nombre: 'Autopartes Ejemplo S.A.', plantas: ['Planta 1'] };
const EMPRESA_B = { id: 'emp-b', nombre: 'Metalúrgica Ejemplo S.R.L.', plantas: ['Planta Norte'] };

const personal = (uid: string) => ({ uid, email: `${uid}@secocut.com`, emailVerified: true });
const montar = () => render(<EmpresaProvider><CostosMarco><div data-testid="contenido">contenido</div></CostosMarco></EmpresaProvider>);
const selector = (c: HTMLElement) => c.querySelector('select#costos-empresa') as HTMLSelectElement | null;
const opciones = (c: HTMLElement) => [...(selector(c)?.options ?? [])].map((o) => o.textContent);

beforeEach(() => {
  window.localStorage.clear();
  state.userLoading = false;
  state.user = { uid: 'cliente-a', email: 'jefe@autopartes.test', emailVerified: true };
  state.perfil = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: false };
  state.repo.obtenerEmpresa.mockReset().mockImplementation(async (id: string) => ({ 'emp-a': EMPRESA_A, 'emp-b': EMPRESA_B } as Record<string, unknown>)[id] ?? null);
  state.repo.listarEmpresas.mockReset().mockResolvedValue([EMPRESA_A, EMPRESA_B]);
  state.repo.crearEmpresa.mockReset().mockResolvedValue('emp-nueva');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('encabezado', () => {
  it('título, subtítulo y, a la derecha, la empresa y la planta', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    expect(c.getByRole('heading', { level: 1 }).textContent).toBe('Análisis de costos de mecanizado');
    expect(c.getByText('Diagnóstico de costo por pieza y por operación · SECOCUT')).toBeTruthy();
    const derecha = within(c.getByTestId('costos-empresa-planta'));
    expect(derecha.getByText('Autopartes Ejemplo S.A.')).toBeTruthy();
    expect(derecha.getByText('Planta: Planta 1')).toBeTruthy();
  });
});

describe('cliente con empresaId: empresa fija, sin selector', () => {
  it('ve su empresa y no hay selector ni "+ Nueva empresa"', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    expect(c.queryByTestId('selector-empresa')).toBeNull();
    expect(selector(c.container)).toBeNull();
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
    expect(state.repo.obtenerEmpresa).toHaveBeenCalledTimes(1);
    expect(state.repo.obtenerEmpresa).toHaveBeenCalledWith('emp-a');
    expect(state.repo.listarEmpresas).not.toHaveBeenCalled(); // un cliente no lista empresas
  });
  it('si la empresa asignada no existe, avisa (no queda en blanco)', async () => {
    state.repo.obtenerEmpresa.mockResolvedValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = montar();
    expect((await c.findByTestId('costos-error')).textContent).toMatch(/No se pudo cargar la empresa/);
    expect(c.queryByTestId('contenido')).toBeNull();
  });
  it('si falla la lectura, avisa y "Reintentar" vuelve a leer', async () => {
    state.repo.obtenerEmpresa.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = montar();
    await c.findByTestId('costos-error');
    fireEvent.click(c.getByText('Reintentar'));
    await c.findByTestId('contenido');
    expect(state.repo.obtenerEmpresa).toHaveBeenCalledTimes(2);
  });
});

describe('vendedor: selector con sus empresas asignadas', () => {
  beforeEach(() => {
    state.user = personal('vendedor');
    state.perfil = { data: { role: 'user', empresasAsignadas: ['emp-a', 'emp-b'] }, isLoading: false };
  });
  it('lee cada empresa asignada (lectura puntual) y muestra el selector con ellas, sin "+ Nueva empresa"', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    expect(state.repo.obtenerEmpresa).toHaveBeenCalledTimes(2);
    expect(state.repo.listarEmpresas).not.toHaveBeenCalled();
    expect(opciones(c.container)).toEqual(['Autopartes Ejemplo S.A.', 'Metalúrgica Ejemplo S.R.L.']);
    expect(c.queryByText('+ Nueva empresa')).toBeNull();
  });
  it('arranca con la primera, y al elegir otra cambia la empresa y se recuerda', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    expect(selector(c.container)!.value).toBe('emp-a');
    fireEvent.change(selector(c.container)!, { target: { value: 'emp-b' } });
    expect(within(c.getByTestId('costos-empresa-planta')).getByText('Planta: Planta Norte')).toBeTruthy();
    expect(window.localStorage.getItem('costos:empresa:vendedor')).toBe('emp-b');
  });
  it('restaura la selección guardada si sigue siendo válida', async () => {
    window.localStorage.setItem('costos:empresa:vendedor', 'emp-b');
    const c = montar();
    await c.findByTestId('contenido');
    expect(selector(c.container)!.value).toBe('emp-b');
  });
  it('ignora una selección guardada que ya no es válida', async () => {
    window.localStorage.setItem('costos:empresa:vendedor', 'emp-vieja');
    const c = montar();
    await c.findByTestId('contenido');
    expect(selector(c.container)!.value).toBe('emp-a');
  });
  it('si localStorage falla (lectura y escritura), el selector sigue funcionando', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const c = montar();
    await c.findByTestId('contenido');
    expect(() => fireEvent.change(selector(c.container)!, { target: { value: 'emp-b' } })).not.toThrow();
    expect(selector(c.container)!.value).toBe('emp-b');
  });
  it('si una de sus empresas no se puede leer, muestra las demás', async () => {
    state.repo.obtenerEmpresa.mockImplementation(async (id: string) => { if (id === 'emp-b') throw new Error('permission-denied'); return EMPRESA_A; });
    const c = montar();
    await c.findByTestId('contenido');
    expect(opciones(c.container)).toEqual(['Autopartes Ejemplo S.A.']);
  });
});

describe('admin: selector con todas las empresas y "+ Nueva empresa"', () => {
  beforeEach(() => {
    state.user = personal('admin-secocut');
    state.perfil = { data: { role: 'admin' }, isLoading: false };
  });
  it('lista todas (listarEmpresas) y ofrece "+ Nueva empresa"', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    expect(state.repo.listarEmpresas).toHaveBeenCalledTimes(1);
    expect(opciones(c.container)).toEqual(['Autopartes Ejemplo S.A.', 'Metalúrgica Ejemplo S.R.L.']);
    expect(c.getByText('+ Nueva empresa')).toBeTruthy();
  });
  it('crea una empresa con nombre y plantas opcionales, la agrega y la selecciona', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: '  Taller Nuevo  ' } });
    fireEvent.change(c.getByLabelText(/Plantas/), { target: { value: 'Planta 1, , Planta 2, Planta 1' } });
    fireEvent.click(c.getByText('Crear'));
    await waitFor(() => expect(state.repo.crearEmpresa).toHaveBeenCalledWith({ nombre: 'Taller Nuevo', plantas: ['Planta 1', 'Planta 2'] }));
    await waitFor(() => expect(opciones(c.container)).toContain('Taller Nuevo'));
    expect(selector(c.container)!.value).toBe('emp-nueva');
    expect(c.queryByTestId('form-nueva-empresa')).toBeNull(); // el formulario se cierra
    expect(window.localStorage.getItem('costos:empresa:admin-secocut')).toBe('emp-nueva');
  });
  it('las plantas son opcionales', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: 'Sin plantas' } });
    fireEvent.click(c.getByText('Crear'));
    await waitFor(() => expect(state.repo.crearEmpresa).toHaveBeenCalledWith({ nombre: 'Sin plantas', plantas: [] }));
  });
  it('el nombre es obligatorio: mensaje visible y no se escribe nada', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.click(c.getByText('Crear'));
    expect(c.getByRole('alert').textContent).toBe('El nombre de la empresa es obligatorio.');
    expect(state.repo.crearEmpresa).not.toHaveBeenCalled();
  });
  it('si falla la creación, muestra el error y deja el formulario abierto', async () => {
    state.repo.crearEmpresa.mockRejectedValue(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = montar();
    await c.findByTestId('contenido');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.change(c.getByLabelText('Nombre'), { target: { value: 'Nueva' } });
    fireEvent.click(c.getByText('Crear'));
    expect((await c.findByRole('alert')).textContent).toBe('No se pudo crear la empresa. Reintentá.');
    expect(c.getByTestId('form-nueva-empresa')).toBeTruthy();
  });
  it('"Cancelar" cierra el formulario', async () => {
    const c = montar();
    await c.findByTestId('contenido');
    fireEvent.click(c.getByText('+ Nueva empresa'));
    fireEvent.click(c.getByText('Cancelar'));
    expect(c.queryByTestId('form-nueva-empresa')).toBeNull();
  });
  it('sin ninguna empresa todavía: mensaje y "+ Nueva empresa" disponible', async () => {
    state.repo.listarEmpresas.mockResolvedValue([]);
    const c = montar();
    expect((await c.findByTestId('costos-sin-empresas')).textContent).toMatch(/Todavía no hay empresas/);
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(c.getByText('+ Nueva empresa')).toBeTruthy();
  });
});

describe('usuarios sin empresa', () => {
  it('personal SECOCUT sin empresas: "No tenés empresas asignadas"', async () => {
    state.user = personal('sin-asignar');
    state.perfil = { data: { role: 'user' }, isLoading: false };
    const c = montar();
    expect((await c.findByTestId('costos-sin-empresas')).textContent).toBe('No tenés empresas asignadas.');
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(state.repo.obtenerEmpresa).not.toHaveBeenCalled();
    expect(state.repo.listarEmpresas).not.toHaveBeenCalled();
  });
  it('vendedor cuyas empresas asignadas ya no existen: también "No tenés empresas asignadas"', async () => {
    state.user = personal('vendedor');
    state.perfil = { data: { role: 'user', empresasAsignadas: ['emp-x'] }, isLoading: false };
    const c = montar();
    expect((await c.findByTestId('costos-sin-empresas')).textContent).toBe('No tenés empresas asignadas.');
  });
  it('usuario que no es de SECOCUT y sin empresaId: "No tenés empresa asignada"', async () => {
    state.perfil = { data: { role: 'user' }, isLoading: false };
    const c = montar();
    expect((await c.findByTestId('costos-sin-empresa')).textContent).toBe('No tenés empresa asignada.');
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(state.repo.obtenerEmpresa).not.toHaveBeenCalled();
  });
});

describe('perfil que carga, falla o no llega (sin spinner infinito)', () => {
  it('mientras carga: estado de carga, sin contenido ni mensajes de "sin empresa"', () => {
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    expect(c.getByTestId('costos-cargando')).toBeTruthy();
    for (const id of ['contenido', 'costos-sin-empresa', 'costos-sin-empresas', 'costos-error']) expect(c.queryByTestId(id)).toBeNull();
    expect(state.repo.obtenerEmpresa).not.toHaveBeenCalled();
  });
  it('mientras se resuelve la sesión también se ve la carga', () => {
    state.userLoading = true; state.user = null;
    expect(montar().getByTestId('costos-cargando')).toBeTruthy();
  });
  it('perfil con error o inexistente (la lectura terminó): aviso enseguida, sin spinner', () => {
    state.perfil = { data: null, isLoading: false };
    const c = montar();
    expect(c.getByTestId('costos-error').textContent).toMatch(/No pudimos cargar tu perfil/);
    expect(c.queryByTestId('costos-cargando')).toBeNull();
    expect(c.queryByTestId('contenido')).toBeNull();
  });
  it('perfil que no llega en 10 s: carga durante los 10 s y después aviso (reloj falso)', async () => {
    vi.useFakeTimers();
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(PERFIL_TOPE_MS - 1); });
    expect(c.queryByTestId('costos-cargando')).not.toBeNull();
    expect(c.queryByTestId('costos-error')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(c.queryByTestId('costos-error')).not.toBeNull();
    expect(c.queryByTestId('costos-cargando')).toBeNull();
    expect(c.queryByTestId('contenido')).toBeNull();
  });
  it('si el perfil llega después de los 10 s, la pantalla se corrige sola', async () => {
    vi.useFakeTimers();
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(PERFIL_TOPE_MS); });
    expect(c.queryByTestId('costos-error')).not.toBeNull();
    state.perfil = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: false };
    await act(async () => { c.rerender(<EmpresaProvider><CostosMarco><div data-testid="contenido">contenido</div></CostosMarco></EmpresaProvider>); await vi.advanceTimersByTimeAsync(0); });
    expect(c.queryByTestId('contenido')).not.toBeNull();
    expect(c.queryByTestId('costos-error')).toBeNull();
  });
});
