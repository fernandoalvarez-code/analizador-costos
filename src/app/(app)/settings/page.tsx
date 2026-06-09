'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { updateProfile } from 'firebase/auth';
import { useEffect, useState } from 'react';
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
// Asegúrate de que 'storage' esté exportado en tu archivo firebase/index.ts
import { useUser, useFirestore, useMemoFirebase, useDoc, useAuth, updateDocumentNonBlocking, doc, storage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { createUserWithRole } from '@/firebase/admin-actions';
import { Auth } from 'firebase/auth';
import { useTheme } from 'next-themes';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { setDoc, onSnapshot } from 'firebase/firestore';
import { UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';

// --- TIPOS Y SCHEMAS ---
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

// --- COMPONENTE DE CREACIÓN DE USUARIO (ADMIN) ---
const UserCreationForm = () => {
    const { toast } = useToast();
    const auth = useAuth();
    const firestore = useFirestore();
    const form = useForm<z.infer<typeof createUserSchema>>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { email: "", password: "", role: "user" },
    });

    async function onSubmit(data: z.infer<typeof createUserSchema>) {
        if (!auth || !firestore) return;
        try {
            await createUserWithRole(auth, firestore, data.email, data.password, data.role);
            toast({ title: "Usuario Creado", description: `El usuario ${data.email} ha sido creado con el rol de ${data.role}.` });
            form.reset();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error al crear usuario", description: error.message });
        }
    }

    return (
         <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Crear Nuevo Usuario</CardTitle>
                    <CardDescription>Crea una nueva cuenta de usuario y asígnale un rol.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="email@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Rol</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="user">Usuario</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                </CardContent>
                <CardFooter className="border-t px-6 py-4"><Button type="submit">Crear Usuario</Button></CardFooter>
                </form>
            </Form>
        </Card>
    )
}

// --- PÁGINA PRINCIPAL DE CONFIGURACIÓN ---
export default function SettingsPage() {
  const { setTheme } = useTheme();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Estados para logos
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [secoLogo, setSecoLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin' && user?.email?.endsWith('@secocut.com');

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: '', email: user?.email || '' },
  });

  // Efecto para cargar datos del usuario
  useEffect(() => {
    if (user) {
        const currentName = user.displayName || userProfile?.name || '';
        form.setValue('name', currentName);
        form.setValue('email', user.email || '');
    }
  }, [user, userProfile, form]);

  // Efecto para cargar logos (Configuración General)
  useEffect(() => {
    if (firestore) {
        // Escuchamos el documento 'settings/general'
        const unsub = onSnapshot(doc(firestore, "settings", "general"), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.companyLogoUrl) setCompanyLogo(data.companyLogoUrl);
                if (data.secoLogoUrl) setSecoLogo(data.secoLogoUrl);
            }
        });
        return () => unsub();
    }
  }, [firestore]);

  // Función para subir logos
  const handleLogoUpload = async (file: File, type: 'company' | 'seco') => {
    if (!file || !storage || !firestore) return;
    setUploadingLogo(true);
    try {
        const storageRef = ref(storage, `settings/logos/${type}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // Guardar URL en Firestore (colección settings, documento general)
        await setDoc(doc(firestore, "settings", "general"), {
            [type === 'company' ? 'companyLogoUrl' : 'secoLogoUrl']: url
        }, { merge: true });

        toast({ title: "Logo actualizado", description: "La imagen se ha guardado correctamente." });
    } catch (error: any) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo subir la imagen. " + error.message });
    } finally {
        setUploadingLogo(false);
    }
  };

  async function onSubmit(data: z.infer<typeof profileFormSchema>) {
    if (!user || !auth?.currentUser || !userProfileRef) return;
    try {
        await updateProfile(auth.currentUser, { displayName: data.name });
        updateDocumentNonBlocking(userProfileRef, { name: data.name });
        toast({ title: "Perfil actualizado", description: "Tu nombre ha sido guardado." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  return (
    <div className="container mx-auto pb-10">
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">Configuración</h1>
      
      <div className="grid gap-6">
        
        {/* SECCIÓN PERFIL */}
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Así es como te verán los demás.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} disabled className="bg-slate-100" /></FormControl><FormMessage /></FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="border-t px-6 py-4"><Button type="submit">Guardar Cambios</Button></CardFooter>
            </form>
          </Form>
        </Card>

        {/* SECCIÓN PERSONALIZACIÓN DE INFORME (NUEVA) */}
        {isAdmin && (
            <Card>
                <CardHeader>
                <CardTitle>Personalización del Informe PDF</CardTitle>
                <CardDescription>Sube los logos que aparecerán en la cabecera de los informes impresos.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    
                    {/* Logo Empresa */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Tu Logo / Empresa</Label>
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center h-48 bg-slate-50 relative overflow-hidden group hover:border-blue-400 transition-colors">
                            {companyLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={companyLogo} alt="Logo Empresa" className="h-full object-contain z-10" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <ImageIcon className="mx-auto h-10 w-10 mb-2 opacity-50" />
                                    <span className="text-sm">Sin logo asignado</span>
                                </div>
                            )}
                            {uploadingLogo && <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], 'company')}
                                disabled={uploadingLogo}
                            />
                        </div>
                        <Button variant="outline" className="w-full" disabled={uploadingLogo}>
                            <UploadCloud className="mr-2 h-4 w-4" /> {uploadingLogo ? "Subiendo..." : "Cambiar Logo Empresa"}
                        </Button>
                    </div>

                    {/* Logo Seco Tools */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Logo Seco Tools</Label>
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center h-48 bg-slate-50 relative overflow-hidden group hover:border-blue-400 transition-colors">
                            {secoLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={secoLogo} alt="Logo Seco" className="h-full object-contain z-10" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <ImageIcon className="mx-auto h-10 w-10 mb-2 opacity-50" />
                                    <span className="text-sm">Sin logo asignado</span>
                                </div>
                            )}
                            {uploadingLogo && <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], 'seco')}
                                disabled={uploadingLogo}
                            />
                        </div>
                        <Button variant="outline" className="w-full" disabled={uploadingLogo}>
                            <UploadCloud className="mr-2 h-4 w-4" /> {uploadingLogo ? "Subiendo..." : "Cambiar Logo Seco"}
                        </Button>
                    </div>

                </CardContent>
            </Card>
        )}

        {/* OTRAS SECCIONES (ADMIN Y USUARIO) */}
        {isAdmin && <UserCreationForm />}
        
        <Card>
          <CardHeader><CardTitle>Apariencia</CardTitle><CardDescription>Personaliza la apariencia de la aplicación.</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="theme-select">Tema</Label>
               <Select onValueChange={(theme) => setTheme(theme)} defaultValue="system">
                <SelectTrigger id="theme-select"><SelectValue placeholder="Selecciona un tema" /></SelectTrigger>
                <SelectContent><SelectItem value="light">Claro</SelectItem><SelectItem value="dark">Oscuro</SelectItem><SelectItem value="system">Sistema</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Seguridad</CardTitle><CardDescription>Gestiona la seguridad de tu cuenta.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4"><Button variant="outline">Cambiar Contraseña</Button></CardContent>
           <CardFooter className="border-t px-6 py-4"><Button variant="destructive">Eliminar Cuenta</Button></CardFooter>
        </Card>

      </div>
    </div>
  );
}
