"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import CaseStats from "@/components/app/case-stats";
import CasesTableWrapper from "@/components/app/cases-table";

export default function DashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
        const isSecocutEmployee = user.email?.endsWith('@secocut.com');
        if (!isSecocutEmployee) {
            router.replace('/history');
        }
    }
  }, [user, loading, router]);

  const isSecocutEmployee = user?.email?.endsWith('@secocut.com');
  
  if (loading || !isSecocutEmployee) {
      return null;
  }

  return (
    <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard de Ventas
        </h1>
        <p className="text-muted-foreground">
            Un resumen del impacto de tus casos de éxito y el estado de tu embudo de ventas.
        </p>
        <CaseStats />
        <h2 className="text-2xl font-bold tracking-tight font-headline pt-8">
            Gestión de Casos
        </h2>
        <CasesTableWrapper />
    </div>
  );
}
