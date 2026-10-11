"use client";

import React from "react";
import type { User } from "firebase/auth";
import { MailWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { refreshVerification, sendVerificationEmail } from "@/lib/client/email-verification";

const RESEND_COOLDOWN_SECONDS = 60;

export default function EmailVerificationBanner({ user }: { user: User }) {
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSend() {
    setBusy(true);
    setMessage(null);
    try {
      await sendVerificationEmail(user);
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage(`Te enviamos un correo a ${user.email}. Abrí el enlace y después tocá "Ya verifiqué".`);
    } catch {
      setMessage("No pudimos enviar el correo. Esperá un momento e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    setMessage(null);
    try {
      if (await refreshVerification(user)) {
        window.location.reload(); // la app se vuelve a cargar con el token ya verificado
        return;
      }
      setMessage("Todavía no figura como verificado. Abrí el enlace del correo y volvé a intentar.");
    } catch {
      setMessage("No pudimos comprobar el estado. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-300 bg-amber-50 text-amber-900">
      <MailWarning className="h-4 w-4" />
      <AlertTitle>Verificá tu correo</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>
          Tu cuenta usa email y contraseña y todavía no está verificada. Sin verificar, varias funciones (copiloto, agentes,
          informes) dejan de estar disponibles.
          {message && <span className="mt-1 block font-medium">{message}</span>}
        </span>
        <span className="flex shrink-0 gap-2">
          <Button size="sm" disabled={busy || cooldown > 0} onClick={onSend}>
            {cooldown > 0 ? `Reenviar en ${cooldown}s` : sent ? "Reenviar correo" : "Enviar verificación"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onRefresh}>Ya verifiqué</Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
