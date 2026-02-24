"use client";

export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "USD 0.00";
  }
  
  // Formatea el número con comas y 2 decimales, y le pone "USD" adelante
  return `USD ${value.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

export const formatPercent = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
};

export const formatNumber = (val?: number) => {
    if (typeof val !== 'number' || !isFinite(val)) return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val);
};

export const formatoMinutosYSegundos = (minutosDecimales: number): string => {
  if (!minutosDecimales || minutosDecimales <= 0) return "0m 0s";
  const min = Math.floor(minutosDecimales);
  const seg = Math.round((minutosDecimales - min) * 60);
  return seg === 60 ? `${min + 1}m 0s` : `${min}m ${seg}s`;
};
