import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { currentUser } = vi.hoisted(() => ({ currentUser: { value: null as null | { getIdToken: () => Promise<string> } } }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ get currentUser() { return currentUser.value; } }) }));
vi.mock('@/firebase', () => ({}));

import { authedFetch } from '@/lib/client/auth-fetch';

describe('authedFetch', () => {
  const fetchMock = vi.fn(async () => new Response('{}'));
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockClear(); });
  afterEach(() => { currentUser.value = null; });

  const sentHeaders = () => new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);

  it('agrega el ID token como Bearer y conserva los otros headers y opciones', async () => {
    currentUser.value = { getIdToken: async () => 'TOKEN123' };
    await authedFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const h = sentHeaders();
    expect(h.get('Authorization')).toBe('Bearer TOKEN123');
    expect(h.get('Content-Type')).toBe('application/json');
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('POST');
  });

  it('sin sesión manda la request sin Authorization (el servidor responde 401)', async () => {
    await authedFetch('/api/chat', { method: 'POST' });
    expect(sentHeaders().has('Authorization')).toBe(false);
  });
});
