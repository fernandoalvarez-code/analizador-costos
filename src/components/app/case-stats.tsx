
'use client';

import { collection } from 'firebase/firestore';
import React from 'react';
import { BarChart, BadgeCheck, XCircle, Clock } from 'lucide-react';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type CaseData = {
  id: string;
  status: 'Pendiente' | 'Exitoso' | 'No Exitoso';
};

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: number, icon: React.ReactNode, isLoading: boolean }) => {
    if (isLoading) {
        return <Skeleton className="h-[76px] w-full" />
    }
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-0">
                <CardTitle className="text-xs font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <div className="text-lg font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

export default function CaseStats() {
  const firestore = useFirestore();

  const casesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'cuttingToolAnalyses');
  }, [firestore]);

  const { data: casesData, isLoading } = useCollection<CaseData>(casesCollectionRef);

  const stats = React.useMemo(() => {
    if (!casesData) {
      return { total: 0, successful: 0, unsuccessful: 0, pending: 0 };
    }
    return {
      total: casesData.length,
      successful: casesData.filter((c) => c.status === 'Exitoso').length,
      unsuccessful: casesData.filter((c) => c.status === 'No Exitoso').length,
      pending: casesData.filter((c) => c.status === 'Pendiente').length,
    };
  }, [casesData]);

  return (
    <div>
        <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">
            Estadísticas de Casos
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title="Total de Casos"
                value={stats.total}
                isLoading={isLoading}
                icon={<BarChart className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard 
                title="Casos Exitosos"
                value={stats.successful}
                isLoading={isLoading}
                icon={<BadgeCheck className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard 
                title="Casos No Exitosos"
                value={stats.unsuccessful}
                isLoading={isLoading}
                icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard 
                title="Casos Pendientes"
                value={stats.pending}
                isLoading={isLoading}
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
        </div>
    </div>
  );
}
