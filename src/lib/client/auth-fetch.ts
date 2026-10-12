"use client";

import { getAuth } from "firebase/auth";
import "@/firebase"; // asegura que la app de Firebase esté inicializada antes de getAuth()

/**
 * fetch a las rutas /api internas: agrega el ID token del usuario logueado como
 * `Authorization: Bearer`, que es lo que exigen requireVerifiedUser/requireSecucutUser.
 * Sin sesión, la request sale sin header y el servidor responde 401.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const user = getAuth().currentUser;
  const headers = new Headers(init.headers);
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(input, { ...init, headers });
}
