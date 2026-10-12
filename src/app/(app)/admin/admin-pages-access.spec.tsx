// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Las pantallas de administración no deben leer Firestore hasta confirmar que el usuario es un
// empleado SECOCUT verificado. FRÁGIL: si falla tras tocar una de estas páginas, revisar que sigan
// importando useUser de '@/firebase' y las funciones de '@/lib/agents/firestore' con estos nombres.
const { listAgents, listUserSessions, listKnowledgeEntries, session } = vi.hoisted(() => ({
  listAgents: vi.fn(), listUserSessions: vi.fn(), listKnowledgeEntries: vi.fn(),
  session: { user: null as null | { uid: string; email: string; emailVerified: boolean } },
}));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: session.user, loading: false }) }));
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
  secocut: { uid: 'u1', email: 'vendedor@secocut.com', emailVerified: true },
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
  it.each([['un usuario de otro dominio', users.gmail], ['un @secocut.com sin verificar', users.secocutSinVerificar]] as const)(
    'no lee Firestore para %s', async (_who, user) => {
      session.user = user;
      const { container } = render(<Page />);
      await settle();
      expect(reads()).not.toHaveBeenCalled();
      expect(listUserSessions).not.toHaveBeenCalled();
      expect(container.textContent).toMatch(/restringido/i);
    });

  it('sí lee para un @secocut.com verificado', async () => {
    session.user = users.secocut;
    render(<Page />);
    await settle();
    expect(reads()).toHaveBeenCalled();
  });
});

describe('admin/agents/test: las sesiones del usuario', () => {
  it('se consultan solo para un @secocut.com verificado', async () => {
    session.user = users.secocut;
    render(<AgentTestPage />);
    await settle();
    expect(listUserSessions).toHaveBeenCalledWith('u1', 'a1');
  });
});
