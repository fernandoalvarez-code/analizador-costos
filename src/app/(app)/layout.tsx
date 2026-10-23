"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDoc, setDoc } from "firebase/firestore";
import { useUser, useFirestore, useDoc, useMemoFirebase, doc } from "@/firebase";
import AppHeader from "@/components/app/header";
import { Skeleton } from "@/components/ui/skeleton";
import StaleCaseChecker from "@/components/app/stale-case-checker";
import EmailVerificationBanner from "@/components/app/email-verification-banner";
import { needsEmailVerification } from "@/lib/client/email-verification";
import { isVerifiedSecocutUser } from "@/lib/client/secocut-user";
import { PERFIL_TOPE_MS } from "@/hooks/use-secocut-admin-access";
import { esClienteEmpresa, rutaPermitidaCliente, type PerfilEmpresa } from "@/components/costos/modo-empresa";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  // Perímetro del cliente de empresa: con empresaId (y sin ser personal SECOCUT) solo se ve /costos y /settings.
  const perfilRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: perfil, isLoading: perfilLoading } = useDoc<PerfilEmpresa>(perfilRef);
  // El personal SECOCUT verificado nunca es cliente: no espera al perfil. El resto sí, para no mostrar un cuadro de contenido
  // prohibido antes de saber si es cliente (con un tope por si el perfil no llega nunca).
  const [perfilVencido, setPerfilVencido] = useState(false);
  const esperaPerfil = !!user && !isVerifiedSecocutUser(user) && perfilLoading && !perfilVencido;
  useEffect(() => {
    if (!esperaPerfil) return;
    const timer = setTimeout(() => setPerfilVencido(true), PERFIL_TOPE_MS);
    return () => clearTimeout(timer);
  }, [esperaPerfil]);
  const fueraDelPerimetro = !esperaPerfil && esClienteEmpresa(user, perfil) && !rutaPermitidaCliente(pathname);
  useEffect(() => {
    // /costos siempre está permitido: no hay redirección en bucle.
    if (fueraDelPerimetro) router.replace('/costos');
  }, [fueraDelPerimetro, router]);

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

  if (loading || !user || esperaPerfil || fueraDelPerimetro) {
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
