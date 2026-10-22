// next dev en modo emulador, puerto 9002. FUERZA en el entorno del proceso todas las NEXT_PUBLIC_FIREBASE_* con valores de demo
// (las variables del shell pisan a .env.local): así el modo emulador no puede apuntar a la base real aunque falle otra guarda.
// Borra .next antes y después para que las variables de demo no queden incorporadas en una compilación normal.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const env = {
  ...process.env,
  NEXT_PUBLIC_USE_EMULATORS: 'true',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-costos',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-costos.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
};

const limpiar = () => { try { rmSync('.next', { recursive: true, force: true }); } catch { /* nada */ } };
limpiar();
console.log('Modo emulador: Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080, proyecto demo-costos. Abrir http://localhost:9002');
const hijo = spawn('npx', ['next', 'dev', '-p', '9002'], { env, stdio: 'inherit' });
const salir = (codigo) => { limpiar(); process.exit(codigo ?? 0); };
hijo.on('exit', salir);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { hijo.kill(s); });
