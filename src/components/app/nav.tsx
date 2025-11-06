"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, FolderKanban, LayoutDashboard, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";

export default function AppNav() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/cases",
      label: "Gestión de Casos",
      icon: FolderKanban,
    },
    {
      href: "/insights",
      label: "Perspectivas de IA",
      icon: BrainCircuit,
    },
  ];

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
           <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-primary"
          >
            <path d="M9.52 3.48a2.29 2.29 0 0 1 4.96 0 2.29 2.29 0 0 1-4.96 0Z" />
            <path d="M12 6.5v11.5" />
            <path d="M6 18h12" />
            <path d="M3 13a4 4 0 1 1 5.76-3.46" />
            <path d="M21 13a4 4 0 1 0-5.76-3.46" />
          </svg>
          <span className="font-headline text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">
            Analizador
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label }}
                >
                  <a>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" passHref legacyBehavior>
              <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip={{children: 'Configuración'}}>
                <a>
                  <Settings />
                  <span>Configuración</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
