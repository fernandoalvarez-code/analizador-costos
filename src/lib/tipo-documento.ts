// Los análisis guardados viven todos en `cuttingToolAnalyses`, con tres formas de documento que no
// tienen un campo "tipo": se deducen por los campos que traen.
//  - Curva de costos: tiene `taylorInputs` (lo crea /taylor-curve).
//  - Simulación de competitividad: tiene `inputs` y `results`, sin `taylorInputs` (lo crea /simulator/new).
//  - Caso de éxito: el resto (lo crea el formulario de /cases/new).

export type TipoDocumento = 'curva' | 'simulacion' | 'caso';

export interface DocumentoAnalisis {
  id?: string;
  taylorInputs?: unknown;
  inputs?: unknown;
  results?: unknown;
  clientName?: string;
  caseName?: string;
  cliente?: string;
  name?: string;
  userId?: string;
  history?: Array<{ lastModifiedByEmail?: string | null }>;
  userEmail?: string;
  userName?: string;
}

const esObjeto = (v: unknown) => typeof v === 'object' && v !== null;

export function tieneTaylorInputs(doc: DocumentoAnalisis | null | undefined): boolean {
  return esObjeto(doc?.taylorInputs);
}

export function getTipoDocumento(doc: DocumentoAnalisis): TipoDocumento {
  if (tieneTaylorInputs(doc)) return 'curva';
  if (esObjeto(doc.inputs) && esObjeto(doc.results)) return 'simulacion';
  return 'caso';
}

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  curva: 'Curva de costos',
  caso: 'Caso de éxito',
  simulacion: 'Simulación',
};

/**
 * Ruta del editor que corresponde al documento: curva → editor de la curva; caso de éxito → editor de
 * casos; simulación → null (las simulaciones no se editan: solo ver, PDF y eliminar).
 */
export function getEditRoute(doc: DocumentoAnalisis & { id: string }): string | null {
  switch (getTipoDocumento(doc)) {
    case 'curva': return `/taylor-curve/${doc.id}/edit`;
    case 'caso': return `/cases/${doc.id}/edit`;
    case 'simulacion': return null;
  }
}

/** Acciones que ofrecen las listas (Historial y tabla de casos) para un documento. */
export function accionesDisponibles(doc: DocumentoAnalisis & { id: string; pdfUrl?: string }) {
  return {
    /** null = sin acción Editar (simulaciones). */
    editar: getEditRoute(doc),
    /** URL del PDF guardado, o null si no hay. */
    pdf: doc.pdfUrl ? doc.pdfUrl : null,
    eliminar: true as const,
  };
}

/** Qué hacer al abrir /taylor-curve/[id]/edit según lo que devolvió la lectura. */
export type EstadoEdicionCurva =
  | { estado: 'cargando' }
  | { estado: 'ok' }
  | { estado: 'inexistente'; destino: string }
  | { estado: 'otro-tipo'; destino: string; sinEditor: boolean };

export function estadoEdicionCurva(isLoading: boolean, doc: (DocumentoAnalisis & { id: string }) | null | undefined): EstadoEdicionCurva {
  if (isLoading) return { estado: 'cargando' };
  if (!doc) return { estado: 'inexistente', destino: '/history' };
  if (!tieneTaylorInputs(doc)) {
    const ruta = getEditRoute(doc);
    return { estado: 'otro-tipo', destino: ruta ?? '/history', sinEditor: ruta === null };
  }
  return { estado: 'ok' };
}

/** Cliente y nombre del caso con respaldo en los campos de las otras formas de documento. */
export const nombreCliente = (doc: DocumentoAnalisis): string => doc.clientName || doc.cliente || '';
export const nombreCaso = (doc: DocumentoAnalisis): string => doc.caseName || doc.name || '';

/** uid -> nombre (o email si no hay nombre) a partir de los documentos de `users`. Ignora los sin dato. */
export function mapaUsuarios(perfiles: Array<{ id: string; name?: string | null; email?: string | null }>): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const p of perfiles) {
    const etiqueta = (p.name && p.name.trim()) || (p.email && p.email.trim());
    if (etiqueta) mapa.set(p.id, etiqueta);
  }
  return mapa;
}

/**
 * Quién creó el documento. Orden: el mapa uid → nombre/email (lo arma el admin leyendo `users` una vez),
 * la sesión actual si es un documento propio, el email guardado en el documento (userEmail o el último
 * editor del caso de éxito) y, al final, el uid abreviado. Sin `mapa` (no admin o falló la lectura)
 * usa solo los últimos tres.
 */
export function usuarioDelDocumento(
  doc: DocumentoAnalisis,
  actual: { uid: string; email?: string | null; displayName?: string | null } | null,
  mapa?: Map<string, string> | null,
): string {
  const delMapa = doc.userId ? mapa?.get(doc.userId) : undefined;
  if (delMapa) return delMapa;
  if (actual && doc.userId && doc.userId === actual.uid) return actual.displayName || actual.email || 'Yo';
  const guardado = doc.userName || doc.userEmail || doc.history?.find(h => h?.lastModifiedByEmail)?.lastModifiedByEmail;
  if (guardado) return guardado;
  return doc.userId ? `Usuario …${doc.userId.slice(-6)}` : 'Sin usuario';
}
