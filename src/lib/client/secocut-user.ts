/**
 * ¿Es un empleado de SECOCUT? Mismo criterio que isSecucutEmail() en firestore.rules y
 * requireSecucutUser en el servidor: email VERIFICADO, en minúsculas, terminado en @secocut.com.
 * Solo gobierna qué se muestra en la interfaz; la protección real está en reglas y rutas /api.
 */
export function isVerifiedSecocutUser(user: { email?: string | null; emailVerified?: boolean } | null | undefined): boolean {
  return !!user && user.emailVerified === true && !!user.email && user.email.toLowerCase().endsWith('@secocut.com');
}
