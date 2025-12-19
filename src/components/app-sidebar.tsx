"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Calendar, LayoutDashboard, Medal, Users, Bell, LogOut, Settings, HeartPulse, Star } from "lucide-react";

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
  { href: "/dashboard/reviews", icon: Star, label: "Reviews" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2 justify-center group-data-[collapsible=icon]:justify-center">
          <div className="bg-primary rounded-lg p-1.5 text-primary-foreground">
            <Book className="w-5 h-5 transition-all" />
          </div>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <h1 className="text-xl font-headline font-bold">Budo League</h1>
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
