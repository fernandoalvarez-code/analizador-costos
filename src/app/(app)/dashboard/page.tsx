import DashboardTabs from "@/components/app/dashboard-tabs";

export default function DashboardPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
            Análisis de Herramientas
        </h1>
        <DashboardTabs />
    </div>
  );
}