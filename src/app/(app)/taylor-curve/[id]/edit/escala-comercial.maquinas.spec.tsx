// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectGolden } from '../../../../../../tests/golden';
import { escalaComercialBase, escalaComercialBlock, installDomPolyfills, rechartsStub, typeInto } from '../../../../../../tests/screen-mocks';

// Máquinas en paralelo en la pantalla de EDICIÓN (opción C): se restauran y conservan horasPorTurno/turnosPorDia del caso
// guardado y se usan SOLO en el bloque nuevo; el resto de la pantalla sigue con 8 h × 1 turno como hoy.
// Caso Toyota: 350 y 237,5 hs/mes. FRÁGIL: depende de los nombres que importa de '@/firebase' y de firebase/firestore.
const { stable, updateDoc } = vi.hoisted(() => ({
  updateDoc: vi.fn(async () => {}),
  stable: {
    user: { uid: 'u1', email: 'x@secocut.com', emailVerified: true },
    router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
    saved: { id: 'caso1', caseName: 'Toyota', clientName: 'Toyota', taylorInputs: {} as Record<string, unknown> },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router, useParams: () => ({ id: 'caso1' }), usePathname: () => '/x' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/firebase', () => ({
  db: {}, storage: {}, useUser: () => ({ user: stable.user, loading: false }),
  useMemoFirebase: (f: () => unknown) => f(), useDoc: () => ({ data: stable.saved, isLoading: false }),
}));
vi.mock('firebase/firestore', () => ({ updateDoc, serverTimestamp: vi.fn(() => 'TS'), getDoc: vi.fn(async () => ({ exists: () => false })), doc: vi.fn(() => ({})) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(async () => ({ ref: {} })), getDownloadURL: vi.fn(async () => 'https://pdf') }));
vi.mock('jspdf', () => ({ default: class { addImage() {} addPage() {} save() {} output() { return new Blob(['pdf']); } } }));
vi.mock('html2canvas', () => ({ default: vi.fn(async () => ({ toDataURL: () => 'data:', width: 794, height: 1123 })) }));
vi.mock('@/lib/client/auth-fetch', () => ({ authedFetch: vi.fn(async () => new Response('{}')) }));
vi.mock('recharts', () => rechartsStub());

import EditPage from '@/app/(app)/taylor-curve/[id]/edit/page';

const BASE_INPUTS = {
  operationType: 'turning', materialId: 'Acero Medio Carbono (Ej: 1045, 4140)', machineCostHr: 20, toolChangeTime: 2, pieceName: 'Eje',
  machinePowerHP: 15, maxTorque: 200, machineEfficiency: 0.85, profundidadAgujero: '', coolantInternal: false, drillingOrientation: 'vertical',
  monthlyProduction: 10000, lifeModeCurrent: 'piezas', lifeModePremium: 'piezas',
  toolNameCurrent: 'CNMA120412 KCK20', toolCostCurrent: 7.4, apCurrent: 1, feedCurrent: 0.3, vcCurrent: 220, pcsCurrent: 20, tcCurrent: 2, zCurrent: '', edgesCurrent: 4, dcCurrent: 50, aeCurrent: '',
  toolNamePremium: 'CNMA120412-MR9 TK1501', toolCostPremium: 11.72, apPremium: 1, feedPremium: 0.4, vcPremium: 240, pcsPremium: 40, tcPremiumInput: 1.375, zPremium: '', edgesPremium: 4, dcPremium: 50, aePremium: '',
};
const open = (extra: Record<string, unknown> = {}) => {
  stable.saved.taylorInputs = { ...BASE_INPUTS, ...extra };
  return render(<EditPage />).container;
};
const machines = (c: HTMLElement) => c.querySelector('input[aria-label="Máquinas en paralelo"]') as HTMLInputElement;
const days = (c: HTMLElement) => c.querySelector('input[aria-label="Días de trabajo por mes"]') as HTMLInputElement;
const result = (c: HTMLElement) => c.querySelector('[data-testid="escala-maquinas-resultado"]');
const text = (c: HTMLElement) => escalaComercialBlock(c).textContent ?? '';

beforeAll(() => { installDomPolyfills(); vi.stubGlobal('alert', vi.fn()); });
afterAll(() => cleanup());
beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('caso guardado SIN los campos nuevos (anterior a esta función)', () => {
  it('se abre igual: máquinas vacío, 22 días, sin resultado, y el bloque es idéntico al de main', () => {
    const c = open();
    expect(machines(c).value).toBe('');
    expect(days(c).value).toBe('22');
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.edit.base.html', escalaComercialBase(c));
  });

  it('completar N muestra el resultado con 8 h × 1 turno × 22 días (no hay otros datos guardados)', () => {
    const c = open();
    typeInto(machines(c), '2');
    expect(text(c)).toContain('Utilización teórica: 99 % → 67 %');
    expect(text(c)).toContain('Base: 2 máq. × 8 h × 1 turno × 22 días = 352 hs/mes disponibles');
  });

  it('completar y volver a vaciar N deja el bloque idéntico al de main', () => {
    const c = open();
    typeInto(machines(c), '2');
    typeInto(machines(c), '');
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.edit.base.html', escalaComercialBase(c));
  });
});

describe('caso guardado CON máquinas en paralelo', () => {
  it('restaura los dos campos y calcula: 2 máq., 22 días -> 99 % → 67 %, necesarias 2 → 2', () => {
    const c = open({ machinesParallel: 2, workDaysPerMonth: 22, horasPorTurno: 8, turnosPorDia: 1 });
    expect(machines(c).value).toBe('2');
    expect(days(c).value).toBe('22');
    const t = text(c);
    expect(t).toContain('Utilización teórica: 99 % → 67 %');
    expect(t).toContain('Máquinas necesarias: 2 → 2');
    expect(t).toContain('≈ 0,6 máquinas equivalentes liberadas');
    expect(t).not.toContain('≈ 2 máq.'); // el "≈ N máq." anterior se oculta con el bloque nuevo activo
  });

  it('restaura los días guardados (20) y los usa: 2 máq. -> 320 hs/mes, 109 %, necesarias 3 → 2', () => {
    const c = open({ machinesParallel: 2, workDaysPerMonth: 20 });
    expect(days(c).value).toBe('20');
    expect(text(c)).toContain('Base: 2 máq. × 8 h × 1 turno × 20 días = 320 hs/mes disponibles');
    expect(text(c)).toContain('Máquinas necesarias: 3 → 2');
  });
});

describe('opción C: horas por turno y turnos del caso guardado solo en el bloque nuevo', () => {
  it('guardado con 2 turnos y N=1: el bloque nuevo usa 8 h × 2 turnos × 22 días = 352 hs', () => {
    const c = open({ horasPorTurno: 8, turnosPorDia: 2, machinesParallel: 1, workDaysPerMonth: 22 });
    expect(text(c)).toContain('Base: 1 máq. × 8 h × 2 turnos × 22 días = 352 hs/mes disponibles');
    expect(text(c)).toContain('Utilización teórica: 99 % → 67 %');
  });

  it('el resto de la pantalla NO cambia con esos datos: con N vacío es idéntica a main (≈ 2 máq. con 8 × 1)', () => {
    const c = open({ horasPorTurno: 8, turnosPorDia: 2 });
    expect(result(c)).toBeNull();
    expectGolden('escala-comercial.edit.base.html', escalaComercialBase(c));
    expect(text(c)).toContain('Actual: ~350 hs/mes (≈ 2 máq.)');
  });

  it('un valor guardado inválido (Hrs/Trn vacío) apaga el bloque nuevo sin romper nada', () => {
    const c = open({ horasPorTurno: '', turnosPorDia: 1, machinesParallel: 2 });
    expect(result(c)).toBeNull();
    expect(text(c)).toContain('Actual: ~350 hs/mes');
  });
});

describe('PDF generado desde la edición', () => {
  it('la página 1 lleva la tarjeta cuando hay máquinas en paralelo, y no cuando no', () => {
    const conN = open({ machinesParallel: 2 });
    expect(conN.querySelector('#pdf-pagina-1')?.textContent).toContain('Utilización teórica: 99 % → 67 %');
    cleanup();
    const sinN = open();
    expect(sinN.querySelector('#pdf-pagina-1')?.textContent).not.toContain('Utilización teórica');
    expect(sinN.querySelector('#pdf-pagina-1')?.textContent).toContain('Capacidad requerida');
  });
});

describe('guardar un caso editado', () => {
  async function save(c: HTMLElement) {
    fireEvent.click([...c.querySelectorAll('button')].find((b) => b.textContent?.includes('Guardar Análisis'))!);
    const confirmar = [...c.querySelectorAll('button')].filter((b) => b.textContent?.includes('Guardar Análisis')).pop()!;
    await act(async () => { fireEvent.click(confirmar); });
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    return (updateDoc.mock.calls[0] as unknown as [unknown, { taylorInputs: Record<string, unknown> }])[1].taylorInputs;
  }

  it('guarda los campos nuevos y CONSERVA horasPorTurno y turnosPorDia (antes se perdían)', async () => {
    const c = open({ horasPorTurno: 8, turnosPorDia: 2, machinesParallel: 2, workDaysPerMonth: 22 });
    typeInto(machines(c), '3');
    typeInto(days(c), '20');
    const inputs = await save(c);
    expect(inputs.machinesParallel).toBe(3);
    expect(inputs.workDaysPerMonth).toBe(20);
    expect(inputs.horasPorTurno).toBe(8);
    expect(inputs.turnosPorDia).toBe(2);
    expect(inputs.monthlyProduction).toBe(10000); // y lo de siempre sigue guardándose
  });

  it('un caso sin horas/turnos guardados no recibe claves undefined (Firestore las rechaza)', async () => {
    const c = open();
    const inputs = await save(c);
    expect('horasPorTurno' in inputs).toBe(false);
    expect('turnosPorDia' in inputs).toBe(false);
    expect(inputs.machinesParallel).toBe('');
    expect(inputs.workDaysPerMonth).toBe(22);
    expect(Object.values(inputs).includes(undefined)).toBe(false);
  });
});
