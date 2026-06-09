import React from 'react';

interface ComparisonData {
  totalCostPerComponent: number;
  machiningCost: number;
  toolLifeCost: number;
  toolChangeCost: number;
  insertsToBuy: number;
}

interface ToolComparisonCardProps {
  title: string;
  competitorData: ComparisonData;
  proposedData: ComparisonData;
}

const ToolComparisonCard = ({ title, competitorData, proposedData }: ToolComparisonCardProps) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* TARJETA COMPETIDOR */}
        <div className="p-4 rounded-md bg-red-50 border-l-4 border-red-500">
          <h4 className="font-bold text-red-700 mb-2 text-lg">Competidor</h4>
          <p className="font-extrabold text-2xl text-red-600 mb-3">
            USD {competitorData.totalCostPerComponent.toFixed(2)} <span className="text-sm font-normal text-gray-600">/ pieza</span>
          </p>
          
          <div className="space-y-1 text-sm text-gray-700">
            <p>⚙️ Tiempo de Corte: <span className="font-semibold">USD {competitorData.machiningCost.toFixed(2)}</span></p>
            <p>💎 Inserto Puro: <span className="font-semibold">USD {competitorData.toolLifeCost.toFixed(2)}</span></p>
            <p>🔴 Costo Paradas: <span className="font-semibold">USD {competitorData.toolChangeCost.toFixed(2)}</span></p>
          </div>
          
          <hr className="my-3 border-red-200" />
          
          {/* EL DATO ESTRELLA DE INVENTARIO */}
          <div className="flex items-center justify-between bg-red-100 p-2 rounded">
            <span className="font-semibold text-red-800">📦 Insertos para Lote:</span>
            <span className="font-bold text-red-900">{competitorData.insertsToBuy} unds.</span>
          </div>
        </div>

        {/* TARJETA SECOCUT (PROPUESTA) */}
        <div className="p-4 rounded-md bg-green-50 border-l-4 border-green-500">
          <h4 className="font-bold text-green-700 mb-2 text-lg">SECOCUT</h4>
          <p className="font-extrabold text-2xl text-green-600 mb-3">
            USD {proposedData.totalCostPerComponent.toFixed(2)} <span className="text-sm font-normal text-gray-600">/ pieza</span>
          </p>
          
          <div className="space-y-1 text-sm text-gray-700">
            <p>⚙️ Tiempo de Corte: <span className="font-semibold">USD {proposedData.machiningCost.toFixed(2)}</span></p>
            <p>💎 Inserto Puro: <span className="font-semibold">USD {proposedData.toolLifeCost.toFixed(2)}</span></p>
            <p>🔴 Costo Paradas: <span className="font-semibold">USD {proposedData.toolChangeCost.toFixed(2)}</span></p>
          </div>
          
          <hr className="my-3 border-green-200" />
          
          {/* EL DATO ESTRELLA DE INVENTARIO */}
          <div className="flex items-center justify-between bg-green-100 p-2 rounded">
            <span className="font-semibold text-green-800">📦 Insertos para Lote:</span>
            <span className="font-bold text-green-900">{proposedData.insertsToBuy} unds.</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ToolComparisonCard;
