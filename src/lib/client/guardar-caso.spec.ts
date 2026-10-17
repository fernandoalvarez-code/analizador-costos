import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conTimeout, guardarCaso, MENSAJE_SIN_CONFIRMAR, TimeoutError } from '@/lib/client/guardar-caso';

const nunca = () => new Promise<never>(() => {});

describe('guardarCaso (Firestore simulado)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('éxito: escribe el caso una vez y no deja timers pendientes', async () => {
    const escribirCaso = vi.fn(async () => 'ok');
    await expect(guardarCaso({ escribirCaso })).resolves.toBeUndefined();
    expect(escribirCaso).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('error de Firestore (p. ej. permission-denied): se propaga tal cual', async () => {
    await expect(guardarCaso({ escribirCaso: async () => { throw new Error('permission-denied'); } })).rejects.toThrow('permission-denied');
  });

  it('un throw síncrono de la escritura también se propaga como rechazo', async () => {
    await expect(guardarCaso({ escribirCaso: () => { throw new Error('boom'); } })).rejects.toThrow('boom');
  });

  it('timeout (30 s): lanza un mensaje claro y no antes', async () => {
    const p = guardarCaso({ escribirCaso: nunca });
    const asercion = expect(p).rejects.toThrow(MENSAJE_SIN_CONFIRMAR);
    await vi.advanceTimersByTimeAsync(29_999);
    let resuelta = false;
    p.catch(() => { resuelta = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(resuelta).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await asercion;
  });

  it('respeta un timeout distinto', async () => {
    const p = guardarCaso({ escribirCaso: nunca, timeoutEscrituraMs: 1000 });
    const asercion = expect(p).rejects.toThrow(MENSAJE_SIN_CONFIRMAR);
    await vi.advanceTimersByTimeAsync(1000);
    await asercion;
  });
});

describe('conTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('devuelve el valor si llega a tiempo y no deja timers pendientes', async () => {
    await expect(conTimeout(Promise.resolve(7), 1000, 'x')).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rechaza con TimeoutError al vencer', async () => {
    const p = conTimeout(nunca(), 1000, 'Paso');
    const a = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await a;
  });
});
