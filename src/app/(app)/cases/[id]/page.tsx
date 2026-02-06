
'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import React, { Suspense, useEffect, useRef, useState } from 'react';

import DashboardTabs from '@/components/app/dashboard-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase, useUser, doc, setDocumentNonBlocking } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Edit, Save, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function getStatusVariant(status?: string) {
    switch (status) {
        case 'Exitoso':
        return 'default';
        case 'No Exitoso':
        return 'destructive';
        default:
        return 'secondary';
    }
}

function CaseDetailContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const isEditMode = searchParams.get('edit') === 'true';
  const isPrintMode = searchParams.get('print') === 'true';

  const caseDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `cuttingToolAnalyses/${id as string}`);
  }, [firestore, id]);

  const { data: caseData, isLoading } = useDoc(caseDocRef);
  const [status, setStatus] = useState(caseData?.status || 'Pendiente');
  
  // Ref to track the initial data load
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (caseData) {
      setStatus(caseData.status);

      // --- Print Mode ---
      if (isPrintMode && caseData.results) {
        // Timeout to allow the report to render before printing
        setTimeout(() => {
            window.print();
            // Optional: remove the print param from url after printing
            router.replace(`/cases/${id}`, { scroll: false });
        }, 500);
      }

      // --- Concurrency Check ---
      // Skip on initial load
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      
      // Check if the document was modified by another user
      if (caseData.modifiedBy && user && caseData.modifiedBy !== user.uid) {
        toast({
          title: "Caso Actualizado",
          description: `Este caso fue actualizado por ${caseData.lastModifiedByEmail || 'otro usuario'}. Tus cambios podrían ser sobreescritos.`,
          variant: "default",
          duration: 5000,
        });

        // If current user is in edit mode, force them out to prevent overwrites
        if (isEditMode) {
          router.replace(`/cases/${id}`);
          toast({
            title: "Modo Edición Desactivado",
            description: "Se ha desactivado el modo de edición para evitar la pérdida de datos. Por favor, revisa los cambios.",
            variant: "destructive",
            duration: 6000
          })
        }
      }
    }
  }, [caseData, user, toast, router, id, isEditMode, isPrintMode]);
  
  const handleEnableEditing = () => {
    router.push(`/cases/${id}?edit=true`);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  const handleSaveStatus = () => {
    if (!caseDocRef || !user) return;
    setDocumentNonBlocking(caseDocRef, { 
      status: status,
      modifiedBy: user.uid,
      lastModifiedByEmail: user.email,
      dateModified: new Date(),
    }, { merge: true });
    toast({
        title: "Estado actualizado",
        description: `El estado del caso ha sido cambiado a "${status}".`
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
          <Skeleton className="h-8 w-1/2" />
        </h1>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto text-center">
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
          Caso no encontrado
        </h1>
        <p>No se pudo encontrar el caso de éxito solicitado.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-start mb-6 gap-4 no-print">
        <div>
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                Detalle del Caso: <span className="text-primary">{caseData.name}</span>
                </h1>
                {!isEditMode && caseData.status && (
                    <Badge variant={getStatusVariant(caseData.status)} className="text-sm">
                        {caseData.status}
                    </Badge>
                )}
            </div>
            {isEditMode && (
                <div className="flex items-center gap-2 mt-4">
                    <Select value={status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Definir estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="Exitoso">Exitoso</SelectItem>
                            <SelectItem value="No Exitoso">No Exitoso</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSaveStatus} size="sm"><Save className="mr-2 h-4 w-4"/> Guardar Estado</Button>
                </div>
            )}
        </div>
        {!isEditMode && (
          <Button onClick={handleEnableEditing} variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Habilitar Edición
          </Button>
        )}
      </div>
      <DashboardTabs initialData={caseData} isReadOnly={!isEditMode} />
    </div>
  );
}


export default function CaseDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CaseDetailContent />
        </Suspense>
    )
}
