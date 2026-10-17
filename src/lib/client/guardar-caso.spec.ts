import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conTimeout, guardarCaso, MENSAJE_SIN_CONFIRMAR, TimeoutError } from '@/lib/client/guardar-caso';

const PDF = new Blob(['%PDF'], { type: 'application/pdf' });
const nunca = () => new Promise<never>(() => {});

describe('guardarCaso (Storage simulado)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('éxito: sube el PDF y escribe el caso con la URL', async () => {
    const escribirCaso = vi.fn(async () => 'ok');
    const r = await guardarCaso({ pdfBlob: PDF, subirPdf: async () => 'https://storage/x.pdf', escribirCaso });
    expect(escribirCaso).toHaveBeenCalledWith('https://storage/x.pdf');
    expect(r).toEqual({ pdfAdjuntado: true, motivoSinPdf: undefined });
  });

  it('error de Storage: guarda igual con pdfUrl vacío y avisa que no se adjuntó', async () => {
    const escribirCaso = vi.fn(async () => 'ok');
    const r = await guardarCaso({ pdfBlob: PDF, subirPdf: async () => { throw new Error('storage/unauthorized'); }, escribirCaso });
    expect(escribirCaso).toHaveBeenCalledWith('');
    expect(r.pdfAdjuntado).toBe(false);
    expect(r.motivoSinPdf).toContain('storage/unauthorized');
  });

  it('timeout de Storage (30 s): guarda igual con pdfUrl vacío', async () => {
    const escribirCaso = vi.fn(async () => 'ok');
    const p = guardarCaso({ pdfBlob: PDF, subirPdf: nunca, escribirCaso });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(escribirCaso).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const r = await p;
    expect(escribirCaso).toHaveBeenCalledWith('');
    expect(r.pdfAdjuntado).toBe(false);
    expect(r.motivoSinPdf).toMatch(/Subida del PDF.*30 s/);
  });

  it('sin PDF generado: no intenta subir y guarda con pdfUrl vacío', async () => {
    const subirPdf = vi.fn();
    const escribirCaso = vi.fn(async () => 'ok');
    const r = await guardarCaso({ pdfBlob: undefined, subirPdf, escribirCaso });
    expect(subirPdf).not.toHaveBeenCalled();
    expect(escribirCaso).toHaveBeenCalledWith('');
    expect(r.pdfAdjuntado).toBe(false);
  });

  it('la escritura en Firestore que no se confirma en 30 s lanza un mensaje claro', async () => {
    const p = guardarCaso({ pdfBlob: PDF, subirPdf: async () => 'u', escribirCaso: nunca });
    const asercion = expect(p).rejects.toThrow(MENSAJE_SIN_CONFIRMAR);
    await vi.advanceTimersByTimeAsync(30_000);
    await asercion;
  });

  it('un error de Firestore (p. ej. permission-denied) se propaga tal cual', async () => {
    const p = guardarCaso({ pdfBlob: PDF, subirPdf: async () => 'u', escribirCaso: async () => { throw new Error('permission-denied'); } });
    await expect(p).rejects.toThrow('permission-denied');
  });

  it('con Storage colgado y Firestore colgado: tarda 30 s + 30 s y termina con error (no queda trabado)', async () => {
    const p = guardarCaso({ pdfBlob: PDF, subirPdf: nunca, escribirCaso: nunca });
    const asercion = expect(p).rejects.toThrow(MENSAJE_SIN_CONFIRMAR);
    await vi.advanceTimersByTimeAsync(60_000);
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
