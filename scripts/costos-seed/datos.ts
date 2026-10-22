// Datos del seed del módulo de costos de mecanizado, en formato SPEC (campos largos). Solo para los emuladores locales.
import { calcResumen } from '../../src/lib/costos-mecanizado/calc';
import { REGLAS_POR_DEFECTO, type OpcionHerramienta, type Operacion, type Pieza } from '../../src/lib/costos-mecanizado/types';

export const EMPRESA_A = 'emp-a';
export const EMPRESA_B = 'emp-b';
export const ADMIN_UID = 'admin-secocut';

export interface MaquinaSeed { id: string; nombre: string; costoHora: number; planta: string }

/** Empresa A: Torno CNC 1 = 30 · Centro vertical 1 = 35 · Centro vertical 2 = 35 · Centro horizontal = 45 USD/h (SPEC 4.7). */
export const MAQUINAS_A: MaquinaSeed[] = [
  { id: 'torno-cnc-1', nombre: 'Torno CNC 1', costoHora: 30, planta: 'Planta 1' },
  { id: 'centro-vertical-1', nombre: 'Centro vertical 1', costoHora: 35, planta: 'Planta 1' },
  { id: 'centro-vertical-2', nombre: 'Centro vertical 2', costoHora: 35, planta: 'Planta 1' },
  { id: 'centro-horizontal', nombre: 'Centro horizontal', costoHora: 45, planta: 'Planta 1' },
];
export const MAQUINAS_B: MaquinaSeed[] = [
  { id: 'b-torno', nombre: 'Torno paralelo', costoHora: 28, planta: 'Planta Norte' },
  { id: 'b-centro', nombre: 'Centro de mecanizado', costoHora: 38, planta: 'Planta Norte' },
];

export const EMPRESAS = [
  { id: EMPRESA_A, nombre: 'Autopartes Ejemplo S.A.', plantas: ['Planta 1'], vendedorId: 'vendedor' },
  { id: EMPRESA_B, nombre: 'Metalúrgica Ejemplo S.R.L.', plantas: ['Planta Norte'], vendedorId: '' },
];

export interface UsuarioSeed {
  uid: string; email: string; nombre: string; role: 'user' | 'admin'; empresaId?: string; empresasAsignadas?: string[];
}
/** Todos con email verificado (las reglas lo exigen). Los emails son ficticios y solo existen en el emulador. */
export const USUARIOS: UsuarioSeed[] = [
  { uid: 'cliente-a', email: 'cliente.a@autopartes-ejemplo.test', nombre: 'Cliente A', role: 'user', empresaId: EMPRESA_A },
  { uid: 'cliente-b', email: 'cliente.b@metalurgica-ejemplo.test', nombre: 'Cliente B', role: 'user', empresaId: EMPRESA_B },
  { uid: 'vendedor', email: 'vendedor@secocut.com', nombre: 'Vendedor SECOCUT', role: 'user', empresasAsignadas: [EMPRESA_A] },
  { uid: ADMIN_UID, email: 'admin@secocut.com', nombre: 'Admin SECOCUT', role: 'admin' },
  { uid: 'secocut-sin-asignar', email: 'sin.asignar@secocut.com', nombre: 'SECOCUT sin asignaciones', role: 'user' },
];

const herramienta = (id: string, nombre: string, precio: number, insertos: number, filos: number, pf: number, corte: number, cambio: number): OpcionHerramienta => ({
  id: `${id}-o1`, nombre, precio, insertosPorHerramienta: insertos, filosPorInserto: filos, piezasPorFilo: pf, cortePorPiezaMin: corte, cambioMin: cambio,
});
const posicion = (id: string, o: OpcionHerramienta) => ({ id, seleccionada: 0, opciones: [o] });
const operacion = (
  id: string, nombre: string, maquinaId: string, tiemposMuertosMin: number, setupMin: number, scrapPct: number, herramientas: Operacion['herramientas'],
): Operacion => ({ id, nombre, maquinaId, tiemposMuertosMin, setupMin, scrapPct, herramientas });

