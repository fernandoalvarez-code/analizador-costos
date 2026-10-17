import { describe, expect, it } from 'vitest';
import {
  estadoEdicionCurva, getEditRoute, getTipoDocumento, nombreCaso, nombreCliente, usuarioDelDocumento,
  type DocumentoAnalisis,
} from '@/lib/tipo-documento';

const curva = { id: 'c1', taylorInputs: { operationType: 'turning' }, clientName: 'Toyota', caseName: 'Eje', userId: 'u1' };
const simulacion = { id: 's1', inputs: { clientName: 'Roma' }, results: {}, clientName: 'Roma', caseName: 'Simulación Roma', userId: 'u1' };
const caso = { id: 'k1', name: 'Cañiflex', cliente: 'Cañiflex SA', results: {}, userId: 'u2', history: [{ lastModifiedByEmail: 'ana@secocut.com' }] };

describe('getTipoDocumento', () => {
  it('curva de costos: tiene taylorInputs', () => expect(getTipoDocumento(curva)).toBe('curva'));
  it('simulación: inputs y results sin taylorInputs', () => expect(getTipoDocumento(simulacion)).toBe('simulacion'));
  it('caso de éxito: el resto', () => expect(getTipoDocumento(caso)).toBe('caso'));
  it('taylorInputs null o no objeto no cuenta como curva', () => {
    expect(getTipoDocumento({ id: 'x', taylorInputs: null })).toBe('caso');
    expect(getTipoDocumento({ id: 'x', taylorInputs: 'texto' })).toBe('caso');
  });
});

describe('getEditRoute', () => {
  it('curva → editor de la curva', () => expect(getEditRoute(curva)).toBe('/taylor-curve/c1/edit'));
  it('caso de éxito → editor de casos', () => expect(getEditRoute(caso)).toBe('/cases/k1/edit'));
  it('simulación → editor de casos', () => expect(getEditRoute(simulacion)).toBe('/cases/s1/edit'));
});

describe('estadoEdicionCurva (taylor-curve/[id]/edit)', () => {
  it('cargando', () => expect(estadoEdicionCurva(true, null)).toEqual({ estado: 'cargando' }));
  it('no existe → historial', () => expect(estadoEdicionCurva(false, null)).toEqual({ estado: 'inexistente', destino: '/history' }));
  it('sin taylorInputs → redirige al editor correcto', () => {
    expect(estadoEdicionCurva(false, caso)).toEqual({ estado: 'otro-tipo', destino: '/cases/k1/edit' });
  });
  it('con taylorInputs → ok', () => expect(estadoEdicionCurva(false, curva)).toEqual({ estado: 'ok' }));
});

describe('nombres con respaldo', () => {
  it('curva y simulación usan clientName/caseName', () => {
    expect(nombreCliente(curva)).toBe('Toyota');
    expect(nombreCaso(simulacion)).toBe('Simulación Roma');
  });
  it('caso de éxito cae en cliente/name', () => {
    expect(nombreCliente(caso)).toBe('Cañiflex SA');
    expect(nombreCaso(caso)).toBe('Cañiflex');
  });
  it('sin ningún campo devuelve vacío', () => expect(nombreCliente({} as DocumentoAnalisis)).toBe(''));
});

describe('usuarioDelDocumento (solo datos del documento y de la sesión)', () => {
  const yo = { uid: 'u1', email: 'yo@secocut.com', displayName: 'Fernando' };
  it('documento propio: nombre de la sesión, o su email', () => {
    expect(usuarioDelDocumento(curva, yo)).toBe('Fernando');
    expect(usuarioDelDocumento(curva, { uid: 'u1', email: 'yo@secocut.com' })).toBe('yo@secocut.com');
  });
  it('ajeno con email guardado en el historial del caso', () => expect(usuarioDelDocumento(caso, yo)).toBe('ana@secocut.com'));
  it('ajeno sin dato: uid abreviado', () => expect(usuarioDelDocumento({ id: 'z', userId: 'abcdef123456' }, yo)).toBe('Usuario …123456'));
  it('sin userId', () => expect(usuarioDelDocumento({ id: 'z' }, yo)).toBe('Sin usuario'));
});
