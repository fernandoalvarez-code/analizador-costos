
'use client';

import { doc } from 'firebase/firestore';
import { useParams } from 'next/navigation';

import DashboardTabs from '@/components/app/dashboard-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';

export default function CaseDetailPage() {
  const { id } = useParams();
  const firestore = useFirestore();

  const caseDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    // Point to the global collection
    return doc(firestore, `cuttingToolAnalyses/${id}`);
  }, [firestore, id]);

  const { data: caseData, isLoading } = useDoc(caseDocRef);

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
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
        Detalle del Caso: <span className="text-primary">{caseData.name}</span>
      </h1>
      <DashboardTabs initialData={caseData} />
    </div>
  );
}
