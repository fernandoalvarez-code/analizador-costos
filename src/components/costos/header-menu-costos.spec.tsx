// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ítem "Costos de mecanizado" del menú: personal SECOCUT verificado, o usuario con empresaId (perfil ya cargado).
// FRÁGIL: depende de los nombres que importa header.tsx de '@/firebase'.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { uid: string; email: string; emailVerified: boolean; displayName?: string },
    profile: { data: null as null | { role?: string; empresaId?: string }, isLoading: true },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/costos' }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }));
vi.mock('@/firebase', () => ({
  useAuth: () => ({}),
  useUser: () => ({ user: state.user, loading: false }),
  useCollection: () => ({ data: [], isLoading: false }),
  useDoc: () => state.profile,
  useFirestore: () => ({}),
  useMemoFirebase: (f: () => unknown) => f(),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
}));

import Header from '@/components/app/header';

const links = (c: HTMLElement) => [...c.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
const ITEM = 'Costos de mecanizado';

beforeEach(() => { state.user = { uid: 'u1', email: 'jefe@autopartes.test', emailVerified: true }; state.profile = { data: null, isLoading: true }; });
afterEach(() => cleanup());

describe('menú: Costos de mecanizado', () => {
  it('usuario con empresaId y el perfil ya cargado: lo ve, y apunta a /costos', () => {
    state.profile = { data: { role: 'user', empresaId: 'emp-a' }, isLoading: false };
    const c = render(<Header />).container;
    expect(links(c)).toContain(ITEM);
    expect(([...c.querySelectorAll('nav a')].find((a) => a.textContent?.trim() === ITEM) as HTMLAnchorElement).getAttribute('href')).toBe('/costos');
  });
  it('mientras el perfil carga, un usuario que no es de SECOCUT no lo ve', () => {
    expect(links(render(<Header />).container)).not.toContain(ITEM);
  });
  it('usuario sin empresaId (y que no es de SECOCUT): no lo ve', () => {
    state.profile = { data: { role: 'user' }, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain(ITEM);
  });
  it('perfil inexistente: no lo ve', () => {
    state.profile = { data: null, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain(ITEM);
  });
  it('personal SECOCUT verificado: lo ve, aunque el perfil esté cargando o no tenga empresa', () => {
    state.user = { uid: 'u2', email: 'vendedor@secocut.com', emailVerified: true };
    expect(links(render(<Header />).container)).toContain(ITEM);
    cleanup();
    state.profile = { data: { role: 'user' }, isLoading: false };
    expect(links(render(<Header />).container)).toContain(ITEM);
  });
  it('@secocut con el email sin verificar y sin empresaId: no lo ve', () => {
    state.user = { uid: 'u3', email: 'x@secocut.com', emailVerified: false };
    state.profile = { data: { role: 'user' }, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain(ITEM);
  });
  it('el resto del menú no cambia para el personal SECOCUT', () => {
    state.user = { uid: 'u2', email: 'vendedor@secocut.com', emailVerified: true };
    state.profile = { data: { role: 'user' }, isLoading: false };
    expect(links(render(<Header />).container)).toEqual(expect.arrayContaining(['Simulador', 'Historial de Análisis', 'Curva de Costos', ITEM]));
  });
});
