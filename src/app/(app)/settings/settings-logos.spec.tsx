// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El onSnapshot de settings/general (logos) debe manejar el error: una cuenta sin verificar es
// rechazada por las reglas y no debe dejar un error sin manejar en la consola. FRÁGIL: si falla tras
// tocar settings/page.tsx, revisar los nombres que importa de '@/firebase' y 'firebase/firestore'.
const { onSnapshot, unsubscribe, stable } = vi.hoisted(() => ({
  onSnapshot: vi.fn(), unsubscribe: vi.fn(),
  // Objetos estables entre renders (como los hooks reales): si no, los efectos se re-ejecutan en cada render.
  stable: {
    user: { uid: 'u1', email: 'cliente@gmail.com', emailVerified: false, displayName: 'Cliente' },
    firestore: {}, auth: {}, profile: { data: null },
  },
}));
vi.mock('firebase/firestore', () => ({ onSnapshot, setDoc: vi.fn() }));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: stable.user }),
  useFirestore: () => stable.firestore, useAuth: () => stable.auth, useMemoFirebase: (f: () => unknown) => f(), useDoc: () => stable.profile,
  updateDocumentNonBlocking: vi.fn(), doc: () => ({}), storage: {},
}));
vi.mock('@/components/app/users-management', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SettingsPage from '@/app/(app)/settings/page';

beforeEach(() => { vi.clearAllMocks(); onSnapshot.mockReturnValue(unsubscribe); });
afterEach(() => cleanup());

describe('settings/page: logos (settings/general)', () => {
  const errorCallback = () => {
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    const cb = onSnapshot.mock.calls[0][2];
    expect(cb, 'onSnapshot debe recibir un callback de error').toBeTypeOf('function');
    return cb as (e: { code: string }) => void;
  };

  it('registra un callback de error en el onSnapshot', () => {
    render(<SettingsPage />);
    errorCallback();
  });

  it('permission-denied (cuenta sin verificar) se maneja sin escribir nada en la consola', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SettingsPage />);
    errorCallback()({ code: 'permission-denied' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cualquier otro error sí se registra', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SettingsPage />);
    errorCallback()({ code: 'unavailable' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('al desmontar se cancela la suscripción', () => {
    const { unmount } = render(<SettingsPage />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
