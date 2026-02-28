"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LogOut,
  Search,
  Settings,
  User,
  Menu,
  LayoutDashboard,
  FolderKanban,
  Calculator,
  History,
  TrendingUp,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { query, orderBy, limit } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { useAuth, useUser, useCollection, useFirestore, useMemoFirebase, collection } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "../ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const menuItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/cases',
      label: 'Gestión de Casos',
      icon: FolderKanban,
    },
    {
      href: '/simulator/new',
      label: 'Simulador',
      icon: Calculator,
    },
    {
      href: '/history',
      label: 'Historial',
      icon: History,
    },
     {
      href: '/taylor-curve',
      label: 'Curva de Costos',
      icon: TrendingUp,
    },
];

type Notification = {
    id: string;
    title: string;
    message: string;
    createdAt: { seconds: number };
    caseId?: string;
}

export default function AppHeader() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "notifications"), orderBy("createdAt", "desc"), limit(5));
  }, [firestore]);

  const { data: notifications, isLoading: isLoadingNotifications } = useCollection<Notification>(notificationsQuery);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/login");
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
      {/* Logo & Desktop Nav */}
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl font-black text-blue-600 tracking-tight">Secocut SRL</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {menuItems.map(item => (
            <Link 
              key={item.href}
              href={item.href} 
              className={cn(
                "px-4 py-2 text-sm font-bold text-slate-700 hover:text-blue-600 rounded-md transition-colors",
                (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && "bg-white text-blue-700 shadow-sm border border-slate-200"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      
      {/* Right side controls */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="pl-8 sm:w-[150px] md:w-[200px] lg:w-[250px]"
            />
        </div>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notificaciones</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoadingNotifications ? (
                    <div className="p-2 space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : notifications && notifications.length > 0 ? (
                    notifications.map(notif => (
                        <DropdownMenuItem key={notif.id} onClick={() => notif.caseId && router.push(`/cases/${notif.caseId}`)}>
                            <div className="flex flex-col">
                                <p className="font-medium">{notif.title}</p>
                                <p className="text-xs text-muted-foreground">{notif.message}</p>
                                {notif.createdAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(notif.createdAt.seconds * 1000), { addSuffix: true, locale: es })}
                                    </p>
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))
                ) : (
                     <p className="p-4 text-center text-sm text-muted-foreground">No hay notificaciones</p>
                )}
                 <DropdownMenuSeparator />
                 <DropdownMenuItem className="justify-center text-sm text-primary hover:underline">
                    Ver todas
                 </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-9 w-9">
                {user?.photoURL ? (
                  <AvatarImage src={user.photoURL} alt={user.displayName || "Avatar"} />
                ) : null}
                <AvatarFallback>{getInitials(user?.displayName || user?.email)}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Menú de usuario</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.displayName || "Usuario"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Menu */}
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Abrir menú</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-4 w-[300px] sm:w-[340px]">
                <nav className="grid gap-2 text-lg font-medium mt-6">
                    <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold mb-4">
                        <span className="text-xl font-black text-blue-600 tracking-tight">Secocut SRL</span>
                    </Link>
                    {menuItems.map(item => (
                         <Link 
                            key={item.href}
                            href={item.href} 
                            className={cn(
                                "flex items-center gap-4 px-2.5 py-2 text-base text-muted-foreground hover:text-foreground",
                                pathname.startsWith(item.href) && "text-foreground bg-slate-100 rounded-md"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
