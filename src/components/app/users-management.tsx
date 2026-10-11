"use client";

import React from "react";
import { doc as firestoreDoc, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { collection, useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { validateRoleChange, type ManagedUser, type UserRole } from "@/lib/users-roles";

const ROLE_LABEL: Record<UserRole, string> = { user: "Usuario", admin: "Administrador" };

// Solo para administradores: las reglas de Firestore solo dejan listar usuarios y cambiar el rol
// de OTRO usuario a un admin (nunca el propio).
export default function UsersManagement() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<{ target: ManagedUser; role: UserRole } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const usersRef = useMemoFirebase(() => (firestore ? collection(firestore, "users") : null), [firestore]);
  const { data, isLoading, error } = useCollection<ManagedUser>(usersRef);
  const users = React.useMemo(() => [...data].sort((a, b) => (a.email ?? a.id).localeCompare(b.email ?? b.id)), [data]);

  function requestChange(target: ManagedUser, role: UserRole) {
    if (!user) return;
    const check = validateRoleChange({ actorUid: user.uid, targetUid: target.id, newRole: role, users });
    if (!check.ok) {
      toast({ variant: "destructive", title: "No se puede cambiar el rol", description: check.reason });
      return;
    }
    setPending({ target, role });
  }

  async function confirmChange() {
    if (!pending || !firestore) return;
    setSaving(true);
    try {
      await updateDoc(firestoreDoc(firestore, "users", pending.target.id), { role: pending.role });
      toast({ title: "Rol actualizado", description: `${pending.target.email ?? pending.target.id} ahora es ${ROLE_LABEL[pending.role]}.` });
      setPending(null);
    } catch {
      toast({ variant: "destructive", title: "No se pudo actualizar el rol", description: "Verificá tus permisos e intentá de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios y roles</CardTitle>
        <CardDescription>
          Las personas entran con su cuenta de Google y quedan como Usuario; acá se promueve o degrada a otros.
          No podés cambiar tu propio rol, así siempre queda al menos un administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">No se pudo cargar la lista de usuarios.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Usuario</TableHead><TableHead className="w-48">Rol</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === user?.uid;
                const role: UserRole = u.role === "admin" ? "admin" : "user";
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name || u.email || u.id}</div>
                      {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                    </TableCell>
                    <TableCell>
                      <Select value={role} disabled={isSelf} onValueChange={(v) => requestChange(u, v as UserRole)}>
                        <SelectTrigger aria-label={`Rol de ${u.email ?? u.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{ROLE_LABEL.user}</SelectItem>
                          <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                        </SelectContent>
                      </Select>
                      {isSelf && <p className="mt-1 text-xs text-muted-foreground">Tu propia cuenta</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open && !saving) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el rol?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && `${pending.target.email ?? pending.target.id} pasará a ser ${ROLE_LABEL[pending.role]}.`}
              {pending?.role === "admin" && " Un administrador puede gestionar usuarios, configuración y notificaciones."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); void confirmChange(); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