/** CAR-001 Carcasa del SPEC 4.7: 25.000 pzs/año · lote 500 · material propio USD 9,50. Da 9,3570 USD/pza. */
export function piezaCarcasa(): Pieza {
  return {
    codigo: 'CAR-001', nombre: 'Carcasa', volumenAnual: 25000, modoProduccion: 'lote', piezasPorLote: 500,
    material: { quienPone: 'propio', costoPorPieza: 9.5 },
    operaciones: [
      operacion('op10', 'Planeado 2 caras', 'centro-vertical-2', 0.6, 45, 0.3, [posicion('op10-h1', herramienta('op10-h1', 'Fresa planear', 25, 8, 9, 60, 0.8, 6))]),
      operacion('op20', 'Desbaste y contorno', 'centro-horizontal', 1.0, 60, 0.5, [
        posicion('op20-h1', herramienta('op20-h1', 'Fresa alto avance', 20, 4, 4, 85, 2.4, 6)),
        posicion('op20-h2', herramienta('op20-h2', 'Fresa enteriza Ø12', 50, 1, 1, 180, 0.8, 4)),
      ]),
      operacion('op30', 'Agujereado', 'centro-vertical-1', 0.5, 30, 1.2, [
        posicion('op30-h1', herramienta('op30-h1', 'Broca Ø8,5', 180, 1, 1, 180, 0.45, 5)),
        posicion('op30-h2', herramienta('op30-h2', 'Broca de inserto Ø25', 25, 2, 2, 950, 0.15, 4)),
      ]),
      operacion('op40', 'Roscado M10', 'centro-vertical-1', 0.3, 20, 1.0, [posicion('op40-h1', herramienta('op40-h1', 'Macho M10', 75, 1, 1, 150, 0.5, 4))]),
      operacion('op50', 'Torneado alojamiento', 'torno-cnc-1', 0.7, 40, 0.3, [posicion('op50-h1', herramienta('op50-h1', 'Inserto CNMG', 10, 1, 4, 105, 1.1, 2))]),
    ],
  };
}

/** Pieza de la empresa B (distinta de la A, para probar que A no ve B): BRI-100 Brida. */
export function piezaBrida(): Pieza {
  return {
    codigo: 'BRI-100', nombre: 'Brida de acople', volumenAnual: 12000, modoProduccion: 'lotesAnio', lotesPorAnio: 40,
    material: { quienPone: 'cliente', clienteCobraScrap: true, cobroPorPiezaPerdida: 7.5 },
    operaciones: [
      operacion('b10', 'Torneado exterior', 'b-torno', 0.5, 35, 0.4, [posicion('b10-h1', herramienta('b10-h1', 'Inserto CNMG 120408', 9, 1, 4, 140, 1.2, 2))]),
      operacion('b20', 'Fresado de caras y agujeros', 'b-centro', 0.8, 50, 0.6, [
        posicion('b20-h1', herramienta('b20-h1', 'Fresa de planear Ø63', 22, 6, 8, 70, 1.4, 6)),
        posicion('b20-h2', herramienta('b20-h2', 'Broca enteriza Ø10,2', 95, 1, 1, 220, 0.4, 5)),
      ]),
    ],
  };
}

