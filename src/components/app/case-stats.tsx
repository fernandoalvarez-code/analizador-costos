
'use client';

import React from 'react';
import { DollarSign, BarChart, BadgeCheck, Clock, Zap } from 'lucide-react';

import { useCollection, useFirestore, useMemoFirebase, collection } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/formatters';

type CaseData = {
  id: string;
  status: 'Pendiente' | 'Exitoso' | 'No Exitoso';
  annualSavings: number;
  results?: {
    machineHoursFreedAnnual?: number;
  };
};

const StatCard = ({ title, value, icon, isLoading, isCurrency = false, isHours = false }: { title: string, value: number, icon: React.ReactNode, isLoading: boolean, isCurrency?: boolean, isHours?: boolean }) => {
    if (isLoading) {
        return <Skeleton className="h-24 w-full" />
    }

    const formattedValue = isCurrency ? formatCurrency(value) : isHours ? `${formatNumber(value)} hs` : formatNumber(value);

    return (
        <div className={`p-4 rounded-xl shadow-sm flex flex-col justify-between h-full ${
            isCurrency ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
        }`}>
            <div className="flex items-center justify-between text-slate-500">
                <p className="font-bold text-sm uppercase tracking-wide">{title}</p>
                {icon}
            </div>
            <div>
                <p className={`text-4xl font-black ${isCurrency ? 'text-green-600' : 'text-slate-800'}`}>
                    {formattedValue}
                </p>
            </div>
        </div>
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
    const initialStats = {
      total: 0,
      successful: 0,
      totalSavings: 0,
      totalHoursFreed: 0,
      successRate: 0,
    };
    
    if (!casesData) return initialStats;

    const successfulCases = casesData.filter((c) => c.status === 'Exitoso');
    
    const totalSavings = successfulCases.reduce((sum, current) => sum + (current.annualSavings || 0), 0);
    const totalHoursFreed = successfulCases.reduce((sum, current) => sum + (current.results?.machineHoursFreedAnnual || 0), 0);
    
    return {
      total: casesData.length,
      successful: successfulCases.length,
      totalSavings,
      totalHoursFreed,
      successRate: casesData.length > 0 ? (successfulCases.length / casesData.length) * 100 : 0,
    };
  }, [casesData]);

  return (
    <div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title="Ahorro Total Generado"
                value={stats.totalSavings}
                isLoading={isLoading}
                icon={<DollarSign className="h-6 w-6 text-green-500" />}
                isCurrency
            />
            <StatCard 
                title="Casos Exitosos"
                value={stats.successful}
                isLoading={isLoading}
                icon={<BadgeCheck className="h-6 w-6 text-slate-400" />}
            />
            <StatCard 
                title="Horas Máquina Liberadas"
                value={stats.totalHoursFreed}
                isLoading={isLoading}
                icon={<Clock className="h-6 w-6 text-slate-400" />}
                isHours
            />
             <StatCard 
                title="Tasa de Éxito"
                value={stats.successRate}
                isLoading={isLoading}
                icon={<Zap className="h-6 w-6 text-slate-400" />}
            />
        </div>
    </div>
  );
}
