// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Las pantallas de administración no deben leer Firestore hasta confirmar que el usuario es un ADMIN SECOCUT
// (users/{uid}.role === 'admin' y email verificado @secocut.com). Los estados de carga y aviso están en admin-acceso.spec.tsx.
// FRÁGIL: si falla tras tocar una de estas páginas, revisar que sigan importando useUser de '@/firebase' y las
// funciones de '@/lib/agents/firestore' con estos nombres (y que useSecocutAdminAccess use useDoc/useFirestore/doc).
const { listAgents, listUserSessions, listKnowledgeEntries, session } = vi.hoisted(() => ({
  listAgents: vi.fn(), listUserSessions: vi.fn(), listKnowledgeEntries: vi.fn(),
  session: { user: null as null | { uid: string; email: string; emailVerified: boolean }, role: undefined as string | undefined, perfilLlego: true },
}));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: session.user, loading: false }),
  useFirestore: () => ({}),
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => ({ data: session.perfilLlego && session.role ? { role: session.role } : null, isLoading: !session.perfilLlego, error: null }),
  doc: vi.fn(() => ({})),
}));
vi.mock('@/lib/agents/firestore', () => ({
  listAgents, listUserSessions, listKnowledgeEntries,
  createAgent: vi.fn(), updateAgent: vi.fn(), deleteAgent: vi.fn(), deleteChatSession: vi.fn(),
  createKnowledgeEntry: vi.fn(), updateKnowledgeEntry: vi.fn(), deleteKnowledgeEntry: vi.fn(),
}));
vi.mock('@/components/agents/AgentChat', () => ({ default: () => null }));

import AdminAgentsPage from '@/app/(app)/admin/agents/page';
import AgentTestPage from '@/app/(app)/admin/agents/test/page';
import AdminKnowledgePage from '@/app/(app)/admin/knowledge/page';

const users = {
  adminSecocut: { uid: 'u1', email: 'admin@secocut.com', emailVerified: true },
  vendedorSecocut: { uid: 'u4', email: 'vendedor@secocut.com', emailVerified: true },
  secocutSinVerificar: { uid: 'u2', email: 'x@secocut.com', emailVerified: false },
  gmail: { uid: 'u3', email: 'cliente@gmail.com', emailVerified: true },
};
// Agente con todos los campos que lee la pantalla (knowledgeCategories, etc.).
const agent = {
  id: 'a1', name: 'Técnico', slug: 'tecnico', description: 'Agente técnico', systemPrompt: '...', tone: 'tecnico' as const,
  color: '#2563eb', icon: 'Wrench', knowledgeCategories: ['catalogo'], isActive: true,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), createdBy: 'admin@secocut.com',
};
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  vi.clearAllMocks();
  session.perfilLlego = true;
  session.role = undefined;
  listAgents.mockResolvedValue([agent]);
  listUserSessions.mockResolvedValue([]);
  listKnowledgeEntries.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe.each([
  ['admin/agents', AdminAgentsPage, () => listAgents],
  ['admin/agents/test', AgentTestPage, () => listAgents],
  ['admin/knowledge', AdminKnowledgePage, () => listKnowledgeEntries],
] as const)('%s', (_name, Page, reads) => {
  it.each([
    ['un admin de otro dominio', users.gmail, 'admin'],
    ['un admin @secocut.com sin verificar', users.secocutSinVerificar, 'admin'],
    ['un @secocut.com verificado con rol user', users.vendedorSecocut, 'user'],
  ] as const)('no lee Firestore para %s', async (_who, user, role) => {
    session.user = user;
    session.role = role;
    const { container } = render(<Page />);
    await settle();
    expect(reads()).not.toHaveBeenCalled();
    expect(listUserSessions).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/restringido/i);
  });

  it('no lee Firestore mientras el perfil no llegó', async () => {
    session.user = users.adminSecocut;
    session.role = 'admin';
    session.perfilLlego = false;
    render(<Page />);
    await settle();
    expect(reads()).not.toHaveBeenCalled();
  });

  it('sí lee para un admin @secocut.com verificado', async () => {
    session.user = users.adminSecocut;
    session.role = 'admin';
    render(<Page />);
    await settle();
    expect(reads()).toHaveBeenCalled();
  });
});

describe('admin/agents/test: las sesiones del usuario', () => {
  it('se consultan solo para un admin @secocut.com verificado', async () => {
    session.user = users.adminSecocut;
    session.role = 'admin';
    render(<AgentTestPage />);
    await settle();
    expect(listUserSessions).toHaveBeenCalledWith('u1', 'a1');
  });
});
