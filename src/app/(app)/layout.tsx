
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDoc, setDoc } from "firebase/firestore";
import { useUser, useFirestore, doc } from "@/firebase";
import AppHeader from "@/components/app/header";
import AppNav from "@/components/app/nav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import StaleCaseChecker from "@/components/app/stale-case-checker";
import { setCustomUserClaims } from "@/firebase/auth/set-custom-claims";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    } else if (!isUserLoading && user && firestore) {
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
  }, [user, isUserLoading, router, firestore]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <AppNav />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col h-full">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
            <StaleCaseChecker />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
