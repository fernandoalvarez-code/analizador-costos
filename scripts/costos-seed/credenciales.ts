// Las contraseñas de los usuarios de PRUEBA del emulador viven SOLO en docs/analisis-costos/README-LOCAL.md. El seed las lee de ahí.
import { USUARIOS } from './datos';

const FILA = /^\|[^|]*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/gm;
export const LARGO_MINIMO_CLAVE = 16;

/** email -> contraseña, a partir de la tabla del README. Lanza si falta algún usuario del seed o una clave es corta. */
export function leerCredenciales(readme: string): Record<string, string> {
  const inicio = readme.indexOf('<!-- CREDENCIALES-EMULADOR:INICIO -->');
  const fin = readme.indexOf('<!-- CREDENCIALES-EMULADOR:FIN -->');
  if (inicio === -1 || fin === -1 || fin < inicio) throw new Error('Abortado: README-LOCAL.md no tiene el bloque de credenciales del emulador.');
  const bloque = readme.slice(inicio, fin);
  const creds: Record<string, string> = {};
  for (const m of bloque.matchAll(FILA)) creds[m[1]] = m[2];
  for (const u of USUARIOS) {
    const clave = creds[u.email];
    if (!clave) throw new Error(`Abortado: falta la contraseña de ${u.email} en README-LOCAL.md.`);
    if (clave.length < LARGO_MINIMO_CLAVE) throw new Error(`Abortado: la contraseña de ${u.email} es demasiado corta.`);
  }
  return creds;
}
