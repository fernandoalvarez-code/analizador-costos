"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDoc, setDoc } from "firebase/firestore";
import { useUser, useFirestore, doc } from "@/firebase";
import AppHeader from "@/components/app/header";
import { Skeleton } from "@/components/ui/skeleton";
import StaleCaseChecker from "@/components/app/stale-case-checker";
import EmailVerificationBanner from "@/components/app/email-verification-banner";
import { needsEmailVerification } from "@/lib/client/email-verification";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      
      const setupUser = async () => {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
          // Primer ingreso: se crea el perfil con rol 'user'. El rol vive SOLO en users/{uid}.role
          // (las reglas lo leen de ahí); no se usan custom claims.
          await setDoc(userDocRef, {
            id: user.uid,
            email: user.email,
            role: 'user',
          }, { merge: true });
        }
      };

      setupUser().catch(console.error);
    }
  }, [user, loading, router, firestore]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <AppHeader />
      {needsEmailVerification(user) && <EmailVerificationBanner user={user} />}
      <main className="flex-1 w-full max-w-[1800px] mx-auto p-4 md:p-6 lg:p-8">
        {children}
        <StaleCaseChecker />
      </main>
    </div>
  );
}
