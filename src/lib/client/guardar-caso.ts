// Guardado de un caso de la curva de costos: subida del PDF a Storage y escritura en Firestore.
// Ambas promesas del SDK pueden quedar pendientes sin rechazar (Storage reintenta hasta ~10 min ante
// un problema de red o CORS; una escritura sin confirmar del servidor no resuelve), y el botón
// "Guardando…" quedaba trabado sin mensaje. Acá cada paso tiene un tope de tiempo.

export const TIMEOUT_SUBIDA_PDF_MS = 30_000;
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

export interface GuardarCasoDeps {
  /** PDF generado; undefined si no se pudo generar. */
  pdfBlob: Blob | undefined | void;
  /** Sube el PDF y devuelve la URL de descarga. */
  subirPdf: (blob: Blob) => Promise<string>;
  /** Escribe el caso en Firestore; recibe la URL del PDF ('' si no se pudo adjuntar). */
  escribirCaso: (pdfUrl: string) => Promise<unknown>;
  timeoutSubidaMs?: number;
  timeoutEscrituraMs?: number;
}

export interface GuardarCasoResultado {
  pdfAdjuntado: boolean;
  /** Motivo técnico por el que no se adjuntó el PDF (para consola), si corresponde. */
  motivoSinPdf?: string;
}

export const MENSAJE_SIN_PDF = 'El caso se guardó, pero no se pudo adjuntar el PDF.';
export const MENSAJE_SIN_CONFIRMAR =
  'No se pudo confirmar el guardado del caso. Revisá el Historial antes de reintentar, para no duplicarlo.';

/**
 * Sube el PDF (si falla o expira, sigue sin él) y escribe el caso.
 * Lanza un Error con mensaje listo para mostrar si la escritura falla o no se confirma.
 */
export async function guardarCaso(deps: GuardarCasoDeps): Promise<GuardarCasoResultado> {
  const { pdfBlob, subirPdf, escribirCaso, timeoutSubidaMs = TIMEOUT_SUBIDA_PDF_MS, timeoutEscrituraMs = TIMEOUT_ESCRITURA_MS } = deps;

  let pdfUrl = '';
  let motivoSinPdf: string | undefined;
  if (pdfBlob instanceof Blob) {
    try {
      pdfUrl = await conTimeout(subirPdf(pdfBlob), timeoutSubidaMs, 'Subida del PDF');
    } catch (e) {
      motivoSinPdf = e instanceof Error ? e.message : String(e);
      console.error('No se pudo subir el PDF a Storage; se guarda el caso sin PDF:', e);
    }
  } else {
    motivoSinPdf = 'No se pudo generar el PDF';
  }

  try {
    await conTimeout(Promise.resolve(escribirCaso(pdfUrl)), timeoutEscrituraMs, 'Guardado en Firestore');
  } catch (e) {
    if (e instanceof TimeoutError) throw new Error(MENSAJE_SIN_CONFIRMAR);
    throw e;
  }
  return { pdfAdjuntado: pdfUrl !== '', motivoSinPdf };
}
