// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Acceso a las tres pantallas de administración (admin/agents, admin/agents/test y admin/knowledge): solo un admin SECOCUT
// (users/{uid}.role === 'admin' Y email verificado @secocut.com). Reloj falso: nada espera en tiempo real.
// FRÁGIL: depende de los nombres que importan de '@/firebase' (useUser, useFirestore, useMemoFirebase, useDoc, doc) y de
// los títulos de cada pantalla.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { uid: string; email: string; emailVerified: boolean },
    userLoading: false,
    profile: { data: null as null | { role?: string }, isLoading: true, error: null as null | Error },
  },
}));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: state.user, loading: state.userLoading }),
  useFirestore: () => ({}),
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => state.profile,
  doc: vi.fn(() => ({})),
}));
vi.mock('@/lib/agents/firestore', () => ({
  listAgents: vi.fn(async () => []), createAgent: vi.fn(), updateAgent: vi.fn(), deleteAgent: vi.fn(),
  listUserSessions: vi.fn(async () => []), deleteChatSession: vi.fn(),
  listKnowledgeEntries: vi.fn(async () => []), createKnowledgeEntry: vi.fn(), updateKnowledgeEntry: vi.fn(), deleteKnowledgeEntry: vi.fn(),
}));
vi.mock('@/components/agents/AgentChat', () => ({ default: () => <div>chat</div> }));

import AdminAgentsPage from '@/app/(app)/admin/agents/page';
import AgentTestPage from '@/app/(app)/admin/agents/test/page';
import AdminKnowledgePage from '@/app/(app)/admin/knowledge/page';
import { PERFIL_TOPE_MS } from '@/hooks/use-secocut-admin-access';

const PANTALLAS = [
  ['admin/agents', AdminAgentsPage, 'Agentes IA'],
  ['admin/agents/test', AgentTestPage, 'Probar agentes'],
  ['admin/knowledge', AdminKnowledgePage, 'Base de conocimiento'],
] as const;

const ADMIN_SECOCUT = { uid: 'u1', email: 'admin@secocut.com', emailVerified: true };

