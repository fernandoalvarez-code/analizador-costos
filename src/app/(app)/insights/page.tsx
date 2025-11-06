import SavingsInsightsForm from "@/components/app/savings-insights-form";
import { BrainCircuit } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="container mx-auto">
        <div className="flex items-center gap-4 mb-6">
            <BrainCircuit className="h-8 w-8 text-primary"/>
            <h1 className="text-3xl font-bold tracking-tight font-headline">
                Perspectivas de Ahorro con IA
            </h1>
        </div>
        <p className="text-muted-foreground mb-8 max-w-3xl">
            Utiliza nuestro motor de inteligencia artificial para obtener sugerencias personalizadas sobre cambios de herramientas. Ingresa los datos de tu operación y deja que nuestro sistema, entrenado con miles de casos de éxito, te muestre nuevas formas de aumentar tus ahorros.
        </p>
        <SavingsInsightsForm />
    </div>
  );
}