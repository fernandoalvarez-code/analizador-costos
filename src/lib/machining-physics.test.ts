/**
 * machining-physics.test.ts
 * Validación manual del motor físico con un caso conocido de torneado.
 *
 * CASO DE PRUEBA:
 *   Operación  : Torneado exterior
 *   Vc         : 200 m/min
 *   fn         : 0.2 mm/rev
 *   ap         : 2 mm
 *   Diámetro   : 50 mm
 *   Longitud   : 100 mm
 *   kc         : 1800 N/mm²  (Acero 1045)
 *   Eficiencia : 0.85
 *   Pot. máx.  : 15 kW
 *   Torque máx.: 200 Nm
 *
 * RESULTADOS ESPERADOS (calculados manualmente):
 *
 *   RPM  = (200 × 1000) / (π × 50)  = 200000 / 157.080 ≈ 1273.24 rev/min
 *   Vf   = 1273.24 × 0.2             ≈  254.65 mm/min
 *   Tc   = 100 / 254.65              ≈    0.393 min  (~23.6 s)
 *   Pc   = (1800 × 2 × 0.2 × 200) / (60000 × 0.85)
 *        = 144000 / 51000            ≈    2.824 kW   ✓ dentro de 15 kW
 *   Mc   = (1800 × 2 × 0.2 × 50) / 2000
 *        = 36000 / 2000              =   18.000 Nm   ✓ dentro de 200 Nm
 *   Viable: true, reason: null
 */

import {
  calcRPM,
  calcVf,
  calcTc,
  calcPc,
  calcMc,
  checkViability,
} from './machining-physics';

// ── Parámetros del caso ───────────────────────────────────────────────────────
const VC       = 200;   // m/min
const FN       = 0.2;   // mm/rev
const AP       = 2;     // mm
const DIAM     = 50;    // mm
const LENGTH   = 100;   // mm
const KC       = 1800;  // N/mm²
const EFF      = 0.85;
const MAX_POW  = 15;    // kW
const MAX_TRQ  = 200;   // Nm

// ── Cálculos ──────────────────────────────────────────────────────────────────
const rpm      = calcRPM(VC, DIAM);
const vf       = calcVf(rpm, FN);
const tc       = calcTc(LENGTH, vf);
const pc       = calcPc(KC, AP, FN, VC, EFF);
const mc       = calcMc(KC, AP, FN, DIAM);
const viab     = checkViability(pc, mc, MAX_POW, MAX_TRQ);

// ── Salida ────────────────────────────────────────────────────────────────────
console.log('=== Validación motor físico de mecanizado ===\n');
console.log(`RPM     : ${rpm.toFixed(2)}   (esperado ≈ 1273.24)`);
console.log(`Vf      : ${vf.toFixed(2)} mm/min   (esperado ≈ 254.65)`);
console.log(`Tc      : ${tc.toFixed(3)} min  (esperado ≈ 0.393)`);
console.log(`Pc      : ${pc.toFixed(3)} kW   (esperado ≈ 2.824)`);
console.log(`Mc      : ${mc.toFixed(3)} Nm   (esperado = 18.000)`);
console.log(`Viable  : ${viab.viable}  (esperado: true)`);
console.log(`Reason  : ${viab.reason}  (esperado: null)`);

// ── Aserciones simples (lanzan error si fallan) ───────────────────────────────
const TOLERANCE = 0.01; // 1% de tolerancia para flotantes

function assertNear(label: string, actual: number, expected: number, tol = TOLERANCE) {
  const pct = Math.abs(actual - expected) / expected;
  if (pct > tol) {
    throw new Error(`❌ ${label}: obtenido ${actual.toFixed(4)}, esperado ${expected} (diff ${(pct * 100).toFixed(2)}%)`);
  }
  console.log(`✅ ${label}`);
}

assertNear('RPM',  rpm, 1273.24, 0.001);
assertNear('Vf',   vf,  254.648, 0.001);
assertNear('Tc',   tc,    0.3927, 0.005);
assertNear('Pc',   pc,    2.8235, 0.001);
assertNear('Mc',   mc,   18.0,   0.0001);

if (viab.viable !== true)  throw new Error('❌ viable debe ser true');
if (viab.reason !== null)  throw new Error('❌ reason debe ser null');
console.log('✅ viable / reason');

console.log('\n✅ Todos los casos pasaron.');