// ── Generador de piezas aleatorias (determinista: misma semilla, mismas piezas) ───────────────────────────────────────
function prng(semilla: number) {
  let s = semilla % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const NOMBRES = ['Brida', 'Eje', 'Buje', 'Tapa', 'Cubo', 'Perno especial', 'Manguito', 'Pivote', 'Horquilla', 'Soporte', 'Engranaje', 'Separador', 'Placa base', 'Acople', 'Rótula', 'Casquillo', 'Palanca', 'Cuerpo de válvula'];

export const CANTIDAD_ALEATORIAS = 98;
export const SEMILLA_ALEATORIAS = 7;

/** n piezas ficticias para la empresa A (máquinas de MAQUINAS_A), en formato SPEC. Sin ids: los asigna quien las escribe. */
export function generarPiezasAleatorias(n = CANTIDAD_ALEATORIAS, semilla = SEMILLA_ALEATORIAS): Pieza[] {
  const rnd = prng(semilla);
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const rr = (a: number, b: number) => a + rnd() * (b - a);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const TORNOS = ['torno-cnc-1'];
  const CENTROS = ['centro-vertical-1', 'centro-vertical-2'];
  const TODOS = [...CENTROS, 'centro-horizontal'];

  const plantillas: Array<(id: string) => Operacion> = [
    (id) => operacion(id, 'Torneado exterior', pick(TORNOS), r2(rr(0.2, 1)), Math.round(rr(20, 50)), r2(rr(0, 0.6)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, 'Inserto CNMG 120408', 10, 1, 4, Math.round(rr(80, 260)), r2(rr(0.4, 2)), 2))]),
    (id) => operacion(id, 'Torneado interior', pick(TORNOS), r2(rr(0.2, 0.8)), Math.round(rr(20, 45)), r2(rr(0, 0.8)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, 'Inserto DCMT 11T304', 9, 1, 2, Math.round(rr(60, 200)), r2(rr(0.3, 1.5)), 3))]),
    (id) => operacion(id, 'Fresado de caras', pick(CENTROS), r2(rr(0.3, 1.2)), Math.round(rr(30, 60)), r2(rr(0, 0.5)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, 'Fresa de planear Ø63', 22, 6, 8, Math.round(rr(40, 140)), r2(rr(0.4, 1.8)), 6))]),
    (id) => operacion(id, 'Desbaste', pick(TODOS), r2(rr(0.4, 1.5)), Math.round(rr(40, 80)), r2(rr(0, 0.6)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, 'Fresa alto avance Ø32', 20, 4, 4, Math.round(rr(50, 150)), r2(rr(1, 4)), 6))]),
    (id) => operacion(id, 'Agujereado', pick(CENTROS), r2(rr(0.2, 0.7)), Math.round(rr(20, 40)), r2(rr(0.1, 1.5)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, `Broca enteriza Ø${pick(['6,8', '8,5', '10,2', '12'])}`, Math.round(rr(50, 180)), 1, 1, Math.round(rr(150, 1000)), r2(rr(0.2, 0.9)), 5))]),
    (id) => operacion(id, 'Roscado', pick(CENTROS), r2(rr(0.1, 0.4)), Math.round(rr(15, 30)), r2(rr(0.2, 1.2)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, `Macho M${pick(['8', '10', '12'])}`, Math.round(rr(30, 80)), 1, 1, Math.round(rr(150, 900)), r2(rr(0.2, 0.7)), 4))]),
    (id) => operacion(id, 'Ranurado', pick(CENTROS), r2(rr(0.3, 1.5)), Math.round(rr(30, 50)), r2(rr(0, 0.6)), [
      posicion(`${id}-h1`, herramienta(`${id}-h1`, `Fresa enteriza Ø${pick(['8', '10', '12', '16'])}`, Math.round(rr(35, 90)), 1, 1, Math.round(rr(100, 400)), r2(rr(0.4, 1.5)), 4))]),
  ];

  const piezas: Pieza[] = [];
  for (let i = 1; i <= n; i++) {
    const nOps = 2 + Math.floor(rnd() * 4);
    const operaciones = Array.from({ length: nOps }, (_, j) => pick(plantillas)(`op${(j + 1) * 10}`));
    const volumenAnual = Math.max(100, Math.round(Math.exp(rr(Math.log(800), Math.log(45000))) / 100) * 100);
    const modo = pick(['lote', 'lote', 'lotesAnio', 'dedicada'] as const);
    const base: Pieza = {
      codigo: `GEN-${String(i).padStart(3, '0')}`, nombre: `${pick(NOMBRES)} ${i}`, volumenAnual, modoProduccion: modo,
      material: rnd() < 0.2
        ? { quienPone: 'cliente', clienteCobraScrap: false }
        : { quienPone: 'propio', costoPorPieza: r2(rr(1.5, 12)) },
      operaciones,
    };
    if (modo === 'lote') base.piezasPorLote = pick([100, 200, 300, 500, 1000]);
    if (modo === 'lotesAnio') base.lotesPorAnio = pick([5, 10, 20, 50, 100]);
    piezas.push(base);
  }
  return piezas;
}

// ── Documentos tal como los escribiría crearRepositorioCostos ─────────────────────────────────────────────────────────
export interface Auditoria<T> { createdAt: T; createdBy: string; updatedAt: T; updatedBy: string }
const auditoria = <T,>(ahora: T, uid: string): Auditoria<T> => ({ createdAt: ahora, createdBy: uid, updatedAt: ahora, updatedBy: uid });

export function documentoMaquina<T>(m: MaquinaSeed, uid: string, ahora: T) {
  return { nombre: m.nombre, costoHora: m.costoHora, planta: m.planta, ...auditoria(ahora, uid) };
}

/** Pieza + resumen calculado con calcResumen (calcVersion actual, reglasVersion 0) + auditoría. */
export function documentoPieza<T>(pieza: Pieza, maquinas: MaquinaSeed[], uid: string, ahora: T) {
  const costoHora = Object.fromEntries(maquinas.map((m) => [m.id, m.costoHora]));
  const resumen = calcResumen(pieza, costoHora, REGLAS_POR_DEFECTO);
  const { id: _id, resumen: _r, ...campos } = pieza;
  void _id; void _r;
  const limpio = JSON.parse(JSON.stringify({ ...campos, resumen })) as Record<string, unknown>; // sin undefined (Firestore los rechaza)
  return { ...limpio, ...auditoria(ahora, uid) };
}
