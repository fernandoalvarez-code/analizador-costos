// Guardado de un caso de la curva de costos en Firestore. El PDF ya no se guarda: se genera al
// imprimir desde la edición del caso. La escritura puede quedar pendiente sin rechazar (por ejemplo
// sin conexión con el servidor) y el botón "Guardando…" quedaba trabado sin mensaje, así que tiene
// un tope de tiempo.

export const TIMEOUT_ESCRITURA_MS = 30_000;

export class TimeoutError extends Error {
  constructor(etiqueta: string, ms: number) {
    super(`${etiqueta}: sin respuesta después de ${Math.round(ms / 1000)} s`);
    this.name = 'TimeoutError';
  }
}

export function conTimeout<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(etiqueta, ms)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

export const MENSAJE_SIN_CONFIRMAR =
  'No se pudo confirmar el guardado del caso. Revisá el Historial antes de reintentar, para no duplicarlo.';

/**
 * Escribe el caso. Lanza un Error con mensaje listo para mostrar si la escritura falla o no se
 * confirma a tiempo (un error de Firestore, como permission-denied, se propaga tal cual).
 */
export async function guardarCaso(deps: { escribirCaso: () => Promise<unknown>; timeoutEscrituraMs?: number }): Promise<void> {
  const { escribirCaso, timeoutEscrituraMs = TIMEOUT_ESCRITURA_MS } = deps;
  try {
    await conTimeout(Promise.resolve().then(escribirCaso), timeoutEscrituraMs, 'Guardado en Firestore');
  } catch (e) {
    if (e instanceof TimeoutError) throw new Error(MENSAJE_SIN_CONFIRMAR);
    throw e;
  }
}
