import React from 'react';

interface PdfFooterProps {
  // La nota de asistencia por IA va solo en la última página del informe, en letra
  // chica, no repetida en cada hoja.
  showAiDisclaimer?: boolean;
}

// Footer compartido por las 4 páginas del PDF de curva de costos. Reemplaza el
// texto anterior ("Documento generado automáticamente...") por la leyenda fija de
// valores sugeridos, igual en las 4 hojas.
export function PdfFooter({ showAiDisclaimer = false }: PdfFooterProps) {
  return (
    <div className="mt-auto pt-4 border-t border-slate-300 text-center">
      <p className="text-[10px] text-slate-500 font-semibold">
        Valores sugeridos — sujetos a verificación y ajuste en máquina
      </p>
      {showAiDisclaimer && (
        <p className="text-[7px] text-slate-400 mt-2 leading-snug max-w-2xl mx-auto">
          Este informe fue elaborado con asistencia de inteligencia artificial a partir de los datos aportados y del catálogo del fabricante. El criterio técnico y la revisión final son responsabilidad de SECOCUT. Ante cualquier discrepancia, prevalece el dato verificado en Seco Suggest.
        </p>
      )}
    </div>
  );
}
