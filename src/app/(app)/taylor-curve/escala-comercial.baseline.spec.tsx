// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectGolden } from '../../../../tests/golden';
import { escalaComercialBase, escalaComercialBlock, fillToyotaPage, installDomPolyfills, rechartsStub } from '../../../../tests/screen-mocks';

// LÍNEA BASE de la pantalla "Curva de costos": el bloque ESCALA COMERCIAL tal como lo renderiza `main` antes
// de la función de máquinas en paralelo. Con el campo vacío tiene que seguir siendo idéntico.
// FRÁGIL: si falla tras tocar page.tsx, revisar que los placeholders de los campos usados sigan existiendo.
const { stable } = vi.hoisted(() => ({ stable: { user: { uid: 'u1', email: 'x@secocut.com', emailVerified: true }, router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() }, toast: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router, usePathname: () => '/taylor-curve' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: stable.toast }) }));
vi.mock('@/firebase', () => ({ db: {}, storage: {}, useUser: () => ({ user: stable.user, loading: false }) }));
vi.mock('firebase/firestore', () => ({ addDoc: vi.fn(), collection: vi.fn(), serverTimestamp: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => false })), doc: vi.fn() }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('jspdf', () => ({ default: class {} }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('@/lib/client/auth-fetch', () => ({ authedFetch: vi.fn(async () => new Response('{}')) }));
vi.mock('recharts', () => rechartsStub());

import Page from '@/app/(app)/taylor-curve/page';

beforeAll(() => installDomPolyfills());
afterAll(() => cleanup());

function renderToyota() {
  const view = render(<Page />);
  fillToyotaPage(view.container);
  return view;
}

describe('pantalla: bloque Escala Comercial sin máquinas en paralelo (línea base)', () => {
  it('con el caso Toyota coincide con el golden de main', () => {
    const { container } = renderToyota();
    expectGolden('escala-comercial.page.base.html', escalaComercialBase(container));
  });

  it('muestra las líneas de capacidad que ya existían (350 y 238 hs/mes, ≈ 2 máq. en la actual)', () => {
    const { container } = renderToyota();
    const text = escalaComercialBlock(container).textContent ?? '';
    expect(text).toContain('Actual: ~350 hs/mes (≈ 2 máq.)');
    expect(text).toContain('Secocut: ~238 hs/mes');
    expect(text).toContain('113 hs máquina liberadas/mes');
  });
});
