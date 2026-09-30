import React from 'react';

interface PdfLightHeaderProps {
  logoUrl: string;
  title: string;
  pageNumber: number;
  totalPages: number;
}

// Header liviano compartido por las páginas 2, 3 y 4 del PDF de curva de costos
// (la página 1 usa su propio header "de tapa", con los dos logos grandes y el
// título principal). Agrega el isotipo SECOCUT que antes faltaba en estas páginas.
export function PdfLightHeader({ logoUrl, title, pageNumber, totalPages }: PdfLightHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-3">
        {logoUrl
          ? <img src={logoUrl} alt="Logo SECOCUT" crossOrigin="anonymous" className="h-8 object-contain max-w-[120px] object-left" />
          : <div className="h-6 flex items-center justify-center bg-blue-600 text-white font-black px-2 rounded text-xs">SECOCUT</div>}
        <h2 className="text-xl font-black text-slate-800 uppercase">{title}</h2>
      </div>
      <p className="text-sm font-bold text-slate-500">Página {pageNumber} de {totalPages}</p>
    </div>
  );
}
