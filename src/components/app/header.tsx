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
      label: 'Historial de Análisis',
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
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        <div className="flex-shrink-0 flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
                <span className="text-xl font-black text-blue-700 tracking-tight uppercase">
                    Secocut <span className="text-slate-800">SRL</span>
                </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
            {menuItems.map(item => {
                const isActive = (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));
                return (
                <Link 
                    key={item.href}
                    href={item.href} 
                    className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive 
                        ? "font-bold text-blue-700 bg-blue-50" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                >
                    {item.label}
                </Link>
                )
            })}
            </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-inner"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                    <Bell className="h-5 w-5" />
                    {notifications && notifications.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
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
                <button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full">
                    <Avatar className="h-9 w-9 border-2 border-white ring-2 ring-slate-100 cursor-pointer">
                        {user?.photoURL ? (
                            <AvatarImage src={user.photoURL} alt={user.displayName || "Avatar"} />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-tr from-blue-700 to-blue-400 text-white text-xs font-bold">
                            {getInitials(user?.displayName || user?.email)}
                        </AvatarFallback>
                    </Avatar>
                </button>
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
                           <span className="text-xl font-black text-blue-700 tracking-tight uppercase">Secocut <span className="text-slate-800">SRL</span></span>
                      </Link>
                      {menuItems.map(item => (
                           <Link 
                              key={item.href}
                              href={item.href} 
                              className={cn(
                                  "flex items-center gap-4 px-2.5 py-2 text-base text-muted-foreground hover:text-foreground",
                                  (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && "text-foreground bg-slate-100 rounded-md"
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
      </div>
    </header>
  );
}
