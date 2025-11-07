
'use client';

import { doc, updateDoc } from 'firebase/firestore';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';


import DashboardTabs from '@/components/app/dashboard-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Edit, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

  const caseDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `cuttingToolAnalyses/${id}`);
  }, [firestore, id]);

  const { data: caseData, isLoading } = useDoc(caseDocRef);
  const [status, setStatus] = React.useState(caseData?.status || 'Pendiente');

  useEffect(() => {
    if (caseData?.status) {
      setStatus(caseData.status);
    }
  }, [caseData]);
  
  const handleEnableEditing = () => {
    router.push(`/cases/${id}?edit=true`);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  const handleSaveStatus = () => {
    if (!caseDocRef) return;
    setDocumentNonBlocking(caseDocRef, { status: status }, { merge: true });
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
      <div className="flex justify-between items-start mb-6 gap-4">
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
