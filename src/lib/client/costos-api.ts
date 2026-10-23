/** Llamadas del módulo de costos a las rutas /api/costos/** con el ID token del usuario. Nunca lanza: devuelve ok:false (status 0 si no hubo respuesta). */
export interface RespuestaApi<T = unknown> { ok: boolean; status: number; data: T | null }

export async function llamarApiCostos<T = unknown>(
  user: { getIdToken: () => Promise<string> },
  url: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {},
): Promise<RespuestaApi<T>> {
  try {
    const token = await user.getIdToken();
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    let data: T | null = null;
    try { data = (await res.json()) as T; } catch { /* sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
