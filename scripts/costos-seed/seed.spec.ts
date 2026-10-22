import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcPieza } from '../../src/lib/costos-mecanizado/calc';
import { CALC_VERSION } from '../../src/lib/costos-mecanizado/types';
import { leerCredenciales } from './credenciales';
import {
  ADMIN_UID, EMPRESA_A, EMPRESA_B, MAQUINAS_A, MAQUINAS_B, USUARIOS,
  documentoMaquina, documentoPieza, generarPiezasAleatorias, piezaBrida, piezaCarcasa,
} from './datos';
import { PROJECT_ID_EMULADOR, verificarEntornoSeed } from './guardas';

const ENTORNO_OK = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: 'demo-costos' };
const costoHora = (maquinas: typeof MAQUINAS_A) => Object.fromEntries(maquinas.map((m) => [m.id, m.costoHora]));

describe('guardas del seed (aborta fuera de los emuladores y de demo-costos)', () => {
  it('con el entorno de los emuladores y demo-costos no lanza', () => {
    expect(() => verificarEntornoSeed(ENTORNO_OK)).not.toThrow();
    expect(PROJECT_ID_EMULADOR).toBe('demo-costos');
  });
  it.each([['FIRESTORE_EMULATOR_HOST'], ['FIREBASE_AUTH_EMULATOR_HOST']])('sin %s: aborta', (variable) => {
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, [variable]: undefined })).toThrow(/Abortado.*faltan/);
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, [variable]: '' })).toThrow(/Abortado/);
  });
  it('sin ninguna de las dos: aborta nombrando las dos', () => {
    expect(() => verificarEntornoSeed({ GCLOUD_PROJECT: 'demo-costos' })).toThrow(/FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST/);
  });
  it('un host que no es local: aborta', () => {
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' })).toThrow(/esta máquina/);
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, FIREBASE_AUTH_EMULATOR_HOST: '10.0.0.5:9099' })).toThrow(/esta máquina/);
  });
  it.each([[undefined], ['studio-1546170521-5d9b0'], ['demo-oportunidades'], ['demo-costos2']])('GCLOUD_PROJECT = %s: aborta', (proyecto) => {
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, GCLOUD_PROJECT: proyecto })).toThrow(/GCLOUD_PROJECT/);
  });
  it('otras variables de proyecto que apuntan a un proyecto real: aborta', () => {
    expect(() => verificarEntornoSeed({ ...ENTORNO_OK, GOOGLE_CLOUD_PROJECT: 'studio-1546170521-5d9b0' })).toThrow(/otro proyecto/);
  });
});

