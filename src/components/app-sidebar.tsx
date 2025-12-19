"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Calendar, LayoutDashboard, Medal, Users, Bell, LogOut, Settings, HeartPulse } from "lucide-react";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/schedule", icon: Calendar, label: "Schedule" },
  { href: "/dashboard/teams", icon: Users, label: "Teams" },
  { href: "/dashboard/scores", icon: Medal, label: "Scores" },
  { href: "/dashboard/fantasy", icon: HeartPulse, label: "Fantasy" },
  { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2 justify-center group-data-[collapsible=icon]:justify-center">
            <svg role="img" aria-label="Premier League logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-primary group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:h-6 transition-all">
                <path d="M12.973 3.322c-2.18.43-4.332 1.93-5.342 4.162-.432.946-.226 2.228.01 3.166.452 1.83 1.258 2.87 2.058 3.998.41.58.55 1.51.52 2.22-.05 1.16-.62 2.05-1.83 2.5-1.53.58-3.23.28-4.52-.77-1.01-.83-1.44-2.19-.8-3.47.38-.76.27-1.74-.08-2.5-1.12-2.43-2.33-4.03-3.69-6.32C-.982 7.7.138 5.61.138 4.25c0-.98.39-1.92.83-2.61.92-1.49 2.53-2.02 4.2-1.57 2.39.63 4.23 2.2 4.83 4.52.27 1.04.53 2.1.8 3.14.33-1.02.6-2.05.82-3.1.6-2.32 2.45-3.89 4.84-4.52 1.67-.45 3.28.09 4.2 1.57.44.69.83 1.63.83 2.61 0 1.36-1.12 3.45-2.32 6.01-1.36 2.29-2.57 3.89-3.69 6.32-.35.76-.46 1.74-.08 2.5.64 1.28.21 2.64-.8 3.47-1.29 1.05-2.99 1.35-4.52.77-1.21-.45-1.78-1.34-1.83-2.5-.03-.71.11-1.64.52-2.22.8-.1.129 2.02-1.998 1.258-3.998.236-.938.442-2.22.01-3.166-1.01-2.232-3.162-3.732-5.342-4.162z"/>
            </svg>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <h1 className="text-xl font-headline font-bold">Premier League</h1>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
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
      <SidebarSeparator />
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8">
              <Avatar className="size-8">
                <AvatarImage src="https://picsum.photos/seed/admin/100/100" alt="Admin" data-ai-hint="person avatar" />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                <p className="font-semibold truncate">League Admin</p>
                <p className="text-xs text-muted-foreground truncate">admin@pl.com</p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
