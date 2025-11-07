
'use client';

import { doc } from 'firebase/firestore';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import React, { Suspense } from 'react';


import DashboardTabs from '@/components/app/dashboard-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

function CaseDetailContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();

  const isEditMode = searchParams.get('edit') === 'true';

  const caseDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `cuttingToolAnalyses/${id}`);
  }, [firestore, id]);

  const { data: caseData, isLoading } = useDoc(caseDocRef);
  
  const handleEnableEditing = () => {
    router.push(`/cases/${id}?edit=true`);
  };

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Detalle del Caso: <span className="text-primary">{caseData.name}</span>
        </h1>
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

    