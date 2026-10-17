import { describe, expect, it } from 'vitest';
import {
  accionesDisponibles, estadoEdicionCurva, getEditRoute, mapaUsuarios, getTipoDocumento, nombreCaso, nombreCliente, usuarioDelDocumento,
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
  it('simulación → null (no se edita)', () => expect(getEditRoute(simulacion)).toBeNull());
});

describe('estadoEdicionCurva (taylor-curve/[id]/edit)', () => {
  it('cargando', () => expect(estadoEdicionCurva(true, null)).toEqual({ estado: 'cargando' }));
  it('no existe → historial', () => expect(estadoEdicionCurva(false, null)).toEqual({ estado: 'inexistente', destino: '/history' }));
  it('sin taylorInputs → redirige al editor correcto', () => {
    expect(estadoEdicionCurva(false, caso)).toEqual({ estado: 'otro-tipo', destino: '/cases/k1/edit', sinEditor: false });
  });
  it('simulación → sin editor: avisa y vuelve al historial', () => {
    expect(estadoEdicionCurva(false, simulacion)).toEqual({ estado: 'otro-tipo', destino: '/history', sinEditor: true });
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

describe('accionesDisponibles (Historial y tabla de casos)', () => {
  it('curva: editar en su editor, PDF si hay pdfUrl, eliminar', () => {
    expect(accionesDisponibles({ ...curva, pdfUrl: 'https://x/y.pdf' })).toEqual({ editar: '/taylor-curve/c1/edit', pdf: 'https://x/y.pdf', eliminar: true });
  });
  it('caso de éxito: editar en el editor de casos, sin PDF si no hay pdfUrl', () => {
    expect(accionesDisponibles(caso)).toEqual({ editar: '/cases/k1/edit', pdf: null, eliminar: true });
  });
  it('simulación: SIN editar; deja PDF (si hay) y eliminar', () => {
    expect(accionesDisponibles({ ...simulacion, pdfUrl: 'https://x/s.pdf' })).toEqual({ editar: null, pdf: 'https://x/s.pdf', eliminar: true });
    expect(accionesDisponibles(simulacion).editar).toBeNull();
  });
  it('pdfUrl vacío cuenta como sin PDF', () => expect(accionesDisponibles({ ...simulacion, pdfUrl: '' }).pdf).toBeNull());
});

describe('mapaUsuarios y columna Usuario con mapa', () => {
  const mapa = mapaUsuarios([
    { id: 'u1', name: 'Fernando', email: 'f@secocut.com' },
    { id: 'u2', name: '  ', email: 'ana@secocut.com' },
    { id: 'u3' },
  ]);
  it('nombre, o email si no hay nombre; ignora los perfiles sin dato', () => {
    expect(mapa.get('u1')).toBe('Fernando');
    expect(mapa.get('u2')).toBe('ana@secocut.com');
    expect(mapa.has('u3')).toBe(false);
  });
  it('el mapa tiene prioridad sobre la sesión y el email guardado en el documento', () => {
    expect(usuarioDelDocumento({ id: 'd', userId: 'u2', userEmail: 'otro@x.com' }, null, mapa)).toBe('ana@secocut.com');
    expect(usuarioDelDocumento({ id: 'd', userId: 'u1' }, { uid: 'u1', email: 'sesion@x.com' }, mapa)).toBe('Fernando');
  });
  it('si el uid no está en el mapa: email guardado y luego uid abreviado', () => {
    expect(usuarioDelDocumento({ id: 'd', userId: 'u9', userEmail: 'g@x.com' }, null, mapa)).toBe('g@x.com');
    expect(usuarioDelDocumento({ id: 'd', userId: 'abcdef123456' }, null, mapa)).toBe('Usuario …123456');
  });
  it('si falló la lectura (mapa null) cae a los respaldos sin romper', () => {
    expect(usuarioDelDocumento({ id: 'd', userId: 'abcdef123456' }, null, null)).toBe('Usuario …123456');
  });
});
