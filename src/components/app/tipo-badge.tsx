import { Badge } from '@/components/ui/badge';
import { ETIQUETA_TIPO, getTipoDocumento, type DocumentoAnalisis, type TipoDocumento } from '@/lib/tipo-documento';

const VARIANTE: Record<TipoDocumento, 'default' | 'secondary' | 'outline'> = {
  curva: 'default',
  caso: 'secondary',
  simulacion: 'outline',
};

export default function TipoBadge({ doc }: { doc: DocumentoAnalisis }) {
  const tipo = getTipoDocumento(doc);
  return <Badge variant={VARIANTE[tipo]} className="text-xs whitespace-nowrap" data-tipo={tipo}>{ETIQUETA_TIPO[tipo]}</Badge>;
}