describe('credenciales del README-LOCAL.md', () => {
  const readme = readFileSync('docs/analisis-costos/README-LOCAL.md', 'utf8');
  it('hay una contraseña de 16 o más caracteres para cada usuario del seed, y no se repiten', () => {
    const c = leerCredenciales(readme);
    for (const u of USUARIOS) expect(c[u.email]?.length).toBeGreaterThanOrEqual(16);
    expect(new Set(USUARIOS.map((u) => c[u.email])).size).toBe(USUARIOS.length);
  });
  it('sin el bloque, o con un usuario sin contraseña, aborta', () => {
    expect(() => leerCredenciales('# sin bloque')).toThrow(/bloque de credenciales/);
    const incompleto = readme.replace(/\| [^\n]*vendedor@secocut\.com[^\n]*\n/, '');
    expect(() => leerCredenciales(incompleto)).toThrow(/vendedor@secocut\.com/);
  });
  it('una contraseña corta aborta', () => {
    const corta = readme.replace(/(`admin@secocut\.com` \| `)[^`]+(`)/, '$1corta$2');
    expect(() => leerCredenciales(corta)).toThrow(/demasiado corta/);
  });
});

describe('usuarios del seed', () => {
  it('cliente A y B con su empresaId, vendedor @secocut.com con empresasAsignadas [A], admin @secocut.com y un @secocut sin asignaciones', () => {
    const por = (uid: string) => USUARIOS.find((u) => u.uid === uid)!;
    expect(por('cliente-a')).toMatchObject({ role: 'user', empresaId: EMPRESA_A });
    expect(por('cliente-b')).toMatchObject({ role: 'user', empresaId: EMPRESA_B });
    expect(por('vendedor')).toMatchObject({ role: 'user', empresasAsignadas: [EMPRESA_A] });
    expect(por('vendedor').email.endsWith('@secocut.com')).toBe(true);
    expect(por(ADMIN_UID)).toMatchObject({ role: 'admin' });
    expect(por(ADMIN_UID).email.endsWith('@secocut.com')).toBe(true);
    const sin = por('secocut-sin-asignar');
    expect(sin.email.endsWith('@secocut.com')).toBe(true);
    expect(sin.empresaId).toBeUndefined();
    expect(sin.empresasAsignadas).toBeUndefined();
  });
  it('los emails son únicos', () => { expect(new Set(USUARIOS.map((u) => u.email)).size).toBe(USUARIOS.length); });
});

describe('datos del seed', () => {
  const AHORA = { marca: 'ahora' };
  it('empresa A: 4 máquinas con los costos del SPEC 4.7 (30, 35, 35 y 45 USD/h)', () => {
    expect(MAQUINAS_A.map((m) => m.costoHora)).toEqual([30, 35, 35, 45]);
    expect(MAQUINAS_A.map((m) => m.nombre)).toEqual(['Torno CNC 1', 'Centro vertical 1', 'Centro vertical 2', 'Centro horizontal']);
  });
  it('CAR-001 da 9,3570 USD/pza y 233.926 USD/año (oráculo del SPEC, escrito a mano)', () => {
    const r = calcPieza(piezaCarcasa(), costoHora(MAQUINAS_A));
    expect(Math.abs(r.costoPieza - 9.357)).toBeLessThan(0.001);
    expect(Math.round(r.costoAnual)).toBe(233926);
  });
  it('el documento de la pieza lleva resumen (calcVersion actual, reglasVersion 0) y auditoría, sin id ni undefined', () => {
    const d = documentoPieza(piezaCarcasa(), MAQUINAS_A, ADMIN_UID, AHORA) as unknown as Record<string, unknown> & { resumen: Record<string, unknown> };
    expect(Math.abs((d.resumen.costoPieza as number) - 9.357)).toBeLessThan(0.001);
    expect(d.resumen.calcVersion).toBe(CALC_VERSION);
    expect(d.resumen.reglasVersion).toBe(0);
    expect(d.resumen.maquinaIds).toEqual(['centro-vertical-2', 'centro-horizontal', 'centro-vertical-1', 'torno-cnc-1']);
    expect(d).toMatchObject({ codigo: 'CAR-001', createdBy: ADMIN_UID, updatedBy: ADMIN_UID, createdAt: AHORA, updatedAt: AHORA });
    expect('id' in d).toBe(false);
    expect(JSON.stringify(d)).not.toContain('undefined');
  });
  it('el documento de la máquina lleva auditoría', () => {
    expect(documentoMaquina(MAQUINAS_A[0], ADMIN_UID, AHORA)).toEqual({
      nombre: 'Torno CNC 1', costoHora: 30, planta: 'Planta 1', createdAt: AHORA, createdBy: ADMIN_UID, updatedAt: AHORA, updatedBy: ADMIN_UID,
    });
  });
  it('empresa B tiene una pieza distinta de la A, con sus propias máquinas', () => {
    const b = piezaBrida();
    expect(b.codigo).not.toBe(piezaCarcasa().codigo);
    const ids = new Set(MAQUINAS_B.map((m) => m.id));
    for (const op of b.operaciones) expect(ids.has(op.maquinaId)).toBe(true);
    const r = calcPieza(b, costoHora(MAQUINAS_B));
    expect(r.costoPieza).toBeGreaterThan(0);
    expect(Number.isFinite(r.costoAnual)).toBe(true);
  });
});

describe('generador de 98 piezas aleatorias', () => {
  const piezas = generarPiezasAleatorias();
  it('genera 98 piezas con códigos únicos GEN-001…GEN-098', () => {
    expect(piezas).toHaveLength(98);
    expect(new Set(piezas.map((p) => p.codigo)).size).toBe(98);
    expect(piezas[0].codigo).toBe('GEN-001');
    expect(piezas[97].codigo).toBe('GEN-098');
  });
  it('es determinista: la misma semilla da las mismas piezas', () => {
    expect(JSON.stringify(generarPiezasAleatorias())).toBe(JSON.stringify(piezas));
    expect(JSON.stringify(generarPiezasAleatorias(98, 8))).not.toBe(JSON.stringify(piezas));
  });
  it('todas usan máquinas de la empresa A y respetan los mínimos del ADDENDUM punto 5', () => {
    const ids = new Set(MAQUINAS_A.map((m) => m.id));
    for (const p of piezas) {
      expect(p.volumenAnual).toBeGreaterThanOrEqual(1);
      expect(p.operaciones.length).toBeGreaterThanOrEqual(2);
      for (const op of p.operaciones) {
        expect(ids.has(op.maquinaId)).toBe(true);
        expect(op.scrapPct).toBeGreaterThanOrEqual(0);
        expect(op.scrapPct).toBeLessThanOrEqual(100);
        for (const pos of op.herramientas) {
          const o = pos.opciones[0];
          expect(o.piezasPorFilo).toBeGreaterThanOrEqual(0.01);
          expect(o.insertosPorHerramienta).toBeGreaterThanOrEqual(1);
          expect(o.filosPorInserto).toBeGreaterThanOrEqual(1);
          expect(o.precio).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
  it('todas calculan un costo positivo y finito, y el documento no tiene undefined', () => {
    for (const p of piezas) {
      const r = calcPieza(p, costoHora(MAQUINAS_A));
      expect(r.costoPieza).toBeGreaterThan(0);
      expect(Number.isFinite(r.costoAnual)).toBe(true);
      expect(JSON.stringify(documentoPieza(p, MAQUINAS_A, ADMIN_UID, 0))).not.toContain('undefined');
    }
  });
  it('hay variedad de modos de producción y de material', () => {
    expect(new Set(piezas.map((p) => p.modoProduccion)).size).toBe(3);
    expect(new Set(piezas.map((p) => p.material.quienPone)).size).toBe(2);
  });
});
