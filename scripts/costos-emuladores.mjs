// Levanta los emuladores de Auth (9099) y Firestore (8080) con el proyecto demo-costos y corre el seed. Los datos son efímeros:
// cada vez que se levanta se vuelve a sembrar. Pasar --piezas-aleatorias para sumar las 98 piezas ficticias de la empresa A.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

const PROJECT = 'demo-costos';
const conAleatorias = process.argv.includes('--piezas-aleatorias');
const env = { ...process.env };

// Los emuladores necesitan Java. Si no está en el PATH pero hay un OpenJDK de Homebrew, se usa.
if (spawnSync('java', ['-version'], { stdio: 'ignore' }).status !== 0) {
  for (const home of ['/opt/homebrew/opt/openjdk', '/usr/local/opt/openjdk']) {
    if (existsSync(`${home}/bin/java`)) { env.JAVA_HOME = home; env.PATH = `${home}/bin:${env.PATH}`; break; }
  }
}

const escucha = (puerto) => new Promise((ok) => {
  const s = net.connect(puerto, '127.0.0.1');
  s.on('connect', () => { s.destroy(); ok(true); });
  s.on('error', () => ok(false));
});
async function esperar(puerto, ms = 90_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await escucha(puerto)) return; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`El emulador del puerto ${puerto} no arrancó a tiempo.`);
}

const emu = spawn('npx', ['-y', 'firebase-tools@15.13.0', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT], { env, stdio: 'inherit' });
const apagar = () => { emu.kill('SIGINT'); };
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
emu.on('exit', (c) => process.exit(c ?? 0));

try {
  await Promise.all([esperar(8080), esperar(9099)]);
  const seed = spawnSync('npx', ['tsx', 'scripts/seed-costos-emulador.ts', ...(conAleatorias ? ['--piezas-aleatorias'] : [])], {
    env: { ...env, GCLOUD_PROJECT: PROJECT, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    stdio: 'inherit',
  });
  if (seed.status !== 0) { console.error('El seed falló: se apagan los emuladores.'); apagar(); }
  else console.log('Emuladores listos. Ctrl+C para apagarlos.');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  apagar();
}
