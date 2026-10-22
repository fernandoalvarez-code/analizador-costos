import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conectarEmuladoresSiCorresponde, debeUsarEmuladores, reiniciarBanderaEmuladores,
  type Conectores, type EntornoEmuladores,
} from '@/firebase/emulators';

// Las tres condiciones para conectar los emuladores: NEXT_PUBLIC_USE_EMULATORS === 'true', NODE_ENV !== 'production' y
// projectId con prefijo "demo-". Si falta cualquiera no se conecta nada.
const auth = {} as never;
const db = {} as never;
const EMU: EntornoEmuladores = { useEmulators: 'true', nodeEnv: 'development', projectId: 'demo-costos' };

function conectores() {
  const c = { connectAuthEmulator: vi.fn(), connectFirestoreEmulator: vi.fn() } satisfies Conectores;
  return c;
}
beforeEach(() => reiniciarBanderaEmuladores());
afterEach(() => reiniciarBanderaEmuladores());

describe('conexión a los emuladores', () => {
  it('(1) con la variable, fuera de producción y con projectId "demo-costos": se conectan Auth y Firestore', () => {
    const c = conectores();
    expect(conectarEmuladoresSiCorresponde(auth, db, EMU, c)).toBe(true);
    expect(c.connectAuthEmulator).toHaveBeenCalledWith(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    expect(c.connectFirestoreEmulator).toHaveBeenCalledWith(db, '127.0.0.1', 8080);
  });

  it('(2) sin la variable: no se conecta ninguno', () => {
    const c = conectores();
    expect(conectarEmuladoresSiCorresponde(auth, db, { ...EMU, useEmulators: undefined }, c)).toBe(false);
    expect(c.connectAuthEmulator).not.toHaveBeenCalled();
    expect(c.connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('(3) con la variable pero con el projectId REAL (studio-...): no se conecta ninguno', () => {
    const c = conectores();
    expect(conectarEmuladoresSiCorresponde(auth, db, { ...EMU, projectId: 'studio-1546170521-5d9b0' }, c)).toBe(false);
    expect(c.connectAuthEmulator).not.toHaveBeenCalled();
    expect(c.connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('con NODE_ENV production no se conecta, aunque estén la variable y el projectId demo', () => {
    const c = conectores();
    expect(conectarEmuladoresSiCorresponde(auth, db, { ...EMU, nodeEnv: 'production' }, c)).toBe(false);
    expect(c.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it.each([['false'], ['1'], ['TRUE'], [''], [undefined]])('la variable debe ser exactamente "true" (%s no alcanza)', (valor) => {
    expect(debeUsarEmuladores({ ...EMU, useEmulators: valor })).toBe(false);
  });

  it.each([[undefined], [''], ['studio-demo'], ['costos-demo'], ['Demo-costos']])('projectId "%s" no cuenta como demo', (projectId) => {
    expect(debeUsarEmuladores({ ...EMU, projectId })).toBe(false);
  });

  it('NODE_ENV test o undefined (no production) sí cuenta', () => {
    expect(debeUsarEmuladores({ ...EMU, nodeEnv: 'test' })).toBe(true);
    expect(debeUsarEmuladores({ ...EMU, nodeEnv: undefined })).toBe(true);
  });

  it('hot reload: una segunda evaluación del módulo no vuelve a conectar (bandera global)', () => {
    const c = conectores();
    expect(conectarEmuladoresSiCorresponde(auth, db, EMU, c)).toBe(true);
    expect(conectarEmuladoresSiCorresponde(auth, db, EMU, c)).toBe(false);
    expect(c.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(c.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });

  it('si el SDK lanza (ya estaba conectado), no rompe y no reintenta', () => {
    const c = conectores();
    c.connectAuthEmulator.mockImplementation(() => { throw new Error('Auth instance has already been used'); });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => conectarEmuladoresSiCorresponde(auth, db, EMU, c)).not.toThrow();
    expect(conectarEmuladoresSiCorresponde(auth, db, EMU, c)).toBe(false);
    expect(c.connectAuthEmulator).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it('una evaluación sin condiciones no consume la bandera: una posterior válida sí conecta', () => {
    const c = conectores();
    conectarEmuladoresSiCorresponde(auth, db, { ...EMU, useEmulators: undefined }, c);
    expect(conectarEmuladoresSiCorresponde(auth, db, EMU, c)).toBe(true);
  });
});
