import SimulationsTableWrapper from "@/components/app/simulations-table";
import { History } from "lucide-react";

export default function SimulatorHistoryPage() {
    return (
        <div className="container mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
                    <History className="h-8 w-8 text-primary" />
                    Historial de Simulaciones
                </h1>
            </div>
           
            <SimulationsTableWrapper />
        </div>
    );
}
