# Costos de mecanizado — modo emulador local

Permite probar el módulo en el navegador con un cliente y usuarios SECOCUT **sin tocar la base real**: todo corre contra los
emuladores de Firebase (Auth y Firestore) con el proyecto de demostración `demo-costos`.

## Cómo levantarlo (dos terminales)

Requisitos: Node y Java (los emuladores lo necesitan; si no está en el PATH pero hay un OpenJDK de Homebrew, el script lo usa).

1. **Emuladores + seed** (terminal 1):
   ```
   npm run costos:emuladores                         # empresas A y B, 4 máquinas, CAR-001 y una pieza de B
   npm run costos:emuladores -- --piezas-aleatorias  # además, 98 piezas ficticias en la empresa A (para el Resumen de planta)
   ```
   Los datos son **efímeros**: se pierden al apagar los emuladores y se vuelven a sembrar cada vez. Ctrl+C los apaga.
2. **Aplicación en modo emulador** (terminal 2, puerto 9002):
   ```
   npm run dev:emulador
   ```
   Este script FUERZA `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-costos` (y el resto de las `NEXT_PUBLIC_FIREBASE_*` con valores de demo) en el
   proceso: las variables del shell pisan a `.env.local`, así que no puede apuntar a la base real aunque falle otra guarda.
   Además, la aplicación solo conecta los emuladores si se cumplen las TRES condiciones: `NEXT_PUBLIC_USE_EMULATORS === 'true'`,
   `NODE_ENV !== 'production'` y un projectId que empieza con `demo-` (ver `src/firebase/emulators.ts`).

### Rutas `/api` en modo emulador

Las rutas `/api/costos/**` (invitaciones, canje, vendedores) y las de IA usan el Admin SDK en el servidor de Next. Para que ese servidor hable con los
emuladores (y no con Firebase real), hay que pasarle estas variables al arrancar `npm run dev:emulador`; el script las hereda tal cual:

```
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=demo-costos \
npm run dev:emulador
```

Sin ellas, la pantalla de costos funciona igual (usa el SDK del navegador), pero las rutas `/api` fallan al verificar el token. Son variables del emulador,
sin ninguna clave; no van en `apphosting.yaml` ni en `.env.local`.

`npm run dev` (arranque normal) y `npm run build` no cambian: sin la variable no se conecta ningún emulador.
`.env.local.example` solo documenta la variable; no va en `apphosting.yaml` ni en variables de producción.

## Usuarios de prueba (SOLO del emulador)

Estas cuentas existen únicamente dentro de los emuladores locales (efímeros) y nunca en Firebase real; los emails son ficticios y las
contraseñas se generaron al azar para esto, no coinciden con las de ninguna cuenta real. Tienen el email verificado, que las reglas exigen.
El seed lee las contraseñas de esta tabla: si las cambiás, cambialas acá.

<!-- CREDENCIALES-EMULADOR:INICIO -->
| Usuario | Email | Contraseña |
|---|---|---|
| Cliente A (Autopartes Ejemplo S.A.) — role user + empresaId emp-a | `cliente.a@autopartes-ejemplo.test` | `LD9FEBDmymoYTUUZPlv5Q01I` |
| Cliente B (Metalúrgica Ejemplo S.R.L.) — role user + empresaId emp-b | `cliente.b@metalurgica-ejemplo.test` | `kfi3qRHGPffYS0OGryBey0Am` |
| Vendedor SECOCUT — empresasAsignadas [emp-a] | `vendedor@secocut.com` | `Y9B5SNI8o_f8Nz_aAQ3-bCcv` |
| Admin SECOCUT — role admin | `admin@secocut.com` | `sxG2NyPe_vI8fBsqCOLHPBuV` |
| SECOCUT sin asignaciones — sin empresa | `sin.asignar@secocut.com` | `M1bu8KU2-XnD0U1DOT28uZk7` |
<!-- CREDENCIALES-EMULADOR:FIN -->

`empresaId` y `empresasAsignadas` los escribe el seed con Admin SDK (el "servidor"), nunca la aplicación.

## Qué crea el seed

- **Empresa A** "Autopartes Ejemplo S.A." (`emp-a`): Torno CNC 1 (30 USD/h), Centro vertical 1 (35), Centro vertical 2 (35), Centro horizontal (45) y
  la pieza **CAR-001 Carcasa** del SPEC 4.7 (25.000 pzs/año, lote 500, material propio 9,50): 9,3570 USD/pza.
- **Empresa B** "Metalúrgica Ejemplo S.R.L." (`emp-b`): dos máquinas y la pieza BRI-100 (distinta), para comprobar que A no ve B.
- Piezas con `resumen` calculado con `calcResumen` (calcVersion actual, reglasVersion 0) y auditoría `createdAt/createdBy/updatedAt/updatedBy`, igual que
  si las hubiera escrito la capa de datos. Máquinas con auditoría.
- Con `--piezas-aleatorias`: 98 piezas ficticias (`GEN-001`… `GEN-098`) en la empresa A, generadas con una semilla fija.

## Guardas del seed

El seed ABORTA si no están `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`, si no apuntan a esta máquina, o si el proyecto no es
exactamente `demo-costos` (`GCLOUD_PROJECT`; además se pasa explícito a `initializeApp`).
