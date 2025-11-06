import CasesTable from "@/components/app/cases-table";

export default function CasesPage() {
    return (
        <div className="container mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Gestión de Casos de Éxito
                </h1>
            </div>
           
            <CasesTable />
        </div>
    );
}