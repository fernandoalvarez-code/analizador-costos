
import CaseStats from "@/components/app/case-stats";
import DashboardTabs from "@/components/app/dashboard-tabs";

export default function DashboardPage() {
  return (
    <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
        </h1>
        <CaseStats />
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">
              Análisis de Herramientas
          </h2>
          <DashboardTabs />
        </div>
    </div>
  );
}
