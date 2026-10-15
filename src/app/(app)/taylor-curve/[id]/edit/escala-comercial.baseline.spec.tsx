// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectGolden } from '../../../../../../tests/golden';
import { escalaComercialBase, escalaComercialBlock, installDomPolyfills, rechartsStub } from '../../../../../../tests/screen-mocks';

// LÍNEA BASE de la pantalla de EDICIÓN: bloque ESCALA COMERCIAL de `main` antes de la función de máquinas en
// paralelo, para un caso guardado (Toyota). FRÁGIL: depende de los nombres que importa de '@/firebase'.
const { stable } = vi.hoisted(() => ({
  stable: {
    user: { uid: 'u1', email: 'x@secocut.com', emailVerified: true },
    router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
    saved: {
      id: 'caso1', caseName: 'Toyota', clientName: 'Toyota',
      taylorInputs: {
        operationType: 'turning', materialId: 'Acero Medio Carbono (Ej: 1045, 4140)', machineCostHr: 20, toolChangeTime: 2, pieceName: 'Eje',
        machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85, profundidadAgujero: '', coolantInternal: false, drillingOrientation: 'vertical',
        monthlyProduction: 10000, lifeModeCurrent: 'piezas', lifeModePremium: 'piezas',
        toolNameCurrent: 'CNMA120412 KCK20', toolCostCurrent: 7.4, apCurrent: 1, feedCurrent: 0.3, vcCurrent: 220, pcsCurrent: 20, tcCurrent: 2, zCurrent: '', edgesCurrent: 4, dcCurrent: 50, aeCurrent: '',
        toolNamePremium: 'CNMA120412-MR9 TK1501', toolCostPremium: 11.72, apPremium: 1, feedPremium: 0.4, vcPremium: 240, pcsPremium: 40, tcPremiumInput: 1.375, zPremium: '', edgesPremium: 4, dcPremium: 50, aePremium: '',
      } as Record<string, unknown>,
    },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router, useParams: () => ({ id: 'caso1' }), usePathname: () => '/taylor-curve/caso1/edit' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/firebase', () => ({
  db: {}, storage: {}, useUser: () => ({ user: stable.user, loading: false }),
  useMemoFirebase: (f: () => unknown) => f(), useDoc: () => ({ data: stable.saved, isLoading: false }),
}));
vi.mock('firebase/firestore', () => ({ updateDoc: vi.fn(), serverTimestamp: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => false })), doc: vi.fn(() => ({})) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('jspdf', () => ({ default: class {} }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('@/lib/client/auth-fetch', () => ({ authedFetch: vi.fn(async () => new Response('{}')) }));
vi.mock('recharts', () => rechartsStub());

import EditPage from '@/app/(app)/taylor-curve/[id]/edit/page';

beforeAll(() => installDomPolyfills());
afterAll(() => cleanup());

describe('edición: bloque Escala Comercial sin máquinas en paralelo', () => {
  it('con el caso Toyota guardado coincide con el golden de main', () => {
    const { container } = render(<EditPage />);
    expectGolden('escala-comercial.edit.base.html', escalaComercialBase(container));
  });

  it('muestra las líneas de capacidad que ya existían (calculadas con 8 h × 1 turno × 22 días)', () => {
    const { container } = render(<EditPage />);
    const text = escalaComercialBlock(container).textContent ?? '';
    expect(text).toContain('Actual: ~350 hs/mes (≈ 2 máq.)');
    // 237,5 h está justo en el borde del redondeo: según el orden de las cuentas en coma flotante la app muestra 237 o 238.
    expect(text).toMatch(/Secocut: ~23[78] hs\/mes/);
  });
});
