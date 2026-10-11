import { describe, expect, it } from 'vitest';
import { calcRPM, calcTc, calcVf } from '@/lib/machining-physics';

// Prueba de humo de vitest y del alias "@". Mismo caso que machining-physics.test.ts
// (que sigue siendo un script de tsx), pero con aserciones reales.
describe('machining-physics (humo de vitest)', () => {
  it('torneado Vc 200, D 50, fn 0,2, L 100', () => {
    const rpm = calcRPM(200, 50);
    expect(rpm).toBeCloseTo(1273.24, 2);
    expect(calcVf(rpm, 0.2)).toBeCloseTo(254.65, 2);
    expect(calcTc(100, calcVf(rpm, 0.2))).toBeCloseTo(0.3927, 3);
  });
});
