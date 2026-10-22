// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Carga de la sesión inicial: nunca una promesa rechazada sin manejar, y siempre se sale del estado de carga.
const { getChatSession } = vi.hoisted(() => ({ getChatSession: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'u1', getIdToken: async () => 't' }, loading: false }) }));
vi.mock('@/lib/agents/firestore', () => ({ getChatSession }));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <span>{children}</span> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));

import AgentChat from '@/components/agents/AgentChat';

beforeAll(() => { (Element.prototype as any).scrollIntoView = () => {}; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const abrir = () => render(<AgentChat agentSlug="tecnico" initialSessionId="s1" />);

describe('AgentChat con initialSessionId', () => {
  it('sesión inexistente (null): "Sesión no encontrada" y sin estado de carga', async () => {
    getChatSession.mockResolvedValue(null);
    const q = abrir();
    await waitFor(() => expect(q.getByTestId('sesion-no-encontrada').textContent).toBe('Sesión no encontrada'));
    expect(q.queryByTestId('sesion-cargando')).toBeNull();
  });

  it('lectura rechazada (sin permiso, red): "Sesión no encontrada", sin carga y sin promesa rechazada sin manejar', async () => {
    getChatSession.mockRejectedValue(new Error('permission-denied'));
    const q = abrir();
    await waitFor(() => expect(q.getByTestId('sesion-no-encontrada')).toBeTruthy());
    expect(q.queryByTestId('sesion-cargando')).toBeNull();
  });

  it('mientras carga se ve el estado de carga, sin el mensaje de error', async () => {
    getChatSession.mockReturnValue(new Promise(() => {}));
    const q = abrir();
    expect(q.getByTestId('sesion-cargando')).toBeTruthy();
    expect(q.queryByTestId('sesion-no-encontrada')).toBeNull();
  });

  it('sesión propia: muestra la conversación', async () => {
    getChatSession.mockResolvedValue({ id: 's1', messages: [{ role: 'user', content: 'hola técnico' }, { role: 'assistant', content: 'hola, ¿en qué te ayudo?' }] });
    const q = abrir();
    await waitFor(() => expect(q.getByText('hola técnico')).toBeTruthy());
    expect(q.queryByTestId('sesion-no-encontrada')).toBeNull();
    expect(q.queryByTestId('sesion-cargando')).toBeNull();
  });
});
