// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Menú del encabezado: "Agentes IA" solo para el admin SECOCUT (perfil ya cargado, role 'admin' y email verificado
// @secocut.com); mientras el perfil carga, oculto. FRÁGIL: depende de los nombres que importa header.tsx de '@/firebase'.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { uid: string; email: string; emailVerified: boolean; displayName?: string },
    profile: { data: null as null | { role?: string }, isLoading: true },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/history' }));
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

beforeEach(() => { state.user = { uid: 'u1', email: 'admin@secocut.com', emailVerified: true }; state.profile = { data: null, isLoading: true }; });
afterEach(() => cleanup());

describe('menú del encabezado: Agentes IA', () => {
  it('mientras el perfil carga queda oculto (aunque el email sea @secocut verificado)', () => {
    expect(links(render(<Header />).container)).not.toContain('Agentes IA');
  });
  it('admin SECOCUT con el perfil cargado: lo ve', () => {
    state.profile = { data: { role: 'admin' }, isLoading: false };
    expect(links(render(<Header />).container)).toContain('Agentes IA');
  });
  it('@secocut verificado con rol user: no lo ve, pero conserva el resto del menú', () => {
    state.profile = { data: { role: 'user' }, isLoading: false };
    const l = links(render(<Header />).container);
    expect(l).not.toContain('Agentes IA');
    expect(l).toEqual(expect.arrayContaining(['Simulador', 'Historial de Análisis', 'Curva de Costos']));
  });
  it('admin con email de otro dominio: no lo ve', () => {
    state.user = { uid: 'u1', email: 'admin@gmail.com', emailVerified: true };
    state.profile = { data: { role: 'admin' }, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain('Agentes IA');
  });
  it('admin @secocut con el email sin verificar: no lo ve', () => {
    state.user = { uid: 'u1', email: 'admin@secocut.com', emailVerified: false };
    state.profile = { data: { role: 'admin' }, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain('Agentes IA');
  });
  it('perfil cargado pero inexistente: no lo ve', () => {
    state.profile = { data: null, isLoading: false };
    expect(links(render(<Header />).container)).not.toContain('Agentes IA');
  });
});
