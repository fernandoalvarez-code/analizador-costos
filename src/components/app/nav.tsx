'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BrainCircuit,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Briefcase,
  Calculator,
  History,
  TrendingUp,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';

import { useUser } from '@/firebase';

export default function AppNav() {
  const pathname = usePathname();
  const { user } = useUser();

  const isSecocutUser = user?.email?.endsWith('@secocut.com') ?? false;

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
      label: 'Simulador de Competitividad',
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

  const filteredMenuItems = menuItems.filter(item => {
    if (isSecocutUser) return true;
    return ['/history', '/taylor-curve'].includes(item.href);
  });

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hidden group-data-[collapsible=icon]:flex">
            <span className="text-sm font-bold">SC</span>
          </div>
          <span className="font-headline text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">
            Secocut SRL
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {filteredMenuItems.map(item => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={{ children: item.label }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings'}
              tooltip={{ children: 'Configuración' }}
            >
              <Link href="/settings">
                <Settings />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
