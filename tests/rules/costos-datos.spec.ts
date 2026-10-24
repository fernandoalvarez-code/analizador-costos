import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, disableNetwork, getDoc, getDocs, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import {
  crearRepositorioCostos, MaquinaEnUsoError, MENSAJE_SIN_CONFIRMAR, sinUndefined,
} from '@/lib/costos-mecanizado/firestore';
import { CALC_VERSION, REGLAS_POR_DEFECTO, type Pieza } from '@/lib/costos-mecanizado/types';
import { createRulesTestEnv, secocutVerified } from './helpers';

// Capa de datos (src/lib/costos-mecanizado/firestore.ts) contra el emulador CON las reglas reales. Valores esperados hechos a
// mano: una máquina de 60 USD/h (1 USD por minuto) con una herramienta gratuita de 1 min de corte da 1 USD/pza; a 120 USD/h, 2 USD/pza.
describe('capa de datos de costos de mecanizado', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesTestEnv(); });
  afterAll(async () => { await env.cleanup(); });

  const EMP = 'emp-a';
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { id: 'admin1', role: 'admin' });
      await setDoc(doc(db, 'users/a1'), { id: 'a1', role: 'user', empresaId: EMP });
      await setDoc(doc(db, 'users/a2'), { id: 'a2', role: 'user', empresaId: EMP });
      await setDoc(doc(db, `empresas/${EMP}`), { nombre: 'Empresa A', plantas: [] });
    });
  });

  const dbDe = (uid: string) => (uid === 'admin1'
    ? env.authenticatedContext(uid, secocutVerified('admin1@secocut.com'))
    : env.authenticatedContext(uid, { email: `${uid}@cliente.com`, email_verified: true })).firestore() as unknown as Firestore;
  const repo = (uid: string, opciones?: { timeoutMs?: number }) => crearRepositorioCostos(dbDe(uid), uid, opciones);

  /** Pieza de 1 operación en la máquina `maquinaId`; herramienta gratuita de 1 min de corte (costo = 1 min × costoHora/60). */
  const piezaSimple = (codigo: string, maquinaId = 'm1', over: Partial<Pieza> = {}): Pieza => ({
    codigo, nombre: `Pieza ${codigo}`, volumenAnual: 1000, modoProduccion: 'dedicada', material: { quienPone: 'propio', costoPorPieza: 0 },
    operaciones: [{
      id: 'op1', nombre: 'Op', maquinaId, tiemposMuertosMin: 0, setupMin: 0, scrapPct: 0,
      herramientas: [{ id: 'h1', seleccionada: 0, opciones: [{ id: 'o1', nombre: 'H', precio: 0, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 100, cortePorPiezaMin: 1, cambioMin: 0 }] }],
    }],
    ...over,
  });

  /** Siembra n piezas (con las reglas desactivadas) con un resumen VIEJO escrito a mano: costoPieza 1 en la máquina indicada. */
  async function sembrar(n: number, opts: { maquinaId?: string; prefijo?: string; reglasVersion?: number; calcVersion?: number } = {}) {
    const { maquinaId = 'm1', prefijo = 'S', reglasVersion = 0, calcVersion = CALC_VERSION } = opts;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < n; i += 100) {
        const b = writeBatch(db);
        for (let j = i; j < Math.min(n, i + 100); j++) {
          const p = piezaSimple(`${prefijo}-${String(j).padStart(3, '0')}`, maquinaId);
          b.set(doc(db, `empresas/${EMP}/piezas/${prefijo}-${j}`), {
            ...p, createdBy: 'semilla', createdAt: 1, updatedBy: 'semilla', updatedAt: 1,
            resumen: { costoPieza: 1, costoAnual: 1000, minutosPieza: 1, opMayorCosto: 'op1', rubroPrincipal: 'corte', porRubroUsdPza: {}, porMaquinaUsdPza: { [maquinaId]: 1 }, maquinaIds: [maquinaId], ahorroPotencialAnual: 0, cantMejoras: 0, calcVersion, reglasVersion },
          });
        }
        await b.commit();
      }
    });
  }
  async function leerAdmin<T = Record<string, unknown>>(ruta: string): Promise<T | undefined> {
    let d: T | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => { d = (await getDoc(doc(ctx.firestore(), ruta))).data() as T | undefined; });
    return d;
  }

  describe('máquinas', () => {
    it('crear deja createdAt/createdBy/updatedAt/updatedBy; editar no toca createdAt/createdBy y cambia updatedBy', async () => {
      const id = await repo('a1').crearMaquina(EMP, { nombre: 'Torno 1', costoHora: 30 });
      const antes = await leerAdmin<Record<string, unknown>>(`empresas/${EMP}/maquinas/${id}`);
      expect(antes).toMatchObject({ nombre: 'Torno 1', costoHora: 30, createdBy: 'a1', updatedBy: 'a1' });
      expect(antes?.createdAt).toBeTruthy();
      const r = await repo('a2').actualizarMaquina(EMP, id, { nombre: 'Torno 1 (renombrado)' });
      expect(r.recalculo).toBeNull(); // no cambió el costo hora
      const despues = await leerAdmin<Record<string, unknown>>(`empresas/${EMP}/maquinas/${id}`);
      expect(despues).toMatchObject({ nombre: 'Torno 1 (renombrado)', createdBy: 'a1', updatedBy: 'a2' });
      expect(despues?.createdAt).toEqual(antes?.createdAt);
    });
    it('listar devuelve las máquinas con su id, ordenadas por nombre; dos usuarios de la empresa ven las mismas', async () => {
      await repo('a1').crearMaquina(EMP, { nombre: 'B Torno', costoHora: 30 });
      await repo('a2').crearMaquina(EMP, { nombre: 'A Centro', costoHora: 35, planta: 'P1' });
      const l = await repo('a2').listarMaquinas(EMP);
      expect(l.map((m) => m.nombre)).toEqual(['A Centro', 'B Torno']);
      expect(l[0].id).toBeTruthy();
      expect((await repo('a1').listarMaquinas(EMP)).map((m) => m.id)).toEqual(l.map((m) => m.id));
    });
    it('cambiar el costo hora recalcula las piezas que la usan: 250 piezas (3 tandas de 100), 60 -> 120 USD/h = 1 -> 2 USD/pza', async () => {
      const r1 = repo('a1');
      const m1 = await r1.crearMaquina(EMP, { nombre: 'M1', costoHora: 60 });
      const m2 = await r1.crearMaquina(EMP, { nombre: 'M2', costoHora: 60 });
      // las piezas se siembran con el id real de la máquina
      await sembrar(250, { maquinaId: m1, prefijo: 'U' });
      await sembrar(5, { maquinaId: m2, prefijo: 'V' });
      const { recalculo } = await repo('a2').actualizarMaquina(EMP, m1, { costoHora: 120 });
      expect(recalculo).toEqual({ recalculadas: 250, fallidas: 0 });
      const todas = await getDocs(collection(dbDe('a1'), `empresas/${EMP}/piezas`));
      const usan = todas.docs.filter((d) => d.id.startsWith('U-'));
      expect(usan).toHaveLength(250);
      for (const d of usan) {
        const x = d.data() as { resumen: { costoPieza: number; costoAnual: number; porMaquinaUsdPza: Record<string, number> }; updatedBy: string; createdBy: string };
        expect(x.resumen.costoPieza).toBeCloseTo(2, 9);
        expect(x.resumen.costoAnual).toBeCloseTo(2000, 6);
        expect(x.resumen.porMaquinaUsdPza[m1]).toBeCloseTo(2, 9);
        expect(x.updatedBy).toBe('a2');
        expect(x.createdBy).toBe('semilla');
      }
      // las piezas de la otra máquina no se tocan
      for (const d of todas.docs.filter((d) => d.id.startsWith('V-'))) expect((d.data() as { resumen: { costoPieza: number } }).resumen.costoPieza).toBe(1);
    });
    it('recalcularResumenesPorMaquina es idempotente (reintentar no cambia el resultado)', async () => {
      const m1 = await repo('a1').crearMaquina(EMP, { nombre: 'M1', costoHora: 120 });
      await sembrar(30, { maquinaId: m1, prefijo: 'W' });
      expect(await repo('a1').recalcularResumenesPorMaquina(EMP, m1)).toEqual({ recalculadas: 30, fallidas: 0 });
      expect(await repo('a1').recalcularResumenesPorMaquina(EMP, m1)).toEqual({ recalculadas: 30, fallidas: 0 });
      const d = await leerAdmin<{ resumen: { costoPieza: number } }>(`empresas/${EMP}/piezas/W-7`);
      expect(d?.resumen.costoPieza).toBeCloseTo(2, 9);
    });
    it('eliminar: bloqueado si una pieza la usa; permitido si no', async () => {
      const r = repo('a1');
      const enUso = await r.crearMaquina(EMP, { nombre: 'En uso', costoHora: 60 });
      const libre = await r.crearMaquina(EMP, { nombre: 'Libre', costoHora: 60 });
      await r.crearPieza(EMP, piezaSimple('P-1', enUso));
      await expect(r.eliminarMaquina(EMP, enUso)).rejects.toBeInstanceOf(MaquinaEnUsoError);
      expect(await leerAdmin(`empresas/${EMP}/maquinas/${enUso}`)).toBeTruthy();
      await r.eliminarMaquina(EMP, libre);
      expect(await leerAdmin(`empresas/${EMP}/maquinas/${libre}`)).toBeUndefined();
    });
    it('una máquina que ya no tienen las piezas se puede eliminar después de reasignarlas', async () => {
      const r = repo('a1');
      const a = await r.crearMaquina(EMP, { nombre: 'A', costoHora: 60 });
      const b = await r.crearMaquina(EMP, { nombre: 'B', costoHora: 60 });
      const pid = await r.crearPieza(EMP, piezaSimple('P-1', a));
      await r.actualizarPieza(EMP, pid, piezaSimple('P-1', b));
      await r.eliminarMaquina(EMP, a);
      expect(await leerAdmin(`empresas/${EMP}/maquinas/${a}`)).toBeUndefined();
    });
  });

  describe('piezas', () => {
    it('crear calcula y guarda el resumen (calcVersion, reglasVersion 0) y la auditoría', async () => {
      const r = repo('a1');
      await r.crearMaquina(EMP, { nombre: 'M', costoHora: 60 }); // id automático; la pieza usa 'm1': se crea la máquina con ese id aparte
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const id = await r.crearPieza(EMP, piezaSimple('P-1'));
      const d = await leerAdmin<Pieza & Record<string, unknown>>(`empresas/${EMP}/piezas/${id}`);
      expect(d).toMatchObject({ codigo: 'P-1', createdBy: 'a1', updatedBy: 'a1' });
      expect(d?.resumen?.costoPieza).toBeCloseTo(1, 9);
      expect(d?.resumen?.costoAnual).toBeCloseTo(1000, 6);
      expect(d?.resumen?.calcVersion).toBe(CALC_VERSION);
      expect(d?.resumen?.reglasVersion).toBe(0);
      expect(d?.resumen?.maquinaIds).toEqual(['m1']);
      expect((d as Record<string, unknown>).id).toBeUndefined(); // el id no se guarda dentro del documento
    });
    it('actualizar recalcula el resumen, conserva createdAt/createdBy y borra los opcionales que ya no aplican', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const id = await repo('a1').crearPieza(EMP, piezaSimple('P-1', 'm1', { modoProduccion: 'lote', piezasPorLote: 500 }));
      const antes = await leerAdmin<Record<string, unknown>>(`empresas/${EMP}/piezas/${id}`);
      expect(antes?.piezasPorLote).toBe(500);
      const nueva = piezaSimple('P-1', 'm1', { volumenAnual: 4000 }); // dedicada, sin piezasPorLote
      nueva.operaciones[0].herramientas[0].opciones[0].cortePorPiezaMin = 3;
      await repo('a2').actualizarPieza(EMP, id, nueva);
      const despues = await leerAdmin<Record<string, unknown> & { resumen: { costoPieza: number; costoAnual: number } }>(`empresas/${EMP}/piezas/${id}`);
      expect(despues?.resumen.costoPieza).toBeCloseTo(3, 9);
      expect(despues?.resumen.costoAnual).toBeCloseTo(12000, 6);
      expect(despues).toMatchObject({ createdBy: 'a1', updatedBy: 'a2', volumenAnual: 4000 });
      expect(despues?.createdAt).toEqual(antes?.createdAt);
      expect('piezasPorLote' in (despues ?? {})).toBe(false);
    });
    it('obtener devuelve la pieza con su id (o null si no existe)', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const id = await repo('a1').crearPieza(EMP, piezaSimple('P-1'));
      expect((await repo('a2').obtenerPieza(EMP, id))?.id).toBe(id);
      expect(await repo('a2').obtenerPieza(EMP, 'no-existe')).toBeNull();
    });
    it('duplicar crea otra pieza con código "<código>-copia" y el mismo costo', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const id = await repo('a1').crearPieza(EMP, piezaSimple('P-1'));
      const copia = await repo('a2').duplicarPieza(EMP, id);
      expect(copia).not.toBe(id);
      const d = await leerAdmin<{ codigo: string; createdBy: string; resumen: { costoPieza: number } }>(`empresas/${EMP}/piezas/${copia}`);
      expect(d).toMatchObject({ codigo: 'P-1-copia', createdBy: 'a2' });
      expect(d?.resumen.costoPieza).toBeCloseTo(1, 9);
      await expect(repo('a1').duplicarPieza(EMP, 'no-existe')).rejects.toThrow(/no existe/);
    });
    it('duplicar conserva la marca vidaVerificada de las opciones (el campo viaja con la pieza)', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const original = piezaSimple('P-1');
      original.operaciones[0].herramientas[0].opciones[0].vidaVerificada = true;
      const id = await repo('a1').crearPieza(EMP, original);
      const copia = await repo('a2').duplicarPieza(EMP, id);
      const d = await leerAdmin<Pieza & { resumen: { costoPieza: number } }>(`empresas/${EMP}/piezas/${copia}`);
      expect(d?.operaciones[0].herramientas[0].opciones[0].vidaVerificada).toBe(true);
      expect(d?.resumen.costoPieza).toBeCloseTo(1, 9); // la marca no entra en el cálculo
    });
    it('mejoras descartadas: el resumen guardado no las cuenta (calcVersion 3), duplicar las conserva y reactivar la última reemplaza el mapa', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      // piezaSimple: 1 min de corte a 1 USD/min con herramienta gratuita → solo dispara Productividad (corte = 100 % > 45 %): 20 % × 1 USD × 1000 = 200 USD/año
      const sinDescarte = await repo('a1').crearPieza(EMP, piezaSimple('D-0'));
      const r0 = await leerAdmin<{ resumen: { cantMejoras: number; ahorroPotencialAnual: number; calcVersion: number } }>(`empresas/${EMP}/piezas/${sinDescarte}`);
      expect(r0?.resumen).toMatchObject({ cantMejoras: 1, calcVersion: 3 });
      expect(r0?.resumen.ahorroPotencialAnual).toBeCloseTo(200, 6);

      const descarte = { motivoTipo: 'ya-probado' as const, motivo: 'Ya lo probamos', por: 'a1', porEmail: 'a1@cliente.com', fecha: '2026-10-23T12:00:00.000Z', ahorroAnualAlDescartar: 200 };
      const conDescarte = { ...piezaSimple('D-1'), mejorasDescartadas: { 'Productividad|op1|': descarte } };
      const id = await repo('a1').crearPieza(EMP, conDescarte);
      const d1 = await leerAdmin<Pieza & { resumen: { cantMejoras: number; ahorroPotencialAnual: number; calcVersion: number } }>(`empresas/${EMP}/piezas/${id}`);
      expect(d1?.mejorasDescartadas).toEqual({ 'Productividad|op1|': descarte });
      expect(d1?.resumen).toMatchObject({ cantMejoras: 0, ahorroPotencialAnual: 0, calcVersion: 3 });

      const copia = await repo('a2').duplicarPieza(EMP, id);
      const d2 = await leerAdmin<Pieza>(`empresas/${EMP}/piezas/${copia}`);
      expect(d2?.mejorasDescartadas).toEqual({ 'Productividad|op1|': descarte });

      // Reactivar la última: la interfaz guarda {} (no borra el campo) y la actualización reemplaza el mapa
      await repo('a1').actualizarPieza(EMP, id, { ...conDescarte, mejorasDescartadas: {} });
      const d3 = await leerAdmin<Pieza & { resumen: { cantMejoras: number; ahorroPotencialAnual: number } }>(`empresas/${EMP}/piezas/${id}`);
      expect(d3?.mejorasDescartadas).toEqual({});
      expect(d3?.resumen.cantMejoras).toBe(1);
      expect(d3?.resumen.ahorroPotencialAnual).toBeCloseTo(200, 6);
    });
    it('eliminar borra la pieza', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 60 }); });
      const id = await repo('a1').crearPieza(EMP, piezaSimple('P-1'));
      await repo('a2').eliminarPieza(EMP, id);
      expect(await leerAdmin(`empresas/${EMP}/piezas/${id}`)).toBeUndefined();
    });
    it('listado paginado de resúmenes: 40 piezas en páginas de 15, ordenadas por código', async () => {
      await sembrar(40, { prefijo: 'C' });
      const r = repo('a1');
      const p1 = await r.listarPiezasPagina(EMP, 15);
      expect(p1.items).toHaveLength(15);
      expect(p1.items[0].codigo).toBe('C-000');
      expect(p1.items[0].resumen.costoPieza).toBe(1);
      expect(p1.siguiente).not.toBeNull();
      const p2 = await r.listarPiezasPagina(EMP, 15, p1.siguiente);
      expect(p2.items).toHaveLength(15);
      expect(p2.items[0].codigo).toBe('C-015');
      const p3 = await r.listarPiezasPagina(EMP, 15, p2.siguiente);
      expect(p3.items).toHaveLength(10);
      expect(p3.items[9].codigo).toBe('C-039');
      expect(p3.siguiente).toBeNull();
    });
    it('listarTodosLosResumenes lee de a 100 y devuelve las 130 piezas', async () => {
      await sembrar(130, { prefijo: 'T' });
      const todas = await repo('a2').listarTodosLosResumenes(EMP);
      expect(todas).toHaveLength(130);
      expect(new Set(todas.map((f) => f.id)).size).toBe(130);
    });
  });

  describe('reglas editables (settings/reglasCostos) y resúmenes desactualizados', () => {
    it('sin documento: defaults del código con reglasVersion 0', async () => {
      expect(await repo('a1').leerReglas()).toEqual(REGLAS_POR_DEFECTO);
    });
    it('solo un admin guarda; el resto recibe permission-denied', async () => {
      const { reglasVersion: _v, ...sinVersion } = REGLAS_POR_DEFECTO; void _v;
      await expect(repo('a1').guardarReglas(sinVersion)).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('al guardar, reglasVersion pasa a ser el updatedAt (ms) y los valores guardados reemplazan a los defaults', async () => {
      const { reglasVersion: _v, ...sinVersion } = REGLAS_POR_DEFECTO; void _v;
      await repo('admin1').guardarReglas({ ...sinVersion, productividad: { umbralPct: 50, ahorroPct: 25 } });
      const r = await repo('a1').leerReglas();
      expect(r.reglasVersion).toBeGreaterThan(0);
      expect(r.productividad).toEqual({ umbralPct: 50, ahorroPct: 25 });
      expect(r.calidad).toEqual(REGLAS_POR_DEFECTO.calidad);
    });
    it('reglas inválidas (negativas o no numéricas) se rechazan antes de escribir', async () => {
      const { reglasVersion: _v, ...sinVersion } = REGLAS_POR_DEFECTO; void _v;
      await expect(repo('admin1').guardarReglas({ ...sinVersion, calidad: { umbralPct: -1, ahorroPct: 50 } })).rejects.toThrow(/Regla inválida/);
      await expect(repo('admin1').guardarReglas({ ...sinVersion, calidad: { umbralPct: NaN, ahorroPct: 50 } })).rejects.toThrow(/Regla inválida/);
      expect(await leerAdmin('settings/reglasCostos')).toBeUndefined();
    });
    it('recalcularResumenesDesactualizados completa solo las piezas con reglasVersion o calcVersion distinta, y es idempotente', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), `empresas/${EMP}/maquinas/m1`), { nombre: 'M1', costoHora: 120 }); });
      await sembrar(5, { prefijo: 'R', reglasVersion: 0 });
      const { reglasVersion: _v, ...sinVersion } = REGLAS_POR_DEFECTO; void _v;
      await repo('admin1').guardarReglas(sinVersion); // reglasVersion pasa de 0 a updatedAt
      const version = (await repo('a1').leerReglas()).reglasVersion;
      await sembrar(3, { prefijo: 'AlDia', reglasVersion: version });
      await sembrar(2, { prefijo: 'CalcViejo', reglasVersion: version, calcVersion: 0 });
      expect(await repo('a2').recalcularResumenesDesactualizados(EMP)).toEqual({ recalculadas: 7, fallidas: 0 });
      const r0 = await leerAdmin<{ resumen: { costoPieza: number; reglasVersion: number; calcVersion: number } }>(`empresas/${EMP}/piezas/R-0`);
      expect(r0?.resumen.costoPieza).toBeCloseTo(2, 9); // máquina m1 a 120 USD/h
      expect(r0?.resumen.reglasVersion).toBe(version);
      expect(r0?.resumen.calcVersion).toBe(CALC_VERSION);
      expect((await leerAdmin<{ updatedBy: string }>(`empresas/${EMP}/piezas/AlDia-0`))?.updatedBy).toBe('semilla'); // las que estaban al día no se tocaron
      expect(await repo('a2').recalcularResumenesDesactualizados(EMP)).toEqual({ recalculadas: 0, fallidas: 0 });
    });
  });

  describe('empresas', () => {
    it('el admin crea y lista empresas; un usuario de la empresa obtiene la suya pero no crea ni lista', async () => {
      const id = await repo('admin1').crearEmpresa({ nombre: 'Cliente Nuevo', plantas: ['Planta 1'] });
      expect((await repo('admin1').listarEmpresas()).map((e) => e.nombre)).toEqual(expect.arrayContaining(['Cliente Nuevo', 'Empresa A']));
      expect((await repo('a1').obtenerEmpresa(EMP))?.nombre).toBe('Empresa A');
      expect(await repo('admin1').obtenerEmpresa('no-existe')).toBeNull(); // el admin llega a una empresa inexistente: null
      await expect(repo('a1').obtenerEmpresa('otra-empresa')).rejects.toMatchObject({ code: 'permission-denied' }); // un cliente no accede a otra
      await expect(repo('a1').crearEmpresa({ nombre: 'X', plantas: [] })).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(repo('a1').listarEmpresas()).rejects.toMatchObject({ code: 'permission-denied' });
      expect(id).toBeTruthy();
    });
  });

  describe('escrituras con tope de tiempo', () => {
    it('si no se confirma (sin red), falla con un mensaje claro en vez de quedar colgado', async () => {
      const db = dbDe('a1');
      await disableNetwork(db);
      const r = crearRepositorioCostos(db, 'a1', { timeoutMs: 200 });
      await expect(r.crearMaquina(EMP, { nombre: 'Sin red', costoHora: 10 })).rejects.toThrow(MENSAJE_SIN_CONFIRMAR);
    });
    it('un rechazo de las reglas (permission-denied) llega tal cual, no como timeout', async () => {
      await assertFails(setDoc(doc(dbDe('a1'), 'empresas/otra/maquinas/x'), { nombre: 'x', costoHora: 1, createdBy: 'a1', updatedBy: 'a1' }));
      await expect(repo('a1').crearMaquina('otra', { nombre: 'x', costoHora: 1 })).rejects.toMatchObject({ code: 'permission-denied' });
    });
  });

  describe('sinUndefined', () => {
    it('quita los undefined (anidados y en listas) y conserva el resto', () => {
      expect(sinUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined, { f: undefined, g: 2 }] } })).toEqual({ a: 1, c: { e: [1, undefined, { g: 2 }] } });
    });
  });
});
