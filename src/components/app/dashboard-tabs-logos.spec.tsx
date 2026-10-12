// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Igual que settings: el onSnapshot de settings/general (logos) debe manejar el error, porque una cuenta
// sin verificar es rechazada por las reglas. FRÁGIL: si falla tras tocar dashboard-tabs.tsx, revisar los
// nombres que importa de '@/firebase', 'firebase/firestore' y 'next/navigation'.
const { onSnapshot, unsubscribe, stable } = vi.hoisted(() => ({
  onSnapshot: vi.fn(), unsubscribe: vi.fn(),
  // Objetos estables entre renders (como los hooks reales): si no, los efectos se re-ejecutan en cada render.
  stable: { user: { uid: 'u1', email: 'x@secocut.com', emailVerified: false }, firestore: {}, router: { push: vi.fn(), replace: vi.fn() } },
}));
vi.mock('firebase/firestore', () => ({
  onSnapshot, setDoc: vi.fn(), serverTimestamp: vi.fn(), Timestamp: { now: vi.fn() },
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: stable.user }), useFirestore: () => stable.firestore,
  collection: () => ({}), doc: () => ({}), storage: {},
}));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/app/image-uploader', () => ({ ImageUploader: () => null }));

import DashboardTabs from '@/components/app/dashboard-tabs';

beforeEach(() => { vi.clearAllMocks(); onSnapshot.mockReturnValue(unsubscribe); });
afterEach(() => cleanup());

describe('dashboard-tabs: logos (settings/general)', () => {
  const errorCallback = () => {
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    const cb = onSnapshot.mock.calls[0][2];
    expect(cb, 'onSnapshot debe recibir un callback de error').toBeTypeOf('function');
    return cb as (e: { code: string }) => void;
  };

  it('registra un callback de error en el onSnapshot', () => {
    render(<DashboardTabs />);
    errorCallback();
  });

  it('permission-denied (cuenta sin verificar) se maneja sin escribir nada en la consola', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<DashboardTabs />);
    errorCallback()({ code: 'permission-denied' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cualquier otro error sí se registra', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<DashboardTabs />);
    errorCallback()({ code: 'unavailable' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('al desmontar se cancela la suscripción', () => {
    const { unmount } = render(<DashboardTabs />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
