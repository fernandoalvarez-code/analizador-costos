// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Perímetro del cliente de empresa en (app)/layout.tsx: un cliente (users/{uid}.empresaId, sin ser personal SECOCUT verificado) solo ve
// /costos y /settings; el resto lo manda a /costos sin mostrar el contenido prohibido ni redirigir en bucle.
// FRÁGIL: depende de los nombres que importa el layout de '@/firebase' y de next/navigation.
const { state, replace, push, router } = vi.hoisted(() => {
  const replace = vi.fn(); const push = vi.fn();
  return { replace, push, router: { replace, push }, state: {
    pathname: '/taylor-curve',
    user: null as null | { uid: string; email: string; emailVerified: boolean },
    userLoading: false,
    perfil: { data: null as null | Record<string, unknown>, isLoading: true },
  } };
}); // el router de Next es estable entre renders: el mock también
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => state.pathname }));
vi.mock('firebase/firestore', () => ({ getDoc: vi.fn(async () => ({ exists: () => true })), setDoc: vi.fn() }));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: state.user, loading: state.userLoading }),
  useFirestore: () => ({}),
  useDoc: () => state.perfil,
  useMemoFirebase: (f: () => unknown) => f(),
  doc: vi.fn(() => ({})),
}));
vi.mock('@/components/app/header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('@/components/app/stale-case-checker', () => ({ default: () => null }));
vi.mock('@/components/app/email-verification-banner', () => ({ default: () => null }));

import AppLayout from '@/app/(app)/layout';

const montar = () => render(<AppLayout><div data-testid="contenido">contenido</div></AppLayout>);
const CLIENTE = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: false };

beforeEach(() => {
  state.pathname = '/taylor-curve';
  state.userLoading = false;
  state.user = { uid: 'cli1', email: 'jefe@autopartes.test', emailVerified: true };
  state.perfil = CLIENTE;
  replace.mockClear(); push.mockClear();
});
afterEach(() => cleanup());

describe('cliente de empresa', () => {
  it.each(['/taylor-curve', '/simulator/new', '/history', '/admin/agents', '/dashboard', '/cases'])('en %s redirige a /costos y no muestra el contenido', (ruta) => {
    state.pathname = ruta;
    const c = montar();
    expect(replace).toHaveBeenCalledWith('/costos');
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(c.queryByTestId('header')).toBeNull();
  });
  it.each(['/costos', '/costos/maquinas', '/costos/piezas/p1', '/settings'])('en %s se queda y ve el contenido (sin redirección en bucle)', (ruta) => {
    state.pathname = ruta;
    const c = montar();
    expect(c.getByTestId('contenido')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it('redirige una sola vez', () => {
    const c = montar();
    c.rerender(<AppLayout><div data-testid="contenido">contenido</div></AppLayout>);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe('perfil cargando', () => {
  it('un usuario que no es de SECOCUT no ve contenido ni se redirige hasta saber si es cliente', () => {
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
  it('cuando el perfil llega y es cliente, redirige; sin destello del contenido', () => {
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    state.perfil = CLIENTE;
    c.rerender(<AppLayout><div data-testid="contenido">contenido</div></AppLayout>);
    expect(c.queryByTestId('contenido')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/costos');
  });
  it('cuando el perfil llega y NO es cliente, muestra el contenido', () => {
    state.perfil = { data: null, isLoading: true };
    const c = montar();
    state.perfil = { data: { role: 'user' }, isLoading: false };
    c.rerender(<AppLayout><div data-testid="contenido">contenido</div></AppLayout>);
    expect(c.getByTestId('contenido')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it('si el perfil no llega en 10 s deja de bloquear la pantalla', () => {
    vi.useFakeTimers();
    try {
      state.perfil = { data: null, isLoading: true };
      const c = montar();
      expect(c.queryByTestId('contenido')).toBeNull();
      vi.advanceTimersByTime(10_001);
      c.rerender(<AppLayout><div data-testid="contenido">contenido</div></AppLayout>);
      expect(c.getByTestId('contenido')).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });
});

describe('el resto de los usuarios no cambia', () => {
  it('personal SECOCUT verificado con empresaId no se redirige y no espera al perfil', () => {
    state.user = { uid: 'v1', email: 'vendedor@secocut.com', emailVerified: true };
    state.perfil = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: true };
    const c = montar();
    expect(c.getByTestId('contenido')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it('personal SECOCUT en /taylor-curve ve la pantalla', () => {
    state.user = { uid: 'v1', email: 'vendedor@secocut.com', emailVerified: true };
    state.perfil = { data: { role: 'user', empresasAsignadas: ['emp-a'] }, isLoading: false };
    expect(montar().getByTestId('contenido')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it('usuario sin empresaId ve /taylor-curve', () => {
    state.perfil = { data: { role: 'user' }, isLoading: false };
    expect(montar().getByTestId('contenido')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it('sin sesión va a /login (como antes)', () => {
    state.user = null;
    montar();
    expect(push).toHaveBeenCalledWith('/login');
  });
});
