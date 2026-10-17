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

/** Ruta del editor que corresponde al documento: curva → editor de la curva; el resto → editor de casos. */
export function getEditRoute(doc: Pick<DocumentoAnalisis, 'id' | 'taylorInputs'> & { id: string }): string {
  return tieneTaylorInputs(doc) ? `/taylor-curve/${doc.id}/edit` : `/cases/${doc.id}/edit`;
}

/** Qué hacer al abrir /taylor-curve/[id]/edit según lo que devolvió la lectura. */
export type EstadoEdicionCurva =
  | { estado: 'cargando' }
  | { estado: 'ok' }
  | { estado: 'inexistente'; destino: string }
  | { estado: 'otro-tipo'; destino: string };

export function estadoEdicionCurva(isLoading: boolean, doc: (DocumentoAnalisis & { id: string }) | null | undefined): EstadoEdicionCurva {
  if (isLoading) return { estado: 'cargando' };
  if (!doc) return { estado: 'inexistente', destino: '/history' };
  if (!tieneTaylorInputs(doc)) return { estado: 'otro-tipo', destino: getEditRoute(doc) };
  return { estado: 'ok' };
}

/** Cliente y nombre del caso con respaldo en los campos de las otras formas de documento. */
export const nombreCliente = (doc: DocumentoAnalisis): string => doc.clientName || doc.cliente || '';
export const nombreCaso = (doc: DocumentoAnalisis): string => doc.caseName || doc.name || '';

/**
 * Quién creó el documento, usando SOLO lo que ya está en el documento (las reglas no dejan leer el
 * perfil de otros usuarios). Los propios se identifican con la sesión actual; los ajenos, con un email
 * guardado en el documento (userEmail o el último editor del caso de éxito) o, si no hay, el uid abreviado.
 */
export function usuarioDelDocumento(
  doc: DocumentoAnalisis,
  actual: { uid: string; email?: string | null; displayName?: string | null } | null,
): string {
  if (actual && doc.userId && doc.userId === actual.uid) return actual.displayName || actual.email || 'Yo';
  const guardado = doc.userName || doc.userEmail || doc.history?.find(h => h?.lastModifiedByEmail)?.lastModifiedByEmail;
  if (guardado) return guardado;
  return doc.userId ? `Usuario …${doc.userId.slice(-6)}` : 'Sin usuario';
}
