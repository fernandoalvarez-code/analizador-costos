"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDoc, setDoc } from "firebase/firestore";
import { useUser, useFirestore, doc } from "@/firebase";
import AppHeader from "@/components/app/header";
import { Skeleton } from "@/components/ui/skeleton";
import StaleCaseChecker from "@/components/app/stale-case-checker";
import { setCustomUserClaims } from "@/firebase/auth/set-custom-claims";

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
          const defaultRole = 'user';
          // 1. Create Firestore document
          await setDoc(userDocRef, {
            id: user.uid,
            email: user.email,
            role: defaultRole,
          }, { merge: true });

          // 2. Set custom claims for the new user
          await setCustomUserClaims({ uid: user.uid, claims: { role: defaultRole } });

          // 3. Force refresh the token to get the new claims on the client
          await user.getIdToken(true);
        } else {
            // If user exists, check if claims are set. This is a fallback.
            const idTokenResult = await user.getIdTokenResult();
            if (!idTokenResult.claims.role) {
                const existingRole = docSnap.data()?.role || 'user';
                await setCustomUserClaims({ uid: user.uid, claims: { role: existingRole } });
                await user.getIdToken(true);
            }
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
      <main className="flex-1 w-full max-w-[1800px] mx-auto p-4 md:p-6 lg:p-8">
        {children}
        <StaleCaseChecker />
      </main>
    </div>
  );
}
