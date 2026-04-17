"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import CasesTableWrapper from "@/components/app/cases-table";

export default function CasesPage() {
    const { user, loading: userLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!userLoading && user && !user.email?.endsWith('@secocut.com')) {
            router.replace('/history');
        }
    }, [user, userLoading, router]);

    if (userLoading || (user && !user.email?.endsWith('@secocut.com'))) return null;

    return (
        <div className="container mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Gestión de Casos de Éxito
                </h1>
            </div>
           
            <CasesTableWrapper />
        </div>
    );
}
