export type Case = {
  id: string;
  name: string;
  date: string;
  savings: number;
  roi: number;
  client: string;
};

export const sampleCases: Case[] = [
  {
    id: "CASE-001",
    name: "Optimización de Torneado en Inconel",
    date: "2024-05-15",
    savings: 120500,
    roi: 250,
    client: "AeroSpace Corp",
  },
  {
    id: "CASE-002",
    name: "Reducción de Ciclo en Fresado de Aluminio",
    date: "2024-04-22",
    savings: 75200,
    roi: 180,
    client: "Automotriz del Norte",
  },
  {
    id: "CASE-003",
    name: "Mejora de Vida Útil en Acero Inoxidable",
    date: "2024-03-10",
    savings: 98000,
    roi: 320,
    client: "Componentes Médicos S.A.",
  },
  {
    id: "CASE-004",
    name: "Implementación de Herramienta Cerámica",
    date: "2024-02-18",
    savings: 210000,
    roi: 400,
    client: "Manufacturas Pesadas",
  },
  {
    id: "CASE-005",
    name: "Acabado de Alta Velocidad en Titanio",
    date: "2024-01-25",
    savings: 155000,
    roi: 280,
    client: "Defensa y Tecnología",
  },
];
