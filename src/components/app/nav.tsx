"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, FolderKanban, LayoutDashboard, Settings } from "lucide-react";
import Image from "next/image";

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
           <Image 
            src="/logo.png" 
            alt="Logo de la empresa" 
            width={150} 
            height={40}
            className="object-contain group-data-[collapsible=icon]:hidden"
          />
           <Image 
            src="/logo-icon.png" 
            alt="Icono del logo de la empresa" 
            width={32} 
            height={32}
            className="object-contain hidden group-data-[collapsible=icon]:block"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
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
            <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip={{children: 'Configuración'}}>
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
