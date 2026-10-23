import { describe, expect, it } from 'vitest';
import { resolverModo, veCostosEnMenu } from '@/components/costos/modo-empresa';

const secocut = { email: 'ana@secocut.com', emailVerified: true };
const secocutSinVerificar = { email: 'ana@secocut.com', emailVerified: false };
const cliente = { email: 'jefe@autopartes.com', emailVerified: true };

describe('resolverModo', () => {
  it('admin SECOCUT (rol admin + @secocut verificado): elige entre todas', () => {
    expect(resolverModo(secocut, { role: 'admin' })).toBe('admin');
  });
  it('un admin con email de otro dominio o sin verificar NO es admin SECOCUT', () => {
    expect(resolverModo({ email: 'a@gmail.com', emailVerified: true }, { role: 'admin' })).toBe('sin-empresa');
    expect(resolverModo(secocutSinVerificar, { role: 'admin' })).toBe('sin-empresa');
  });
  it('con empresaId: cliente (empresa fija), sea del dominio que sea', () => {
    expect(resolverModo(cliente, { role: 'user', empresaId: 'emp-a' })).toBe('cliente');
    expect(resolverModo(secocut, { role: 'user', empresaId: 'emp-a' })).toBe('cliente');
  });
  it('vendedor: @secocut verificado con empresasAsignadas', () => {
    expect(resolverModo(secocut, { role: 'user', empresasAsignadas: ['emp-a'] })).toBe('vendedor');
  });
  it('un @secocut SIN verificar con empresasAsignadas no es vendedor', () => {
    expect(resolverModo(secocutSinVerificar, { role: 'user', empresasAsignadas: ['emp-a'] })).toBe('sin-empresa');
  });
  it('personal SECOCUT sin empresas: "sin-empresas" (también con empresasAsignadas vacío)', () => {
    expect(resolverModo(secocut, { role: 'user' })).toBe('sin-empresas');
    expect(resolverModo(secocut, { role: 'user', empresasAsignadas: [] })).toBe('sin-empresas');
  });
  it('usuario que no es de SECOCUT y sin empresaId: "sin-empresa" (aunque tenga empresasAsignadas)', () => {
    expect(resolverModo(cliente, { role: 'user' })).toBe('sin-empresa');
    expect(resolverModo(cliente, { role: 'user', empresasAsignadas: ['emp-a'] })).toBe('sin-empresa');
  });
  it('empresaId vacío no cuenta', () => {
    expect(resolverModo(cliente, { role: 'user', empresaId: '' })).toBe('sin-empresa');
  });
  it('sin sesión: sin-empresa', () => {
    expect(resolverModo(null, {})).toBe('sin-empresa');
  });
});

describe('veCostosEnMenu', () => {
  it('personal SECOCUT verificado: lo ve, aunque el perfil esté cargando o no tenga empresa', () => {
    expect(veCostosEnMenu(secocut, null, true)).toBe(true);
    expect(veCostosEnMenu(secocut, {}, false)).toBe(true);
  });
  it('usuario con empresaId y el perfil ya cargado: lo ve', () => {
    expect(veCostosEnMenu(cliente, { empresaId: 'emp-a' }, false)).toBe(true);
  });
  it('mientras el perfil carga, un usuario que no es de SECOCUT no lo ve', () => {
    expect(veCostosEnMenu(cliente, { empresaId: 'emp-a' }, true)).toBe(false);
    expect(veCostosEnMenu(cliente, null, true)).toBe(false);
  });
  it('sin empresaId (o vacío) y sin ser de SECOCUT: no lo ve', () => {
    expect(veCostosEnMenu(cliente, {}, false)).toBe(false);
    expect(veCostosEnMenu(cliente, { empresaId: '' }, false)).toBe(false);
    expect(veCostosEnMenu(cliente, null, false)).toBe(false);
  });
  it('@secocut sin verificar y sin empresaId: no lo ve', () => {
    expect(veCostosEnMenu(secocutSinVerificar, {}, false)).toBe(false);
  });
});
