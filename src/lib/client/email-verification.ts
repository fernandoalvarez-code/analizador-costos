"use client";

import { sendEmailVerification, type User } from "firebase/auth";

/**
 * Cuentas de email y contraseña creadas antes de que existiera un flujo de verificación quedaron con
 * emailVerified = false para siempre. Las reglas y las rutas /api exigen email verificado, así que
 * necesitan poder verificarlo desde la app.
 */
export function needsEmailVerification(user: Pick<User, "emailVerified" | "providerData"> | null | undefined): boolean {
  return !!user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password");
}

/** Envía el correo de verificación de Firebase a la casilla de la cuenta. */
export async function sendVerificationEmail(user: User, send: typeof sendEmailVerification = sendEmailVerification): Promise<void> {
  await send(user);
}

/**
 * Vuelve a leer la cuenta y, si ya se verificó, refresca el token para que las reglas y el servidor
 * vean email_verified = true. Devuelve si quedó verificada.
 */
export async function refreshVerification(user: Pick<User, "reload" | "emailVerified" | "getIdToken">): Promise<boolean> {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}
