"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useUser, useFirestore } from "@/firebase/provider";
import AppHeader from "@/components/app/header";
import AppNav from "@/components/app/nav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import StaleCaseChecker from "@/components/app/stale-case-checker";

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
      // Ensure user profile exists
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then(docSnap => {
        if (!docSnap.exists()) {
          // If the document doesn't exist, create it with a default role.
          setDoc(userDocRef, {
            id: user.uid,
            email: user.email,
            role: 'user', // Assign default role
          }, { merge: true });
        }
      });
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
