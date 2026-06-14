"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import CaseStats from "@/components/app/case-stats";
import CasesTableWrapper from "@/components/app/cases-table";

export default function DashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  // TEMPORAL: botón para obtener el token de Firebase — BORRAR después de usar
  const [token, setToken] = useState('');
  const getToken = async () => {
    if (!user) return;
    const t = await user.getIdToken(true);
    setToken(t);
  };

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
        {/* TEMPORAL: obtener token de Firebase — BORRAR después */}
        {token ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <p className="text-xs font-mono break-all">{token}</p>
          </div>
        ) : (
          <button onClick={getToken} className="mb-4 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg">
            Obtener token
          </button>
        )}
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
