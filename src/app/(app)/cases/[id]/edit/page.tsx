"use client";

import { doc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardTabs from "@/components/app/dashboard-tabs"; 
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EditCasePage({ params }: { params: { id: string } }) {
  // 1. Obtener el ID de la URL
  const { id } = params;
  const router = useRouter();
  const firestore = useFirestore();

  // 2. Conectar con la base de datos para buscar este caso específico
  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "cuttingToolAnalyses", id);
  }, [firestore, id]);

  // 3. Obtener los datos actuales
  const { data, isLoading } = useDoc<any>(docRef);

  // Muestra "Cargando..." mientras baja los datos
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  // Si no encuentra el caso (fue borrado o error de ID)
  if (!data) {
    return (
        <div className="container mx-auto p-8 text-center">
            <h2 className="text-xl font-bold text-red-500">Error</h2>
            <p>El caso que intentas editar no existe o no tienes permisos.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                Volver
            </Button>
        </div>
    );
  }

  // 4. Renderizar el Formulario (Dashboard) en modo "Edición"
  // Pasamos 'initialData' que incluye el ID, así el formulario sabe que debe ACTUALIZAR en vez de crear uno nuevo.
  return (
    <div className="container mx-auto p-4 md:p-6 pb-20">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">
            Editando Caso: <span className="text-blue-600">{data.name}</span>
        </h1>
      </div>
      
      {/* Aquí reutilizamos tu componente principal, pero precargado con los datos */}
      <DashboardTabs initialData={{ ...data, id: id }} />
    </div>
  );
}