beforeEach(() => {
  vi.useFakeTimers();
  state.user = ADMIN_SECOCUT;
  state.userLoading = false;
  state.profile = { data: null, isLoading: true, error: null };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe.each(PANTALLAS)('%s', (_nombre, Pantalla, titulo) => {
  const ver = (q: ReturnType<typeof render>) => ({
    cargando: q.queryByTestId('admin-cargando'),
    aviso: q.queryByTestId('admin-acceso-restringido'),
    contenido: q.queryByText(titulo),
    botones: q.queryAllByRole('button'),
  });
  const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const llegaPerfil = async (q: ReturnType<typeof render>, perfil: { role?: string }) => {
    state.profile = { data: perfil, isLoading: false, error: null };
    await act(async () => { q.rerender(<Pantalla />); });
  };

  describe('F: estado de carga mientras el perfil no llegó', () => {
    it('sin perfil se ve la carga: sin contenido, sin botones y sin el aviso', () => {
      const v = ver(render(<Pantalla />));
      expect(v.cargando).not.toBeNull();
      expect(v.aviso).toBeNull();
      expect(v.contenido).toBeNull();
      expect(v.botones).toHaveLength(0);
    });
    it('mientras se resuelve la sesión también se ve la carga', () => {
      state.userLoading = true; state.user = null;
      const v = ver(render(<Pantalla />));
      expect(v.cargando).not.toBeNull();
      expect(v.aviso).toBeNull();
    });
    it('un admin SECOCUT ve el contenido apenas llega el perfil, sin destello del aviso', async () => {
      const q = render(<Pantalla />);
      expect(ver(q).aviso).toBeNull();
      await llegaPerfil(q, { role: 'admin' });
      const v = ver(q);
      expect(v.contenido).not.toBeNull();
      expect(v.aviso).toBeNull();
      expect(v.cargando).toBeNull();
    });
  });

  describe('G: perfil que no llega', () => {
    it('perfil con error (permisos, red): el aviso aparece enseguida, sin spinner ni contenido', async () => {
      state.profile = { data: null, isLoading: false, error: new Error('permission-denied') };
      const v = ver(render(<Pantalla />));
      expect(v.aviso).not.toBeNull();
      expect(v.cargando).toBeNull();
      expect(v.contenido).toBeNull();
      expect(v.botones).toHaveLength(0);
    });
    it('perfil inexistente: el aviso aparece enseguida', () => {
      state.profile = { data: null, isLoading: false, error: null };
      const v = ver(render(<Pantalla />));
      expect(v.aviso).not.toBeNull();
      expect(v.cargando).toBeNull();
      expect(v.contenido).toBeNull();
    });
    it('perfil que llega tarde: carga durante los 10 s y después aviso (sin spinner infinito)', async () => {
      const q = render(<Pantalla />);
      await avanzar(PERFIL_TOPE_MS - 1);
      expect(ver(q).cargando).not.toBeNull();
      expect(ver(q).aviso).toBeNull();
      await avanzar(1);
      expect(ver(q).aviso).not.toBeNull();
      expect(ver(q).cargando).toBeNull();
      expect(ver(q).contenido).toBeNull();
    });
  });

  describe('H: perfil que llega DESPUÉS de los 10 s', () => {
    it('admin SECOCUT: la pantalla se corrige sola y reemplaza el aviso por el contenido', async () => {
      const q = render(<Pantalla />);
      await avanzar(PERFIL_TOPE_MS);
      expect(ver(q).aviso).not.toBeNull();
      expect(ver(q).contenido).toBeNull();
      await llegaPerfil(q, { role: 'admin' });
      expect(ver(q).contenido).not.toBeNull();
      expect(ver(q).aviso).toBeNull();
      expect(ver(q).cargando).toBeNull();
    });
  });

  // H bis / H ter: si llega tarde y NO es admin SECOCUT, el aviso se mantiene y el contenido no aparece nunca.
  describe.each([
    ['rol user', { uid: 'u1', email: 'ana@secocut.com', emailVerified: true }, { role: 'user' }],
    ['admin con email de otro dominio', { uid: 'u1', email: 'admin@gmail.com', emailVerified: true }, { role: 'admin' }],
    ['admin @secocut con el email sin verificar', { uid: 'u1', email: 'admin@secocut.com', emailVerified: false }, { role: 'admin' }],
  ])('H bis/ter: %s', (_caso, usuario, perfil) => {
    it('(1) primeros 10 s sin perfil: carga, sin contenido, sin botones y sin el aviso', async () => {
      state.user = usuario;
      const q = render(<Pantalla />);
      await avanzar(PERFIL_TOPE_MS - 1);
      const v = ver(q);
      expect(v.cargando).not.toBeNull();
      expect(v.aviso).toBeNull();
      expect(v.contenido).toBeNull();
      expect(v.botones).toHaveLength(0);
    });
    it('(2) pasados los 10 s sin perfil: aviso de acceso restringido, sin contenido ni botones', async () => {
      state.user = usuario;
      const q = render(<Pantalla />);
      await avanzar(PERFIL_TOPE_MS);
      const v = ver(q);
      expect(v.aviso).not.toBeNull();
      expect(v.cargando).toBeNull();
      expect(v.contenido).toBeNull();
      expect(v.botones).toHaveLength(0);
    });
    it('(3) después de que llega el perfil: el aviso se mantiene, sin contenido ni botones', async () => {
      state.user = usuario;
      const q = render(<Pantalla />);
      await avanzar(PERFIL_TOPE_MS);
      await llegaPerfil(q, perfil);
      await avanzar(PERFIL_TOPE_MS);
      const v = ver(q);
      expect(v.aviso).not.toBeNull();
      expect(v.cargando).toBeNull();
      expect(v.contenido).toBeNull();
      expect(v.botones).toHaveLength(0);
    });
  });
});
