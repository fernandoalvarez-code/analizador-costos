"use client";
import DashboardTabs from "@/components/app/dashboard-tabs";

export default function NewCasePage() {
  return (
    <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
            Nuevo Estudio de Costos
        </h1>
        <p className="text-muted-foreground">
            Comienza con un diagnóstico rápido o ve directamente al informe detallado para guardar un caso de éxito.
        </p>
        <div>
          <DashboardTabs />
        </div>
    </div>
  );
}
