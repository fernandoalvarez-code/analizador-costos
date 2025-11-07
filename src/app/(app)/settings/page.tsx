
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { useTheme } from "next-themes"
import { updateProfile } from 'firebase/auth';
import { useEffect } from 'react';


import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser, useFirestore, useMemoFirebase, useDoc, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { createUserWithRole } from '@/firebase/admin-actions';
import { Auth } from 'firebase/auth';

type UserProfile = {
  role?: 'admin' | 'user';
  name?: string;
};

const profileFormSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  email: z.string().email('Correo electrónico no válido.').optional(),
});

const createUserSchema = z.object({
  email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  role: z.enum(['user', 'admin'], { required_error: "Debes seleccionar un rol." }),
});

const UserCreationForm = () => {
    const { toast } = useToast();
    const auth = useAuth();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof createUserSchema>>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
        email: "",
        password: "",
        role: "user",
        },
    });

    async function onSubmit(data: z.infer<typeof createUserSchema>) {
        if (!auth || !firestore) return;
        try {
            await createUserWithRole(auth, firestore, data.email, data.password, data.role);
            toast({
                title: "Usuario Creado",
                description: `El usuario ${data.email} ha sido creado con el rol de ${data.role}.`,
            });
            form.reset();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error al crear usuario",
                description: error.message,
            });
        }
    }

    return (
         <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Crear Nuevo Usuario</CardTitle>
                    <CardDescription>
                    Crea una nueva cuenta de usuario y asígnale un rol.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Correo Electrónico del Nuevo Usuario</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="nuevo.usuario@ejemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contraseña Temporal</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Rol del Usuario</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                Los administradores pueden crear usuarios y editar todos los casos.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button type="submit">Crear Usuario</Button>
                </CardFooter>
                </form>
            </Form>
        </Card>
    )
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = userProfile?.role === 'admin';

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: user?.email || '',
    },
  });

  useEffect(() => {
    if (user) {
        // Set name from Auth (displayName) or Firestore profile
        const currentName = user.displayName || userProfile?.name || '';
        form.setValue('name', currentName);
        form.setValue('email', user.email || '');
    }
  }, [user, userProfile, form]);

  async function onSubmit(data: z.infer<typeof profileFormSchema>) {
    if (!user || !auth?.currentUser || !userProfileRef) return;

    try {
        await updateProfile(auth.currentUser, { displayName: data.name });
        await updateDoc(userProfileRef, { name: data.name });

        toast({
            title: "Perfil actualizado",
            description: "Tu nombre para mostrar ha sido guardado.",
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error al actualizar",
            description: error.message || "No se pudo guardar tu perfil.",
        });
    }
  }

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">
        Configuración
      </h1>
      <div className="grid gap-6">
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>
                  Así es como te verán los demás en la plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre para mostrar</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="tu@email.com"
                          {...field}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit">Guardar Cambios</Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        
        {isAdmin && <UserCreationForm />}

        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription>
              Personaliza la apariencia de la aplicación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="theme-select">Tema</Label>
               <Select onValueChange={(theme) => setTheme(theme)} defaultValue="system">
                <SelectTrigger id="theme-select">
                  <SelectValue placeholder="Selecciona un tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>
              Gestiona la seguridad de tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline">Cambiar Contraseña</Button>
          </CardContent>
           <CardFooter className="border-t px-6 py-4">
             <Button variant="destructive">Eliminar Cuenta</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
